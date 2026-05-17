import Link from "next/link";
import { getCatalog, getLocations } from "@/lib/data";
import { ButtonLink, CoverArt, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [books, locations] = await Promise.all([
    getCatalog(params),
    getLocations(),
  ]);
  const levels = [...new Set(locations.map((l) => l.levelName))];
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Browse the stacks">
        <ButtonLink href="/scan">Add book</ButtonLink>
      </PageHeader>
      <form className="cozy-card mb-6 grid gap-3 md:grid-cols-5">
        <input
          className="field-input md:col-span-2"
          name="q"
          placeholder="Search title, author, ISBN, location…"
          defaultValue={params.q ?? ""}
        />
        <select
          className="field-input"
          name="status"
          defaultValue={params.status ?? "all"}
        >
          <option value="all">All statuses</option>
          <option value="available">Available</option>
          <option value="loaned">Loaned</option>
        </select>
        <select
          className="field-input"
          name="levelName"
          defaultValue={params.levelName ?? ""}
        >
          <option value="">All levels</option>
          {levels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
        <button className="btn-primary">Search</button>
      </form>
      {books.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <Link
              className="cozy-card block hover:-translate-y-0.5 transition"
              key={book.id}
              href={`/books/${book.id}`}
            >
              <div className="flex gap-4">
                <CoverArt
                  src={book.coverImagePath}
                  title={book.title}
                  className="h-28 w-20 shrink-0"
                />
                <div>
                  <h2 className="font-serif text-2xl font-bold">{book.title}</h2>
                  <p className="text-[#704b38]">{book.author}</p>
                  <p className="mt-3 text-sm font-bold text-[#5e7d50]">
                    {book.copyCount} copies · {book.loanedCount || 0} loaned
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No matching books." />
      )}
    </>
  );
}
