import fs from "node:fs/promises";
import path from "node:path";
import { coversDir, coverPublicPath, ensureDataDirs } from "./paths";
import { isbn10To13, isbn13To10, normalizeIsbn } from "./isbn";

export type BookMetadata = {
  title?: string;
  author?: string;
  isbn10?: string;
  isbn13?: string;
  subtitle?: string;
  publisher?: string;
  publishedDate?: string;
  description?: string;
  pageCount?: number;
  categories?: string;
  coverUrl?: string;
  metadataSource?: string;
};

export async function lookupBookMetadata(rawIsbn: string): Promise<BookMetadata | null> {
  const isbn = normalizeIsbn(rawIsbn);
  if (!isbn) return null;
  const results = await Promise.allSettled([lookupOpenLibrary(isbn), lookupGoogleBooks(isbn)]);
  const metadata = results
    .filter((result): result is PromiseFulfilledResult<BookMetadata | null> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(Boolean) as BookMetadata[];
  if (metadata.length === 0) return null;
  return mergeMetadata(metadata, isbn);
}

function mergeMetadata(items: BookMetadata[], isbn: string): BookMetadata {
  const merged: BookMetadata = { isbn13: isbn.length === 13 ? isbn : isbn10To13(isbn), isbn10: isbn.length === 10 ? isbn : isbn13To10(isbn) };
  for (const item of items) {
    for (const [key, value] of Object.entries(item) as [keyof BookMetadata, string | number | undefined][]) {
      if (value && !merged[key]) {
        (merged[key] as typeof value) = value;
      }
    }
  }
  merged.metadataSource = items.map((item) => item.metadataSource).filter(Boolean).join(", ");
  return merged;
}

async function lookupOpenLibrary(isbn: string): Promise<BookMetadata | null> {
  const response = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) return null;
  const data = await response.json();
  const authorNames = await openLibraryAuthors(data.authors ?? []);
  return {
    title: data.title,
    author: authorNames.join(", ") || undefined,
    isbn10: data.isbn_10?.[0],
    isbn13: data.isbn_13?.[0],
    publisher: data.publishers?.[0],
    publishedDate: data.publish_date,
    description: typeof data.description === "string" ? data.description : data.description?.value,
    pageCount: data.number_of_pages,
    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
    metadataSource: "Open Library",
  };
}

async function openLibraryAuthors(authors: { key?: string }[]) {
  const names = await Promise.all(
    authors.slice(0, 4).map(async (author) => {
      if (!author.key) return undefined;
      const response = await fetch(`https://openlibrary.org${author.key}.json`, { next: { revalidate: 60 * 60 * 24 * 30 } });
      if (!response.ok) return undefined;
      const data = await response.json();
      return data.name as string | undefined;
    }),
  );
  return names.filter(Boolean) as string[];
}

async function lookupGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`, { next: { revalidate: 60 * 60 * 24 } });
  if (!response.ok) return null;
  const data = await response.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return null;
  return {
    title: info.title,
    author: info.authors?.join(", "),
    subtitle: info.subtitle,
    publisher: info.publisher,
    publishedDate: info.publishedDate,
    description: info.description,
    pageCount: info.pageCount,
    categories: info.categories?.join(", "),
    coverUrl: info.imageLinks?.thumbnail?.replace("http://", "https://"),
    metadataSource: "Google Books",
  };
}

export async function cacheCover(coverUrl?: string, isbn?: string) {
  if (!coverUrl || !isbn) return undefined;
  try {
    ensureDataDirs();
    const response = await fetch(coverUrl);
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return undefined;
    const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const fileName = `${normalizeIsbn(isbn)}.${extension}`;
    const filePath = path.join(/*turbopackIgnore: true*/ coversDir, fileName);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) return undefined;
    await fs.writeFile(filePath, buffer);
    return coverPublicPath(fileName);
  } catch {
    return undefined;
  }
}
