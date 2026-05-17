"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  books,
  bookshelfDefinitions,
  bookshelves,
  copies,
  houseLevels,
  loans,
  locations,
  rooms,
} from "@/lib/schema";
import { cacheCover, lookupBookMetadata } from "@/lib/book-metadata";
import {
  nextCopyNumber,
  getActiveLoanForCopy,
  getCopy,
} from "@/lib/data";
import { normalizeIsbn } from "@/lib/isbn";
import { depthCountForDepth, desiredShelfSpots, shelfSpotKey, type ShelfDepth } from "@/lib/bookshelf-shape";
import Papa from "papaparse";

// ── Helpers ─────────────────────────────────────────────────────────────────

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null);

function formObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

async function readCsvRows(formData: FormData, field = "file") {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0)
    throw new Error("Choose a CSV file first.");
  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  return parsed.data.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "").trim()]),
    ),
  );
}

// ── Book schema & actions ───────────────────────────────────────────────────

const bookSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  author: z.string().trim().min(1, "Author is required"),
  isbn10: optionalText,
  isbn13: optionalText,
  subtitle: optionalText,
  publisher: optionalText,
  publishedDate: optionalText,
  description: optionalText,
  pageCount: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value === "" ? null : value ?? null)),
  categories: optionalText,
  seriesName: optionalText,
  seriesNumber: optionalText,
  coverImagePath: optionalText,
  metadataSource: optionalText,
});

const copySchema = z.object({
  bookId: z.coerce.number().int().positive(),
  locationId: z.coerce.number().int().positive(),
  notes: optionalText,
  conditionNotes: optionalText,
});

const loanSchema = z.object({
  copyId: z.coerce.number().int().positive(),
  borrowerName: z.string().trim().min(1, "Borrower name is required"),
  dateLoaned: z.string().trim().min(1, "Date loaned is required"),
  contactInfo: optionalText,
  notes: optionalText,
});

// ── Book actions ────────────────────────────────────────────────────────────

export async function createBookAction(formData: FormData) {
  const parsed = bookSchema.parse(formObject(formData));
  const locationId = z.coerce
    .number()
    .int()
    .positive()
    .parse(formData.get("locationId"));
  const bookId = db.transaction((tx) => {
    const book = tx.insert(books).values(parsed).returning({ id: books.id }).get();
    tx.insert(copies).values({ bookId: book.id, locationId, copyNumber: 1 }).run();
    return book.id;
  });
  revalidatePath("/");
  redirect(`/books/${bookId}`);
}

export async function updateBookAction(bookId: number, formData: FormData) {
  const parsed = bookSchema.parse(formObject(formData));
  await db
    .update(books)
    .set({ ...parsed, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(books.id, bookId));
  revalidatePath(`/books/${bookId}`);
  redirect(`/books/${bookId}`);
}

export async function deleteBookAction(bookId: number) {
  await db.delete(books).where(eq(books.id, bookId));
  revalidatePath("/catalog");
  redirect("/catalog");
}

// ── Copy actions ────────────────────────────────────────────────────────────

export async function createCopyAction(formData: FormData) {
  const parsed = copySchema.parse(formObject(formData));
  const copyNumber = await nextCopyNumber(parsed.bookId);
  await db.insert(copies).values({ ...parsed, copyNumber });
  revalidatePath(`/books/${parsed.bookId}`);
}

export async function updateCopyAction(copyId: number, formData: FormData) {
  const parsed = copySchema.parse(formObject(formData));
  await db
    .update(copies)
    .set({ ...parsed, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(copies.id, copyId));
  revalidatePath(`/books/${parsed.bookId}`);
}

export async function deleteCopyAction(copyId: number, bookId: number) {
  await db.delete(copies).where(eq(copies.id, copyId));
  revalidatePath(`/books/${bookId}`);
}

// ── Room / Bookshelf actions (replaces old location actions) ─────────────────

const createRoomSchema = z.object({
  levelId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Room name is required"),
});

export async function createRoomAction(formData: FormData) {
  const parsed = createRoomSchema.parse(formObject(formData));
  await db.insert(rooms).values(parsed).onConflictDoNothing();
  revalidatePath("/locations");
  revalidatePath("/");
}

const createBookshelfSchema = z.object({
  roomId: z.coerce.number().int().positive(),
  definitionId: z.coerce.number().int().positive().optional().or(z.literal(""))
    .transform((value) => (value === "" ? null : value ?? null)),
  name: z.string().trim().min(1, "Bookshelf name is required"),
  rowCount: z.coerce.number().int().positive().default(6),
  depthCount: z.coerce.number().int().min(1).max(2).default(2),
  notes: optionalText,
});

export async function createBookshelfAction(formData: FormData) {
  const parsed = createBookshelfSchema.parse(formObject(formData));
  db.transaction((tx) => {
    const shape = resolveBookshelfShape(tx, parsed.definitionId, parsed.rowCount, parsed.depthCount);
    const bs = tx
      .insert(bookshelves)
      .values({
        roomId: parsed.roomId,
        definitionId: parsed.definitionId,
        name: parsed.name,
        rowCount: shape.rowCount,
        depthCount: shape.depthCount,
        notes: parsed.notes,
      })
      .returning()
      .get();

    for (const spot of desiredShelfSpots(shape.rowCount, shape.depthCount)) {
      tx.insert(locations).values({ bookshelfId: bs.id, ...spot }).run();
    }
  });

  revalidatePath("/locations");
  revalidatePath("/");
  redirect("/locations");
}

const updateBookshelfSchema = z.object({
  definitionId: z.coerce.number().int().positive().optional().or(z.literal(""))
    .transform((value) => (value === "" ? null : value ?? null)),
  name: z.string().trim().min(1, "Bookshelf name is required"),
  rowCount: z.coerce.number().int().positive(),
  depthCount: z.coerce.number().int().min(1).max(2),
  notes: optionalText,
});

export async function updateBookshelfAction(
  bookshelfId: number,
  formData: FormData,
) {
  const parsed = updateBookshelfSchema.parse(formObject(formData));
  db.transaction((tx) => {
    const shape = resolveBookshelfShape(tx, parsed.definitionId, parsed.rowCount, parsed.depthCount);
    const existingLocations = tx
      .select({ id: locations.id, shelfRow: locations.shelfRow, depth: locations.depth })
      .from(locations)
      .where(eq(locations.bookshelfId, bookshelfId))
      .all();

    for (const location of existingLocations) {
      const shouldKeep =
        location.shelfRow <= shape.rowCount &&
        (shape.depthCount === 2 || location.depth === "front");
      if (!shouldKeep) {
        const usedCopy = tx
          .select({ id: copies.id })
          .from(copies)
          .where(eq(copies.locationId, location.id))
          .limit(1)
          .get();
        if (usedCopy) {
          throw new Error("Move books out of removed shelf spots before shrinking this bookshelf.");
        }
        tx.delete(locations).where(eq(locations.id, location.id)).run();
      }
    }

    for (const spot of desiredShelfSpots(shape.rowCount, shape.depthCount)) {
      const exists = existingLocations.some((location) => location.shelfRow === spot.shelfRow && location.depth === spot.depth);
      if (!exists) {
        tx.insert(locations).values({ bookshelfId, ...spot }).run();
      }
    }

    tx.update(bookshelves)
      .set({ ...parsed, rowCount: shape.rowCount, depthCount: shape.depthCount, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(bookshelves.id, bookshelfId))
      .run();
  });
  revalidatePath("/locations");
  revalidatePath("/");
}

function resolveBookshelfShape(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  definitionId: number | null,
  rowCount: number,
  depthCount: number,
) {
  if (!definitionId) return { rowCount, depthCount };
  const definition = tx
    .select({ rowCount: bookshelfDefinitions.rowCount, depthCount: bookshelfDefinitions.depthCount })
    .from(bookshelfDefinitions)
    .where(eq(bookshelfDefinitions.id, definitionId))
    .limit(1)
    .get();
  if (!definition) throw new Error("Selected bookshelf preset does not exist.");
  return definition;
}

export async function deleteBookshelfAction(bookshelfId: number) {
  await db.delete(bookshelves).where(eq(bookshelves.id, bookshelfId));
  revalidatePath("/locations");
  revalidatePath("/");
}

export async function deleteLocationAction() {
  throw new Error("Shelf spots are generated from bookshelf dimensions. Resize or delete the bookcase instead.");
}

export async function updateLocationNotesAction(
  locationId: number,
  formData: FormData,
) {
  const notes = z
    .string()
    .trim()
    .optional()
    .parse(formData.get("notes") ?? "");
  await db
    .update(locations)
    .set({ notes: notes || null, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(locations.id, locationId));
  revalidatePath("/locations");
}

// ── Loan actions ─────────────────────────────────────────────────────────────

export async function createLoanAction(formData: FormData) {
  const parsed = loanSchema.parse(formObject(formData));
  const existing = await getActiveLoanForCopy(parsed.copyId);
  if (existing) throw new Error("This copy is already loaned out.");
  const copy = await getCopy(parsed.copyId);
  db.transaction((tx) => {
    tx.insert(loans).values(parsed).run();
    tx.update(copies)
      .set({ status: "loaned", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(copies.id, parsed.copyId))
      .run();
  });
  revalidatePath("/loans");
  revalidatePath("/catalog");
  if (copy) revalidatePath(`/books/${copy.bookId}`);
}

export async function returnLoanAction(loanId: number, copyId: number) {
  const today = new Date().toISOString().slice(0, 10);
  const copy = await getCopy(copyId);
  db.transaction((tx) => {
    tx.update(loans)
      .set({
        dateReturned: today,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(eq(loans.id, loanId), isNull(loans.dateReturned)),
      )
      .run();
    tx.update(copies)
      .set({ status: "available", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(copies.id, copyId))
      .run();
  });
  revalidatePath("/loans");
  revalidatePath("/catalog");
  if (copy) revalidatePath(`/books/${copy.bookId}`);
}

// ── ISBN lookup ──────────────────────────────────────────────────────────────

export async function lookupIsbnAction(formData: FormData) {
  const isbn = normalizeIsbn(String(formData.get("isbn") ?? ""));
  if (!isbn) redirect("/books/new");
  const metadata = await lookupBookMetadata(isbn);
  const coverImagePath = await cacheCover(
    metadata?.coverUrl,
    metadata?.isbn13 ?? metadata?.isbn10 ?? isbn,
  );
  const params = new URLSearchParams();
  const values = { ...metadata, coverImagePath };
  for (const [key, value] of Object.entries(values)) {
    if (value && key !== "coverUrl") params.set(key, String(value));
  }
  params.set("isbn", isbn);
  redirect(`/books/new?${params.toString()}`);
}

// ── CSV import: locations ────────────────────────────────────────────────────

export async function importLocationsAction(formData: FormData) {
  const rows = await readCsvRows(formData);
  let imported = 0;

  for (const row of rows) {
    const level = row.level?.trim();
    const room = row.room?.trim();
    const bookshelf = row.bookshelf?.trim();
    const shelfRow = Number(row.shelfRow ?? row.shelf_row);
    const depth = (row.depth?.trim() || "front") as ShelfDepth;
    if (!level || !room || !bookshelf || !Number.isFinite(shelfRow) || shelfRow < 1 || !["front", "back"].includes(depth))
      continue;

    // Ensure level exists
    let levelRow = await db.query.houseLevels.findFirst({
      where: eq(houseLevels.name, level),
    });
    if (!levelRow) {
      [levelRow] = await db
        .insert(houseLevels)
        .values({ name: level, sortOrder: 0 })
        .returning();
    }

    // Ensure room exists
    let roomRow = await db.query.rooms.findFirst({
      where: and(eq(rooms.levelId, levelRow.id), eq(rooms.name, room)),
    });
    if (!roomRow) {
      [roomRow] = await db
        .insert(rooms)
        .values({ levelId: levelRow.id, name: room, sortOrder: 0 })
        .returning();
    }

    // Ensure bookshelf exists
    let bsRow = await db.query.bookshelves.findFirst({
      where: and(eq(bookshelves.roomId, roomRow.id), eq(bookshelves.name, bookshelf)),
    });
    if (!bsRow) {
      [bsRow] = await db
        .insert(bookshelves)
        .values({
          roomId: roomRow.id,
          name: bookshelf,
          rowCount: Math.max(shelfRow, 1),
          depthCount: depthCountForDepth(depth),
        })
        .returning();
    }

    const rowCount = Math.max(bsRow.rowCount, shelfRow);
    const depthCount = Math.max(bsRow.depthCount, depthCountForDepth(depth));
    if (rowCount !== bsRow.rowCount || depthCount !== bsRow.depthCount) {
      await db
        .update(bookshelves)
        .set({ rowCount, depthCount, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(bookshelves.id, bsRow.id));
      bsRow = { ...bsRow, rowCount, depthCount };
    }

    await repairBookshelfLocations(bsRow.id, bsRow.rowCount, bsRow.depthCount);

    // Ensure the specific location row exists
    await db
      .insert(locations)
      .values({
        bookshelfId: bsRow.id,
        shelfRow,
        depth,
        notes: row.notes || null,
        sortOrder: Number(row.sortOrder) || 0,
      })
      .onConflictDoNothing();
    imported += 1;
  }

  revalidatePath("/locations");
  redirect(`/import-export?imported=${imported}&kind=locations`);
}

async function repairBookshelfLocations(bookshelfId: number, rowCount: number, depthCount: number) {
  const existingLocRows = await db
    .select({ shelfRow: locations.shelfRow, depth: locations.depth })
    .from(locations)
    .where(eq(locations.bookshelfId, bookshelfId));
  const existingSet = new Set(existingLocRows.map((location) => shelfSpotKey(location.shelfRow, location.depth)));
  for (const spot of desiredShelfSpots(rowCount, depthCount)) {
    if (!existingSet.has(shelfSpotKey(spot.shelfRow, spot.depth))) {
      await db.insert(locations).values({ bookshelfId, ...spot }).run();
    }
  }
}

// ── CSV import: books ────────────────────────────────────────────────────────

export async function importBooksAction(formData: FormData) {
  const rows = await readCsvRows(formData);
  let imported = 0;
  for (const row of rows) {
    const parsed = bookSchema.safeParse({
      title: row.title,
      author: row.author,
      isbn10: row.isbn10,
      isbn13: row.isbn13,
      subtitle: row.subtitle,
      publisher: row.publisher,
      publishedDate: row.publishedDate ?? row.published_date,
      description: row.description,
      pageCount: row.pageCount ?? row.page_count ?? "",
      categories: row.categories,
      seriesName: row.seriesName ?? row.series_name,
      seriesNumber: row.seriesNumber ?? row.series_number,
      coverImagePath: row.coverImagePath ?? row.cover_image_path,
      metadataSource: row.metadataSource ?? row.metadata_source ?? "CSV import",
    });
    if (!parsed.success) continue;
    const isbn13 = parsed.data.isbn13;
    const isbn10 = parsed.data.isbn10;
    const existing = isbn13
      ? await db.query.books.findFirst({ where: eq(books.isbn13, isbn13) })
      : isbn10
        ? await db.query.books.findFirst({ where: eq(books.isbn10, isbn10) })
        : undefined;
    if (!existing) {
      await db.insert(books).values(parsed.data);
      imported += 1;
    }
  }
  revalidatePath("/catalog");
  redirect(`/import-export?imported=${imported}&kind=books`);
}

// ── CSV import: copies ───────────────────────────────────────────────────────

export async function importCopiesAction(formData: FormData) {
  const rows = await readCsvRows(formData);
  let imported = 0;
  for (const row of rows) {
    const isbn13 = row.isbn13 || row.isbn_13;
    const isbn10 = row.isbn10 || row.isbn_10;
    const title = row.bookTitle || row.title;
    const book = isbn13
      ? await db.query.books.findFirst({ where: eq(books.isbn13, isbn13) })
      : isbn10
        ? await db.query.books.findFirst({ where: eq(books.isbn10, isbn10) })
        : title
          ? await db.query.books.findFirst({ where: eq(books.title, title) })
          : undefined;
    if (!book) continue;

    // Find location by level / room / bookshelf / shelfRow / depth
    const level = row.level?.trim();
    const room = row.room?.trim();
    const bookshelf = row.bookshelf?.trim();
    const shelfRow = Number(row.shelfRow ?? row.shelf_row);
    const depth = row.depth?.trim() || "front";
    if (!level || !room || !bookshelf || !Number.isFinite(shelfRow) || shelfRow < 1 || !["front", "back"].includes(depth)) continue;

    const location = await db
      .select({ id: locations.id })
      .from(locations)
      .innerJoin(bookshelves, eq(locations.bookshelfId, bookshelves.id))
      .innerJoin(rooms, eq(bookshelves.roomId, rooms.id))
      .innerJoin(houseLevels, eq(rooms.levelId, houseLevels.id))
      .where(
        and(
          eq(houseLevels.name, level),
          eq(rooms.name, room),
          eq(bookshelves.name, bookshelf),
          eq(locations.shelfRow, shelfRow),
          eq(locations.depth, depth as "front" | "back"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);
    if (!location) continue;

    const copyNumber =
      row.copyNumber || row.copy_number
        ? Number(row.copyNumber || row.copy_number)
        : await nextCopyNumber(book.id);
    if (!Number.isFinite(copyNumber) || copyNumber < 1) continue;
    await db
      .insert(copies)
      .values({
        bookId: book.id,
        locationId: location.id,
        copyNumber,
        notes: row.notes || null,
        conditionNotes: row.conditionNotes || row.condition_notes || null,
        status: "available",
      })
      .onConflictDoNothing();
    imported += 1;
  }
  revalidatePath("/catalog");
  revalidatePath("/locations");
  redirect(`/import-export?imported=${imported}&kind=copies`);
}
