import { BookForm } from "@/components/book-form";
import { LocationForm } from "@/components/location-form";
import { Card, PageHeader } from "@/components/ui";
import { getBookshelfDefinitions, getHouseLevels, getLocations, getRooms } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewBookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const [locations, levels, rooms, bookshelfDefinitions] = await Promise.all([
    getLocations(),
    getHouseLevels(),
    getRooms(),
    getBookshelfDefinitions(),
  ]);
  const initialValues = params.title
    ? {
        title: params.title ?? "",
        author: params.author ?? "",
        isbn10: params.isbn10 ?? null,
        isbn13: params.isbn13 ?? params.isbn ?? null,
        subtitle: params.subtitle ?? null,
        publisher: params.publisher ?? null,
        publishedDate: params.publishedDate ?? null,
        description: params.description ?? null,
        pageCount: params.pageCount ? Number(params.pageCount) : null,
        categories: params.categories ?? null,
        seriesName: params.seriesName ?? null,
        seriesNumber: params.seriesNumber ?? null,
        coverImagePath: params.coverImagePath ?? null,
        metadataSource: params.metadataSource ?? null,
      }
    : null;
  return (
    <>
      <PageHeader eyebrow="Add book" title="Save a new favorite" />
      {locations.length === 0 ? (
        <Card className="mb-6">
          <h2 className="font-serif text-2xl font-bold">
            Create a location first
          </h2>
          <p className="mb-4 text-[#704b38]">
            Each physical copy needs a shelf spot.
          </p>
          <LocationForm levels={levels} rooms={rooms} bookshelfDefinitions={bookshelfDefinitions} />
        </Card>
      ) : null}
      {locations.length ? (
        <BookForm initialValues={initialValues} locations={locations} initialLocationId={params.locationId ? Number(params.locationId) : undefined} />
      ) : null}
    </>
  );
}
