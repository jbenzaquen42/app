import { and, count, desc, eq, isNull, like, max, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  books,
  bookshelfDefinitions,
  bookshelves,
  copies,
  houseLevels,
  loans,
  locations,
  rooms,
} from "./schema";
import type { Bookshelf, HouseLevel, Room } from "./schema";

// ── Display types ───────────────────────────────────────────────────────────

export type LocationDisplay = {
  id: number;
  levelName: string;
  roomName: string;
  bookshelfName: string;
  shelfRow: number;
  depth: string;
  displayPath: string;
  notes: string | null;
  sortOrder: number;
  copyCount?: number;
};

export type CatalogFilters = {
  q?: string;
  status?: string;
  levelId?: number;
  levelName?: string;
  roomId?: number;
  bookshelfId?: number;
  shelfRow?: number;
  depth?: string;
};

export type BookCopyDisplay = {
  id: number;
  bookId: number;
  copyNumber: number;
  status: string;
  notes: string | null;
  conditionNotes: string | null;
  locationId: number;
  levelName: string;
  roomName: string;
  bookshelfName: string;
  shelfRow: number;
  depth: string;
};

// ── Location-specific helpers ───────────────────────────────────────────────

const locationDisplayCols = {
  id: locations.id,
  levelName: houseLevels.name,
  roomName: rooms.name,
  bookshelfName: bookshelves.name,
  shelfRow: locations.shelfRow,
  depth: locations.depth,
  displayPath: sql<string>`${houseLevels.name} || ' / ' || ${rooms.name} || ' / ' || ${bookshelves.name} || ' / Row ' || ${locations.shelfRow} || ' ' || ${locations.depth}`,
  notes: locations.notes,
  sortOrder: locations.sortOrder,
} as const;

function locationDisplayQuery() {
  return db
    .select(locationDisplayCols)
    .from(locations)
    .innerJoin(bookshelves, eq(locations.bookshelfId, bookshelves.id))
    .innerJoin(rooms, eq(bookshelves.roomId, rooms.id))
    .innerJoin(houseLevels, eq(rooms.levelId, houseLevels.id));
}

export async function getLocations(): Promise<LocationDisplay[]> {
  return locationDisplayQuery().orderBy(
    houseLevels.sortOrder,
    rooms.sortOrder,
    bookshelves.sortOrder,
    locations.shelfRow,
    locations.depth,
  );
}

export async function getLocation(
  id: number,
): Promise<LocationDisplay | undefined> {
  const rows = await locationDisplayQuery()
    .where(eq(locations.id, id))
    .limit(1);
  return rows[0];
}

/** Nested tree: level → room → bookshelf → LocationDisplay[] */
export async function getLocationTree() {
  const rows = await getLocations();
  return rows.reduce<
    Record<string, Record<string, Record<string, LocationDisplay[]>>>
  >((tree, location) => {
    tree[location.levelName] ??= {};
    tree[location.levelName][location.roomName] ??= {};
    tree[location.levelName][location.roomName][location.bookshelfName] ??= [];
    tree[location.levelName][location.roomName][location.bookshelfName].push(
      location,
    );
    return tree;
  }, {});
}

/** Full house map: levels → rooms → bookshelves → locations (with copy counts). */
export async function getHouseMap() {
  const [levels, locationCopyCountRows, bookshelfCopyCountRows] = await Promise.all([
    db.select().from(houseLevels).orderBy(houseLevels.sortOrder),
    db.select({ locationId: copies.locationId, value: count() }).from(copies).groupBy(copies.locationId),
    db
      .select({ bookshelfId: locations.bookshelfId, value: count() })
      .from(copies)
      .innerJoin(locations, eq(copies.locationId, locations.id))
      .groupBy(locations.bookshelfId),
  ]);
  const locationCopyCounts = new Map(locationCopyCountRows.map((row) => [row.locationId, row.value]));
  const bookshelfCopyCounts = new Map(bookshelfCopyCountRows.map((row) => [row.bookshelfId, row.value]));
  const result: Array<{
    level: HouseLevel;
    rooms: Array<{
      room: Room;
      bookshelves: Array<{
        bookshelf: Bookshelf;
        locations: LocationDisplay[];
        copyCount: number;
      }>;
    }>;
  }> = [];

  for (const level of levels) {
    const levelRooms = await getRooms(level.id);
    const roomsWithShelves = [];
    for (const room of levelRooms) {
      const roomBookshelves = await getBookshelves(room.id);
      const shelvesWithLocs = [];
      for (const bs of roomBookshelves) {
        const bsLocs = await locationDisplayQuery()
          .where(eq(locations.bookshelfId, bs.id))
          .orderBy(locations.shelfRow, locations.depth);
        const bsLocsWithCounts = bsLocs.map((location) => ({
          ...location,
          copyCount: locationCopyCounts.get(location.id) ?? 0,
        }));
        shelvesWithLocs.push({
          bookshelf: bs,
          locations: bsLocsWithCounts,
          copyCount: bookshelfCopyCounts.get(bs.id) ?? 0,
        });
      }
      roomsWithShelves.push({ room, bookshelves: shelvesWithLocs });
    }
    result.push({ level, rooms: roomsWithShelves });
  }
  return result;
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export async function getCatalog(filters: CatalogFilters = {}) {
  const q = filters.q?.trim();
  const predicates: ReturnType<typeof eq>[] = [];

  if (q) {
    const term = `%${q}%`;
    predicates.push(
      or(
        like(books.title, term),
        like(books.author, term),
        like(books.isbn10, term),
        like(books.isbn13, term),
        like(books.seriesName, term),
        like(books.categories, term),
        like(houseLevels.name, term),
        like(rooms.name, term),
        like(bookshelves.name, term),
        like(sql`CAST(${locations.shelfRow} AS TEXT)`, term),
        like(locations.depth, term),
      )!,
    );
  }
  if (filters.status && filters.status !== "all")
    predicates.push(
      eq(copies.status, filters.status as "available" | "loaned"),
    );
  if (filters.levelId) predicates.push(eq(houseLevels.id, filters.levelId));
  if (filters.levelName) predicates.push(eq(houseLevels.name, filters.levelName));
  if (filters.roomId) predicates.push(eq(rooms.id, filters.roomId));
  if (filters.bookshelfId)
    predicates.push(eq(bookshelves.id, filters.bookshelfId));
  if (filters.shelfRow)
    predicates.push(eq(locations.shelfRow, filters.shelfRow));
  if (filters.depth) predicates.push(eq(locations.depth, filters.depth as "front" | "back"));

  return db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      isbn10: books.isbn10,
      isbn13: books.isbn13,
      coverImagePath: books.coverImagePath,
      categories: books.categories,
      seriesName: books.seriesName,
      copyCount: count(copies.id),
      loanedCount:
        sql<number>`sum(case when ${copies.status} = 'loaned' then 1 else 0 end)`,
    })
    .from(books)
    .leftJoin(copies, eq(copies.bookId, books.id))
    .leftJoin(locations, eq(copies.locationId, locations.id))
    .leftJoin(bookshelves, eq(locations.bookshelfId, bookshelves.id))
    .leftJoin(rooms, eq(bookshelves.roomId, rooms.id))
    .leftJoin(houseLevels, eq(rooms.levelId, houseLevels.id))
    .where(predicates.length ? and(...predicates) : undefined)
    .groupBy(books.id)
    .orderBy(books.title);
}

// ── Stats ───────────────────────────────────────────────────────────────────

export async function getStats() {
  const [bookCount] = await db
    .select({ value: count() })
    .from(books);
  const [copyCount] = await db
    .select({ value: count() })
    .from(copies);
  const [locationCount] = await db
    .select({ value: count() })
    .from(locations);
  const [activeLoanCount] = await db
    .select({ value: count() })
    .from(loans)
    .where(isNull(loans.dateReturned));
  return {
    books: bookCount.value,
    copies: copyCount.value,
    locations: locationCount.value,
    activeLoans: activeLoanCount.value,
  };
}

// ── Books ───────────────────────────────────────────────────────────────────

export async function getRecentBooks(limit = 6) {
  return db
    .select()
    .from(books)
    .orderBy(desc(books.createdAt))
    .limit(limit);
}

export async function getBook(id: number) {
  return db.query.books.findFirst({ where: eq(books.id, id) });
}

// ── Copies ──────────────────────────────────────────────────────────────────

export async function getBookCopies(bookId: number): Promise<BookCopyDisplay[]> {
  return db
    .select({
      id: copies.id,
      bookId: copies.bookId,
      copyNumber: copies.copyNumber,
      status: copies.status,
      notes: copies.notes,
      conditionNotes: copies.conditionNotes,
      locationId: locations.id,
      levelName: houseLevels.name,
      roomName: rooms.name,
      bookshelfName: bookshelves.name,
      shelfRow: locations.shelfRow,
      depth: locations.depth,
    })
    .from(copies)
    .innerJoin(locations, eq(copies.locationId, locations.id))
    .innerJoin(bookshelves, eq(locations.bookshelfId, bookshelves.id))
    .innerJoin(rooms, eq(bookshelves.roomId, rooms.id))
    .innerJoin(houseLevels, eq(rooms.levelId, houseLevels.id))
    .where(eq(copies.bookId, bookId))
    .orderBy(copies.copyNumber);
}

export async function getCopy(id: number) {
  return db.query.copies.findFirst({ where: eq(copies.id, id) });
}

export async function getCopiesAtLocation(locationId: number) {
  return db
    .select({ copy: copies, book: books })
    .from(copies)
    .innerJoin(books, eq(copies.bookId, books.id))
    .where(eq(copies.locationId, locationId))
    .orderBy(books.title, copies.copyNumber);
}

export async function nextCopyNumber(bookId: number) {
  const [row] = await db
    .select({ value: max(copies.copyNumber) })
    .from(copies)
    .where(eq(copies.bookId, bookId));
  return (row.value ?? 0) + 1;
}

// ── House hierarchy helpers ─────────────────────────────────────────────────

export async function getHouseLevels() {
  return db.select().from(houseLevels).orderBy(houseLevels.sortOrder);
}

export async function getRooms(levelId?: number) {
  const where = levelId ? eq(rooms.levelId, levelId) : undefined;
  return db
    .select()
    .from(rooms)
    .where(where)
    .orderBy(rooms.sortOrder);
}

export async function getBookshelves(roomId?: number) {
  const where = roomId ? eq(bookshelves.roomId, roomId) : undefined;
  return db
    .select()
    .from(bookshelves)
    .where(where)
    .orderBy(bookshelves.sortOrder);
}

export async function getBookshelfDefinitions() {
  return db
    .select()
    .from(bookshelfDefinitions)
    .orderBy(bookshelfDefinitions.sortOrder);
}

// ── Loans ───────────────────────────────────────────────────────────────────

export async function getLoans(activeOnly = false) {
  const predicate = activeOnly ? isNull(loans.dateReturned) : undefined;
  return db
    .select({ loan: loans, copy: copies, book: books })
    .from(loans)
    .innerJoin(copies, eq(loans.copyId, copies.id))
    .innerJoin(books, eq(copies.bookId, books.id))
    .where(predicate)
    .orderBy(desc(loans.dateLoaned));
}

export async function getLoanHistoryForBook(bookId: number) {
  return db
    .select({ loan: loans, copy: copies })
    .from(loans)
    .innerJoin(copies, eq(loans.copyId, copies.id))
    .where(eq(copies.bookId, bookId))
    .orderBy(desc(loans.dateLoaned));
}

export async function getActiveLoanForCopy(copyId: number) {
  return db.query.loans.findFirst({
    where: and(eq(loans.copyId, copyId), isNull(loans.dateReturned)),
  });
}
