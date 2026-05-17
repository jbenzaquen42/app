import Papa from "papaparse";
import { getCatalog, getLoans, getLocations } from "./data";
import { db } from "./db";
import { books, bookshelves, copies, houseLevels, locations, rooms } from "./schema";
import { eq } from "drizzle-orm";

export async function exportBooksCsv() {
  const rows = await getCatalog({});
  return Papa.unparse(rows);
}

export async function exportLocationsCsv() {
  const rows = await getLocations();
  return Papa.unparse(
    rows.map((loc) => ({
      level: loc.levelName,
      room: loc.roomName,
      bookshelf: loc.bookshelfName,
      shelfRow: loc.shelfRow,
      depth: loc.depth,
      notes: loc.notes,
      sortOrder: loc.sortOrder,
    })),
  );
}

export async function exportLoansCsv() {
  return Papa.unparse(
    (await getLoans(false)).map(({ loan, copy, book }) => ({
      ...loan,
      bookTitle: book.title,
      copyNumber: copy.copyNumber,
    })),
  );
}

export async function exportCopiesCsv() {
  const rows = await db
    .select({
      copy: copies,
      book: books,
      location: locations,
      levelName: houseLevels.name,
      roomName: rooms.name,
      bookshelfName: bookshelves.name,
    })
    .from(copies)
    .innerJoin(books, eq(copies.bookId, books.id))
    .innerJoin(locations, eq(copies.locationId, locations.id))
    .innerJoin(bookshelves, eq(locations.bookshelfId, bookshelves.id))
    .innerJoin(rooms, eq(bookshelves.roomId, rooms.id))
    .innerJoin(houseLevels, eq(rooms.levelId, houseLevels.id));

  return Papa.unparse(
    rows.map(({ copy, book, location, levelName, roomName, bookshelfName }) => ({
      ...copy,
      bookTitle: book.title,
      isbn13: book.isbn13,
      level: levelName,
      room: roomName,
      bookshelf: bookshelfName,
      shelfRow: location.shelfRow,
      depth: location.depth,
    })),
  );
}
