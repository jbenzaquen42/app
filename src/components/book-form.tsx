import { createBookAction, updateBookAction } from "@/app/actions";
import type { Book } from "@/lib/schema";
import type { LocationDisplay } from "@/lib/data";
import { Field, SubmitButton, TextArea } from "./ui";
import { LocationPicker } from "./location-picker";

export type BookFormValues = Partial<Omit<Book, "id" | "createdAt" | "updatedAt">>;

export function BookForm({
  book,
  initialValues,
  locations,
  initialLocationId,
}: {
  book?: Book | null;
  initialValues?: BookFormValues | null;
  locations: LocationDisplay[];
  initialLocationId?: number;
}) {
  const values = book ?? initialValues;
  const action = book ? updateBookAction.bind(null, book.id) : createBookAction;
  return (
    <form action={action} className="cozy-card grid gap-4 md:grid-cols-2">
      <SectionHeading title="Basics" />
      <Field label="Title" name="title" required defaultValue={values?.title} />
      <Field label="Author" name="author" required defaultValue={values?.author} />
      <TextArea label="Description" name="description" defaultValue={values?.description} />

      <SectionHeading title="Publishing" />
      <Field label="ISBN-13" name="isbn13" defaultValue={values?.isbn13} />
      <Field label="ISBN-10" name="isbn10" defaultValue={values?.isbn10} />
      <Field label="Subtitle" name="subtitle" defaultValue={values?.subtitle} />
      <Field label="Publisher" name="publisher" defaultValue={values?.publisher} />
      <Field label="Published date" name="publishedDate" defaultValue={values?.publishedDate} />
      <Field label="Page count" name="pageCount" type="number" defaultValue={values?.pageCount} />
      <Field label="Categories/tags" name="categories" defaultValue={values?.categories} />

      <SectionHeading title="Series & cover" />
      <Field label="Series" name="seriesName" defaultValue={values?.seriesName} />
      <Field label="Series number" name="seriesNumber" defaultValue={values?.seriesNumber} />
      <Field label="Cover image URL" name="coverImagePath" type="url" placeholder="https://…" defaultValue={values?.coverImagePath} help="Paste a cover URL, or leave blank to use the generated placeholder." />
      <input type="hidden" name="metadataSource" defaultValue={values?.metadataSource ?? "Manual"} />
      {!book ? (
        <>
          <SectionHeading title="Placement" />
        <LocationPicker locations={locations} defaultValue={initialLocationId} />
        </>
      ) : null}
      <div className="md:col-span-2">
        <SubmitButton>{book ? "Save book" : "Create book and first copy"}</SubmitButton>
      </div>
    </form>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="border-t border-[#d2ad84]/60 pt-4 font-serif text-2xl font-bold first:border-t-0 first:pt-0 md:col-span-2">{title}</h2>;
}
