import { Download } from "lucide-react";
import {
  importBooksAction,
  importCopiesAction,
  importLocationsAction,
} from "@/app/actions";
import { Card, PageHeader } from "@/components/ui";
import { ImportCsvForm } from "@/components/import-csv-form";

const exports = [
  ["Books", "/api/export/books"],
  ["Copies", "/api/export/copies"],
  ["Locations", "/api/export/locations"],
  ["Loans", "/api/export/loans"],
];

export const dynamic = "force-dynamic";

export default async function ImportExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  return (
    <>
      <PageHeader eyebrow="CSV" title="Backup and move data" />
      {params.imported ? (
        <div className="cozy-card mb-6 border-[#5e7d50]/30 bg-[#eef4df]/80">
          <strong>
            Imported {params.imported} {params.kind} rows.
          </strong>{" "}
          Invalid or duplicate rows may have been skipped.
        </div>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl font-bold">Export CSV files</h2>
          <p className="mt-2 text-[#704b38]">
            Download plain CSV snapshots for books, copies, locations, and
            loans.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {exports.map(([label, href]) => (
              <a key={href} className="btn-secondary" href={href}>
                <Download size={16} /> {label}
              </a>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-serif text-2xl font-bold">Import CSV files</h2>
          <p className="mt-2 text-[#704b38]">
            Import locations first, then books, then copies so copy rows can
            match existing shelf spots and titles/ISBNs. Each file shows a small
            preview before import.
          </p>
          <div className="mt-5 space-y-4">
            <ImportCsvForm
              title="Locations CSV"
              action={importLocationsAction}
              requiredHeaders={["level", "room", "bookshelf", "shelfRow"]}
            />
            <ImportCsvForm
              title="Books CSV"
              action={importBooksAction}
              requiredHeaders={["title", "author"]}
            />
            <ImportCsvForm
              title="Copies CSV"
              action={importCopiesAction}
              requiredHeaders={["level", "room", "bookshelf", "shelfRow"]}
            />
          </div>
          <p className="mt-4 text-sm text-[#704b38]">
            Current import previews the first rows, blocks obviously missing
            headers, and skips invalid or duplicate rows after confirmation. A
            full row-by-row edit screen remains a later polish item.
          </p>
        </Card>
      </section>
    </>
  );
}
