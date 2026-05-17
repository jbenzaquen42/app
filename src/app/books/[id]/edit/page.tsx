import { notFound } from "next/navigation";
import { BookForm } from "@/components/book-form";
import { PageHeader } from "@/components/ui";
import { getBook, getLocations } from "@/lib/data";

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, locations] = await Promise.all([getBook(Number(id)), getLocations()]);
  if (!book) notFound();
  return <><PageHeader eyebrow="Edit" title={book.title} /><BookForm book={book} locations={locations} /></>;
}
