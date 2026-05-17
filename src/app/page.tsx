import Link from "next/link";
import { BookOpen, HandHeart, Home as HomeIcon, Layers3, LibraryBig, MapPinned, PackagePlus } from "lucide-react";
import { getHouseMap, getLoans, getRecentBooks, getStats } from "@/lib/data";
import { ButtonLink, Card, CoverArt, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [stats, recentBooks, activeLoans, houseMap] = await Promise.all([
    getStats(),
    getRecentBooks(),
    getLoans(true),
    getHouseMap(),
  ]);
  return (
    <>
      <PageHeader eyebrow="Welcome home" title="Your cozy shelf map">
        <ButtonLink href="/scan">Add or scan a book</ButtonLink>
      </PageHeader>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Books" value={stats.books} icon={<BookOpen />} />
        <Stat label="Copies" value={stats.copies} icon={<PackagePlus />} />
        <Stat label="Locations" value={stats.locations} icon={<MapPinned />} />
        <Stat label="Active loans" value={stats.activeLoans} icon={<HandHeart />} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <HouseOverview houseMap={houseMap} />

        <Card>
          <h2 className="font-serif text-2xl font-bold">Active loans</h2>
          <div className="mt-4 space-y-3">
            {activeLoans.length ? activeLoans.slice(0, 5).map(({ loan, book, copy }) => (
              <Link className="block rounded-2xl bg-white/60 p-3 hover:bg-white" href="/loans" key={loan.id}>
                <strong>{book.title}</strong> <span className="text-sm text-[#704b38]">copy #{copy.copyNumber}</span>
                <p className="text-sm text-[#704b38]">Loaned to {loan.borrowerName}</p>
              </Link>
            )) : <EmptyState title="No books are out right now." />}
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 font-serif text-3xl font-bold">Recently added</h2>
        {recentBooks.length ? (
          <div className="grid gap-4 md:grid-cols-3">
            {recentBooks.map((book) => <BookMiniCard key={book.id} book={book} />)}
          </div>
        ) : <EmptyState title="No books yet."><Link className="underline" href="/scan">Add the first one</Link></EmptyState>}
      </section>
    </>
  );
}

function HouseOverview({
  houseMap,
}: {
  houseMap: Awaited<ReturnType<typeof getHouseMap>>;
}) {
  const totalRooms = houseMap.reduce((sum, level) => sum + level.rooms.length, 0);
  const totalShelves = houseMap.reduce(
    (sum, level) => sum + level.rooms.reduce((roomSum, room) => roomSum + room.bookshelves.length, 0),
    0,
  );

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-[#fff8e8] via-[#f8e4c2] to-[#f1cf9d]">
      <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-[#dca36b]/30 blur-2xl" />
      <div className="absolute bottom-6 right-8 hidden text-[#704b38]/10 md:block"><HomeIcon size={140} strokeWidth={1.3} /></div>

      <div className="relative">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8f5f3f]">House view</p>
            <h2 className="mt-3 font-serif text-3xl font-black">Choose a floor, room, or bookcase</h2>
            <p className="mt-3 max-w-2xl text-[#704b38]">
              Start from the warm little map, then jump straight into the shelf browser or filter the catalog by floor.
            </p>
          </div>
          <div className="flex gap-2 text-center">
            <MiniMetric value={totalRooms} label="rooms" />
            <MiniMetric value={totalShelves} label="bookcases" />
          </div>
        </div>

        {houseMap.length ? (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {houseMap.map(({ level, rooms }) => {
              const shelfCount = rooms.reduce((sum, room) => sum + room.bookshelves.length, 0);
              const copyCount = rooms.reduce(
                (sum, room) => sum + room.bookshelves.reduce((bookSum, shelf) => bookSum + shelf.copyCount, 0),
                0,
              );
              return (
                <article key={level.id} className="rounded-[1.75rem] border border-[#c58f61]/35 bg-white/55 p-4 shadow-inner shadow-white/50 backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-2xl bg-[#704b38] p-3 text-[#fff8e8]"><HomeIcon size={22} /></span>
                      <div>
                        <h3 className="font-serif text-2xl font-black text-[#44291f]">{level.name}</h3>
                        <p className="text-sm font-bold text-[#704b38]">{rooms.length} rooms · {shelfCount} bookcases · {copyCount} books</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link className="rounded-full bg-[#fffaf0] px-3 py-2 text-xs font-black uppercase tracking-wider text-[#704b38] shadow-sm transition hover:-translate-y-0.5 hover:bg-white" href={`/catalog?levelName=${encodeURIComponent(level.name)}`}>Catalog</Link>
                      <Link className="rounded-full bg-[#5e7d50] px-3 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#4f6d43]" href="/locations">Map</Link>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {rooms.map(({ room, bookshelves }) => (
                      <div key={room.id} className="rounded-[1.25rem] bg-[#fffaf0]/75 p-3">
                        <div className="mb-3 flex items-center gap-2 text-[#704b38]">
                          <Layers3 size={17} />
                          <h4 className="font-serif text-xl font-bold text-[#44291f]">{room.name}</h4>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {bookshelves.map(({ bookshelf, locations, copyCount: shelfCopies }) => (
                            <Link
                              key={bookshelf.id}
                              href={locations[0] ? `/locations?location=${locations[0].id}` : "/locations"}
                              className="group rounded-2xl border border-[#d2ad84]/50 bg-white/65 p-3 transition hover:-translate-y-0.5 hover:border-[#8f5f3f]/50 hover:bg-white hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 text-[#44291f]"><LibraryBig size={16} className="text-[#8f5f3f]" /><span className="font-bold">{bookshelf.name}</span></div>
                                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[#8f6b52]">{bookshelf.rowCount} rows · {bookshelf.depthCount} deep</p>
                                </div>
                                <span className="rounded-full bg-[#5e7d50]/10 px-2.5 py-1 text-xs font-black text-[#5e7d50] group-hover:bg-[#5e7d50] group-hover:text-white">{shelfCopies}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No shelves mapped yet."><Link className="underline" href="/locations">Build the first room</Link></EmptyState>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href="/locations" variant="secondary">Browse full house map</ButtonLink>
          <ButtonLink href="/catalog" variant="secondary">Search all books</ButtonLink>
        </div>
      </div>
    </Card>
  );
}

function MiniMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-4 py-3 shadow-inner shadow-white/70">
      <p className="text-2xl font-black text-[#44291f]">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-[#8f6b52]">{label}</p>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <Card><div className="text-[#8f5f3f]">{icon}</div><p className="mt-3 text-4xl font-black">{value}</p><p className="text-sm font-bold uppercase tracking-widest text-[#704b38]">{label}</p></Card>;
}

function BookMiniCard({ book }: { book: { id: number; title: string; author: string; coverImagePath: string | null } }) {
  return <Link href={`/books/${book.id}`} className="cozy-card block hover:-translate-y-0.5 transition"><CoverArt src={book.coverImagePath} title={book.title} className="h-36" /><h3 className="mt-3 font-bold">{book.title}</h3><p className="text-sm text-[#704b38]">{book.author}</p></Link>;
}
