import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createCopyAction,
  createLoanAction,
  deleteBookAction,
  deleteCopyAction,
} from "@/app/actions";
import { getBook, getBookCopies, getLoanHistoryForBook, getLocations } from "@/lib/data";
import { Card, CoverArt, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { LocationPicker } from "@/components/location-picker";

export default async function BookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookId = Number(id);
  const [book, copies, locations, history] = await Promise.all([
    getBook(bookId),
    getBookCopies(bookId),
    getLocations(),
    getLoanHistoryForBook(bookId),
  ]);

  if (!book) notFound();

  return (
    <>
      <PageHeader eyebrow="Book" title={book.title}>
        <Link className="btn-secondary" href={`/books/${book.id}/edit`}>
          Edit
        </Link>
        <form action={deleteBookAction.bind(null, book.id)}>
          <ConfirmSubmitButton
            message={`Delete ${book.title} and all of its copies?`}
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </PageHeader>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CoverArt
            src={book.coverImagePath}
            title={book.title}
            className="mb-4 h-72"
          />
          <h2 className="font-serif text-3xl font-bold">{book.title}</h2>
          <p className="text-lg text-[#704b38]">{book.author}</p>
          {book.description ? (
            <p className="mt-3 text-sm text-[#704b38]">{book.description}</p>
          ) : null}
          {book.metadataSource ? (
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#8f5f3f]">
              Source: {book.metadataSource}
            </p>
          ) : null}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-serif text-2xl font-bold">Copies</h2>
            <div className="mt-4 space-y-3">
              {copies.map((copy) => (
                <div key={copy.id} className="rounded-2xl bg-white/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <strong>Copy #{copy.copyNumber}</strong>{" "}
                      <span className="rounded-full bg-[#e7d1aa] px-2 py-1 text-xs font-bold">
                        {copy.status}
                      </span>
                      <p className="text-sm text-[#704b38]">
                        {copy.levelName} / {copy.roomName} /{" "}
                        {copy.bookshelfName} / Row {copy.shelfRow} {copy.depth}
                      </p>
                      {copy.notes ? (
                        <p className="mt-1 text-sm text-[#704b38]">
                          Notes: {copy.notes}
                        </p>
                      ) : null}
                    </div>
                    <form
                      action={deleteCopyAction.bind(null, copy.id, book.id)}
                    >
                      <ConfirmSubmitButton
                        message={`Remove copy #${copy.copyNumber}?`}
                      >
                        Remove
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                  {copy.status === "available" ? (
                    <form
                      action={createLoanAction}
                      className="mt-4 grid gap-2 md:grid-cols-4"
                    >
                      <input type="hidden" name="copyId" value={copy.id} />
                      <input
                        className="field-input"
                        name="borrowerName"
                        placeholder="Borrower"
                        required
                      />
                      <input
                        className="field-input"
                        name="dateLoaned"
                        type="date"
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        required
                      />
                      <input
                        className="field-input"
                        name="contactInfo"
                        placeholder="Contact optional"
                      />
                      <button className="btn-primary">Loan out</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>

            <form
              action={createCopyAction}
              className="mt-5 grid gap-3 rounded-2xl bg-[#f3dfbd]/50 p-4"
            >
              <input type="hidden" name="bookId" value={book.id} />
              <LocationPicker locations={locations} defaultValue={copies[0]?.locationId} />
              <input
                className="field-input"
                name="notes"
                placeholder="Copy notes"
              />
              <button className="btn-primary">Add copy</button>
            </form>
          </Card>

          <Card>
            <h2 className="font-serif text-2xl font-bold">Loan history</h2>
            <div className="mt-3 space-y-2">
              {history.map(({ loan, copy }) => (
                <p
                  key={loan.id}
                  className="rounded-xl bg-white/60 p-3 text-sm"
                >
                  Copy #{copy.copyNumber} loaned to{" "}
                  <strong>{loan.borrowerName}</strong> on {loan.dateLoaned}
                  {loan.dateReturned
                    ? `, returned ${loan.dateReturned}`
                    : ""}
                </p>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
