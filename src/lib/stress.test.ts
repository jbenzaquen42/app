import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import Papa from "papaparse";

// Schema is side-effect-free — safe to import statically
import { books, bookshelves, copies, houseLevels, loans, locations, rooms } from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function clearAllTables() {
  const { db } = await import("./db");
  db.delete(loans).run();
  db.delete(copies).run();
  db.delete(locations).run();
  db.delete(bookshelves).run();
  db.delete(rooms).run();
  db.delete(houseLevels).run();
  db.delete(books).run();
}

function locKey(level: string, room: string, bookshelf: string, row: number, depth: string) {
  return `${level}|${room}|${bookshelf}|${row}|${depth}`;
}

/**
 * Seed a location hierarchy and return the generated locations in order.
 */
async function seedHierarchy(
  levelName: string,
  roomName: string,
  bookshelfName: string,
  rowCount: number,
  depthCount: number,
) {
  const { db } = await import("./db");

  let [level] = await db
    .select()
    .from(houseLevels)
    .where(eq(houseLevels.name, levelName))
    .limit(1);
  if (!level) {
    [level] = await db
      .insert(houseLevels)
      .values({ name: levelName, sortOrder: 0 })
      .returning();
  }

  let [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.levelId, level!.id), eq(rooms.name, roomName)))
    .limit(1);
  if (!room) {
    [room] = await db
      .insert(rooms)
      .values({ levelId: level.id, name: roomName, sortOrder: 0 })
      .returning();
  }

  const [bs] = await db
    .insert(bookshelves)
    .values({ roomId: room.id, name: bookshelfName, rowCount, depthCount })
    .returning();

  const result: (typeof locations.$inferSelect)[] = [];
  let sortOrder = 0;
  for (let r = 1; r <= rowCount; r++) {
    const depths = depthCount >= 2 ? (["front", "back"] as const) : (["front"] as const);
    for (const d of depths) {
      const [loc] = await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: r, depth: d, sortOrder: sortOrder++ })
        .returning();
      result.push(loc);
    }
  }
  return { level: level!, room: room!, bookshelf: bs, locations: result };
}

// ---------------------------------------------------------------------------
// Seed data — realistic home library with ~10 books across 8 locations
// ---------------------------------------------------------------------------

/**
 * Each entry describes a hierarchy leaf: [levelName, roomName, bookshelfName, rowCount, depthCount].
 * After seeding we build a flat location-key map for lookup.
 */
const HIERARCHY: [string, string, string, number, number][] = [
  ["Ground",    "Living Room",  "Bookshelf A",   2, 2], // 4 locs: rows 1-2, front/back
  ["Ground",    "Living Room",  "Coffee Table",  1, 1], // 1 loc:  row 1, front
  ["Ground",    "Kitchen",      "Shelf",         1, 1], // 1 loc
  ["Upstairs",  "Bedroom",      "Nightstand",    1, 1], // 1 loc
  ["Upstairs",  "Bedroom",      "Bookshelf",     1, 1], // 1 loc
  ["Upstairs",  "Office",       "Desk",          1, 1], // 1 loc
  ["Basement",  "Storage",      "Box 1",         1, 1], // 1 loc
  ["Basement",  "Storage",      "Box 2",         1, 1], // 1 loc
];

const TOTAL_LOCS = HIERARCHY.reduce((sum, [, , , rc, dc]) => sum + rc * (dc >= 2 ? 2 : 1), 0);

const BOOKS = [
  { title: "Dune",                         author: "Frank Herbert",       isbn13: "9780441172719" },
  { title: "Neuromancer",                  author: "William Gibson",      isbn13: "9780441569595" },
  { title: "Piranesi",                     author: "Susanna Clarke",      isbn13: "9781526622433" },
  { title: "Jonathan Strange & Mr Norrell",author: "Susanna Clarke",      isbn13: "9780765356154" },
  { title: "The Hobbit",                   author: "J.R.R. Tolkien",      isbn13: "9780547928227" },
  { title: "A Game of Thrones",            author: "George R.R. Martin",  isbn13: "9780553593716" },
  { title: "The Name of the Wind",         author: "Patrick Rothfuss",    isbn13: "9780756404741" },
  { title: "The Colour of Magic",          author: "Terry Pratchett",     isbn13: "9780062225672" },
  { title: "Snow Crash",                   author: "Neal Stephenson",     isbn13: "9780553380958" },
  { title: "The Left Hand of Darkness",    author: "Ursula K. Le Guin",   isbn13: "9780441478125" },
] as const;

/**
 * Locations will be seeded in HIERARCHY order, so we can compute indices.
 * Ground/Living Room/Bookshelf A: idx 0=Row1Front, 1=Row1Back, 2=Row2Front, 3=Row2Back
 * Ground/Living Room/Coffee Table: idx 4=Row1Front
 * Ground/Kitchen/Shelf: idx 5=Row1Front
 * Upstairs/Bedroom/Nightstand: idx 6=Row1Front
 * Upstairs/Bedroom/Bookshelf: idx 7=Row1Front
 * Upstairs/Office/Desk: idx 8=Row1Front
 * Basement/Storage/Box 1: idx 9=Row1Front
 * Basement/Storage/Box 2: idx 10=Row1Front
 */

// Each entry: [bookIndex, locIndexInAllLocs, copyNumber, notes?]
const COPIES_CFG: [number, number, number, string?][] = [
  [0, 1, 1],                          // Dune #1  → Living Room Bookshelf A Row1 Back
  [0, 10, 2],                         // Dune #2  → Basement Box 2
  [1, 10, 1],                         // Neuromancer → Basement Box 2
  [2, 0, 1, "Signed by author"],      // Piranesi → Living Room Bookshelf A Row1 Front
  [3, 8, 1, "Hardcover"],             // Jonathan Strange → Office Desk
  [4, 7, 1],                          // The Hobbit #1 → Bedroom Bookshelf
  [4, 9, 2],                          // The Hobbit #2 → Basement Box 1
  [5, 9, 1],                          // Game of Thrones → Basement Box 1
  [6, 6, 1],                          // Name of the Wind → Bedroom Nightstand
  [7, 4, 1],                          // Colour of Magic → Coffee Table
  [8, 10, 1],                         // Snow Crash → Basement Box 2
  [9, 7, 1],                          // Left Hand of Darkness → Bedroom Bookshelf
];

// Loans: [copiesCfgIndex, borrowerName, dateLoaned, dateReturned?]
const LOANS_CFG: [number, string, string, string?][] = [
  [3, "Alice",   "2026-04-01", "2026-04-20"],   // Piranesi → returned
  [8, "Bob",     "2026-05-01"],                  // Name of the Wind → active
  [2, "Charlie", "2026-05-10"],                  // Neuromancer → active
  [4, "Dana",    "2026-03-15", "2026-04-02"],    // The Hobbit #1 → returned
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("stress / integration — realistic user dataset", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cozystacks-stress-"));
    process.env.DATABASE_PATH = path.join(tempDir, "test.sqlite");
    process.env.LIBRARY_DATA_DIR = tempDir;
  });

  afterAll(() => {
    delete process.env.DATABASE_PATH;
    delete process.env.LIBRARY_DATA_DIR;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort on Windows
    }
  });

  beforeEach(async () => {
    vi.resetModules();
    await clearAllTables();
  });

  it("full workflow with 10 books, 11 locations, 12 copies, 4 loans (2 returned, 2 active)", async () => {
    const { db } = await import("./db");
    const data = await import("./data");
    const csvModule = await import("./csv");

    // ===================================================================
    // 1. Seed all location hierarchies
    // ===================================================================
    const allLocs: (typeof locations.$inferSelect)[] = [];
    const locIdMap = new Map<string, number>();

    for (const [levelName, roomName, bsName, rc, dc] of HIERARCHY) {
      const result = await seedHierarchy(levelName, roomName, bsName, rc, dc);
      for (const loc of result.locations) {
        allLocs.push(loc);
        locIdMap.set(locKey(levelName, roomName, bsName, loc.shelfRow, loc.depth), loc.id);
      }
    }
    expect(allLocs).toHaveLength(TOTAL_LOCS);

    const flatLocs = await data.getLocations();
    expect(flatLocs).toHaveLength(TOTAL_LOCS);

    // ===================================================================
    // 2. Insert all books
    // ===================================================================
    const bookIds: number[] = [];
    for (const b of BOOKS) {
      const [row] = await db.insert(books).values(b).returning({ id: books.id });
      bookIds.push(row.id);
    }
    expect(bookIds).toHaveLength(BOOKS.length);

    // ===================================================================
    // 3. Insert all copies (using flat index into allLocs)
    // ===================================================================
    type CopyInfo = { id: number; bookIdx: number; copyNumber: number };
    const insertedCopies: CopyInfo[] = [];

    for (const [bi, li, cn, notes] of COPIES_CFG) {
      const loc = allLocs[li];
      const [row] = await db
        .insert(copies)
        .values({
          bookId: bookIds[bi],
          locationId: loc.id,
          copyNumber: cn,
          notes: notes ?? null,
        })
        .returning({ id: copies.id });
      insertedCopies.push({ id: row.id, bookIdx: bi, copyNumber: cn });
    }
    expect(insertedCopies).toHaveLength(COPIES_CFG.length);

    // ===================================================================
    // 4. Insert loans
    // ===================================================================
    const copyLookup = new Map<string, number>();
    for (const c of insertedCopies) {
      copyLookup.set(`${c.bookIdx}|${c.copyNumber}`, c.id);
    }

    for (const [ci, borrower, dateLoaned, dateReturned] of LOANS_CFG) {
      const [bi, , cn] = COPIES_CFG[ci];
      const copyId = copyLookup.get(`${bi}|${cn}`)!;

      db.transaction((tx) => {
        tx
          .insert(loans)
          .values({ copyId, borrowerName: borrower, dateLoaned, dateReturned: dateReturned ?? null })
          .returning({ id: loans.id })
          .get();
        tx.update(copies)
          .set({ status: dateReturned ? "available" : "loaned" })
          .where(eq(copies.id, copyId))
          .run();
      });
    }

    // ===================================================================
    // 5. Verify dashboard stats
    // ===================================================================
    const stats = await data.getStats();
    expect(stats.books).toBe(10);
    expect(stats.copies).toBe(12);
    expect(stats.locations).toBe(TOTAL_LOCS);
    expect(stats.activeLoans).toBe(2); // Bob + Charlie still out

    // ===================================================================
    // 6. Verify catalog — all books
    // ===================================================================
    const catalogAll = await data.getCatalog({});
    expect(catalogAll).toHaveLength(10);

    // ===================================================================
    // 7. Verify search / filter
    // ===================================================================

    // 7a. Title search
    const duneResult = await data.getCatalog({ q: "Dune" });
    expect(duneResult).toHaveLength(1);
    expect(duneResult[0].title).toBe("Dune");
    expect(duneResult[0].copyCount).toBe(2);
    expect(duneResult[0].loanedCount).toBe(0);

    // 7b. Partial ISBN search
    const isbnResult = await data.getCatalog({ q: "044117" });
    expect(isbnResult).toHaveLength(1);
    expect(isbnResult[0].title).toBe("Dune");

    // 7c. Author search
    const susannaResult = await data.getCatalog({ q: "Susanna" });
    expect(susannaResult).toHaveLength(2);
    expect(susannaResult.map((r) => r.title).sort()).toEqual([
      "Jonathan Strange & Mr Norrell",
      "Piranesi",
    ]);

    // 7d. Level filter by name
    const basementResult = await data.getCatalog({ levelName: "Basement" });
    expect(basementResult).toHaveLength(5);
    expect(basementResult.map((r) => r.title).sort()).toEqual([
      "A Game of Thrones",
      "Dune",
      "Neuromancer",
      "Snow Crash",
      "The Hobbit",
    ]);

    // 7e. Room filter (via roomId — search for Kitchen room)
    const kitchenResult = await data.getCatalog({ roomId: 999 }); // no books in Kitchen
    expect(kitchenResult).toHaveLength(0);

    // 7f. Status filter — loaned
    const loanedResult = await data.getCatalog({ status: "loaned" });
    expect(loanedResult).toHaveLength(2);
    expect(loanedResult.map((r) => r.title).sort()).toEqual([
      "Neuromancer",
      "The Name of the Wind",
    ]);

    // 7g. Status filter — available
    const availableResult = await data.getCatalog({ status: "available" });
    expect(availableResult).toHaveLength(8);

    // ===================================================================
    // 8. Verify loan queries
    // ===================================================================

    const allLoans = await data.getLoans(false);
    expect(allLoans).toHaveLength(4);

    const activeLoans = await data.getLoans(true);
    expect(activeLoans).toHaveLength(2);
    expect(activeLoans.map((l) => l.loan.borrowerName).sort()).toEqual(["Bob", "Charlie"]);

    // Piranesi (returned)
    const piranesiCopy = insertedCopies[3];
    const piranesiActive = await data.getActiveLoanForCopy(piranesiCopy.id);
    expect(piranesiActive).toBeUndefined();

    // Name of the Wind (still out)
    const notwCopy = insertedCopies[8];
    const notwActive = await data.getActiveLoanForCopy(notwCopy.id);
    expect(notwActive).not.toBeUndefined();
    expect(notwActive!.borrowerName).toBe("Bob");
    expect(notwActive!.dateReturned).toBeNull();

    // Loan history for Piranesi
    const piranesiHistory = await data.getLoanHistoryForBook(bookIds[2]);
    expect(piranesiHistory).toHaveLength(1);
    expect(piranesiHistory[0].loan.borrowerName).toBe("Alice");
    expect(piranesiHistory[0].loan.dateReturned).toBe("2026-04-20");

    // Book with no loans
    const duneHistory = await data.getLoanHistoryForBook(bookIds[0]);
    expect(duneHistory).toHaveLength(0);

    // ===================================================================
    // 9. Verify copies at location
    // ===================================================================
    // Living Room Bookshelf A Row1 Back (index 1) → Dune copy 1
    const livingRoomLoc = allLocs[1];
    const copiesAtLoc = await data.getCopiesAtLocation(livingRoomLoc.id);
    expect(copiesAtLoc).toHaveLength(1);
    expect(copiesAtLoc[0].book.title).toBe("Dune");

    // Basement Box 1 (index 9) → The Hobbit copy 2, Game of Thrones
    const basementBox1 = allLocs[9];
    const box1Copies = await data.getCopiesAtLocation(basementBox1.id);
    expect(box1Copies).toHaveLength(2);

    // ===================================================================
    // 10. Verify nextCopyNumber
    // ===================================================================
    expect(await data.nextCopyNumber(bookIds[0])).toBe(3);  // Dune
    expect(await data.nextCopyNumber(bookIds[1])).toBe(2);  // Neuromancer
    expect(await data.nextCopyNumber(9999)).toBe(1);

    // ===================================================================
    // 11. Verify location tree
    // ===================================================================
    const tree = await data.getLocationTree();
    expect(Object.keys(tree).sort()).toEqual(["Basement", "Ground", "Upstairs"]);
    expect(Object.keys(tree.Ground).sort()).toEqual(["Kitchen", "Living Room"]);
    expect(Object.keys(tree.Upstairs).sort()).toEqual(["Bedroom", "Office"]);
    expect(Object.keys(tree.Basement).sort()).toEqual(["Storage"]);

    // Ground/Living Room → 2 bookshelves (Bookshelf A, Coffee Table)
    expect(Object.keys(tree.Ground["Living Room"]).sort()).toEqual([
      "Bookshelf A",
      "Coffee Table",
    ]);

    // ===================================================================
    // 12. Verify CSV exports
    // ===================================================================

    // 12a. exportBooksCsv — 10 rows
    const booksCsv = await csvModule.exportBooksCsv();
    const booksParsed = Papa.parse<Record<string, string>>(booksCsv, { header: true, skipEmptyLines: true });
    expect(booksParsed.data).toHaveLength(10);
    expect(booksParsed.meta.fields).toEqual(
      expect.arrayContaining(["title", "author", "isbn13", "copyCount", "loanedCount"]),
    );

    // 12b. exportLocationsCsv — TOTAL_LOCS rows
    const locsCsv = await csvModule.exportLocationsCsv();
    const locsParsed = Papa.parse(locsCsv, { header: true, skipEmptyLines: true });
    expect(locsParsed.data).toHaveLength(TOTAL_LOCS);
    expect(locsParsed.meta.fields).toEqual(
      expect.arrayContaining(["level", "room", "bookshelf", "shelfRow", "depth"]),
    );

    // 12c. exportLoansCsv — 4 rows
    const loansCsv = await csvModule.exportLoansCsv();
    const loansParsed = Papa.parse<Record<string, string>>(loansCsv, { header: true, skipEmptyLines: true });
    expect(loansParsed.data).toHaveLength(4);
    expect(loansParsed.meta.fields).toEqual(
      expect.arrayContaining(["borrowerName", "dateLoaned", "bookTitle", "copyNumber"]),
    );
    expect(loansParsed.data.map((r) => r.borrowerName).sort()).toEqual(["Alice", "Bob", "Charlie", "Dana"]);

    // 12d. exportCopiesCsv — 12 rows
    const copiesCsv = await csvModule.exportCopiesCsv();
    const copiesParsed = Papa.parse<Record<string, string>>(copiesCsv, { header: true, skipEmptyLines: true });
    expect(copiesParsed.data).toHaveLength(12);
    expect(copiesParsed.meta.fields).toEqual(
      expect.arrayContaining(["bookTitle", "isbn13", "level", "room", "bookshelf", "shelfRow", "depth", "copyNumber"]),
    );
    const signedCopy = copiesParsed.data.find((r) => r.notes === "Signed by author");
    expect(signedCopy).toBeDefined();
    expect(signedCopy!.bookTitle).toBe("Piranesi");

    // ===================================================================
    // 13. Verify getBook
    // ===================================================================
    const duneBook = await data.getBook(bookIds[0]);
    expect(duneBook).not.toBeNull();
    expect(duneBook!.title).toBe("Dune");
    expect(duneBook!.author).toBe("Frank Herbert");
    expect(await data.getBook(99999)).toBeUndefined();

    // ===================================================================
    // 14. Verify getRecentBooks
    // ===================================================================
    expect(await data.getRecentBooks(3)).toHaveLength(3);

    // ===================================================================
    // 15. Verify copy-level queries
    // ===================================================================
    const duneCopies = await data.getBookCopies(bookIds[0]);
    expect(duneCopies).toHaveLength(2);
    expect(duneCopies[0].levelName).toBe("Ground");
    expect(duneCopies[0].roomName).toBe("Living Room");
    expect(duneCopies[1].levelName).toBe("Basement");

    const firstDuneCopy = await data.getCopy(duneCopies[0].id);
    expect(firstDuneCopy).not.toBeNull();
    expect(firstDuneCopy!.status).toBe("available");

    // ===================================================================
    // 16. Verify getLocation
    // ===================================================================
    const firstLoc = flatLocs[0];
    const fetchedLoc = await data.getLocation(firstLoc.id);
    expect(fetchedLoc).not.toBeNull();
    expect(fetchedLoc!.levelName).toBe(firstLoc.levelName);
    expect(fetchedLoc!.roomName).toBe(firstLoc.roomName);
    expect(fetchedLoc!.bookshelfName).toBe(firstLoc.bookshelfName);

    // ===================================================================
    // 17. Verify getHouseMap
    // ===================================================================
    const houseMap = await data.getHouseMap();
    expect(houseMap.length).toBeGreaterThanOrEqual(3); // Ground, Upstairs, Basement
    const ground = houseMap.find((l) => l.level.name === "Ground")!;
    expect(ground.rooms.length).toBe(2);
    const livingRoom = ground.rooms.find((r) => r.room.name === "Living Room")!;
    expect(livingRoom.bookshelves.length).toBe(2);
    const bookshelfA = livingRoom.bookshelves.find((b) => b.bookshelf.name === "Bookshelf A")!;
    expect(bookshelfA.locations.length).toBe(4); // 2 rows × 2 depths
  });
});
