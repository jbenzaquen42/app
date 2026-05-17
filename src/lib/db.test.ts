import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// Schema is side-effect-free; safe to import statically
import {
  books,
  bookshelves,
  copies,
  houseLevels,
  loans,
  locations,
  rooms,
} from "./schema";

/**
 * Helper: clear all rows from every table to isolate each test within a describe block.
 * Called inside beforeEach after a fresh module import.
 */
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

// ── Helper to seed a location hierarchy ─────────────────────────────────────

async function seedLocation(
  levelName: string,
  roomName: string,
  bookshelfName: string,
  rowCount = 1,
  depthCount = 1,
) {
  const { db } = await import("./db");

  // Level
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

  // Room
  let [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.levelId, level.id), eq(rooms.name, roomName)))
    .limit(1);
  if (!room) {
    [room] = await db
      .insert(rooms)
      .values({ levelId: level.id, name: roomName, sortOrder: 0 })
      .returning();
  }

  // Bookshelf
  const [bs] = await db
    .insert(bookshelves)
    .values({
      roomId: room.id,
      name: bookshelfName,
      rowCount,
      depthCount,
    })
    .returning();

  // Locations
  const locs: (typeof locations.$inferSelect)[] = [];
  let sortOrder = 0;
  for (let row = 1; row <= rowCount; row++) {
    if (depthCount >= 2) {
      const [f] = await db
        .insert(locations)
        .values({
          bookshelfId: bs.id,
          shelfRow: row,
          depth: "front",
          sortOrder: sortOrder++,
        })
        .returning();
      locs.push(f);
      const [b] = await db
        .insert(locations)
        .values({
          bookshelfId: bs.id,
          shelfRow: row,
          depth: "back",
          sortOrder: sortOrder++,
        })
        .returning();
      locs.push(b);
    } else {
      const [loc] = await db
        .insert(locations)
        .values({
          bookshelfId: bs.id,
          shelfRow: row,
          depth: "front",
          sortOrder: sortOrder++,
        })
        .returning();
      locs.push(loc);
    }
  }

  return { level, room, bookshelf: bs, locations: locs };
}

// ── describe: database workflow ──────────────────────────────────────────────

describe("database workflow", () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cozystacks-test-"));
    dbPath = path.join(tempDir, "test.sqlite");
    process.env.DATABASE_PATH = dbPath;
    process.env.LIBRARY_DATA_DIR = tempDir;
  });

  afterAll(() => {
    delete process.env.DATABASE_PATH;
    delete process.env.LIBRARY_DATA_DIR;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup on Windows (file may still be locked)
    }
  });

  beforeEach(async () => {
    vi.resetModules();
    await clearAllTables();
  });

  it("creates a location", async () => {
    const data = await import("./data");

    await seedLocation(
      "Upstairs",
      "Bedroom",
      "Nightstand",
      1,
      1,
    );

    const all = await data.getLocations();
    expect(all).toHaveLength(1);
    expect(all[0].levelName).toBe("Upstairs");
    expect(all[0].roomName).toBe("Bedroom");
    expect(all[0].bookshelfName).toBe("Nightstand");
    expect(all[0].shelfRow).toBe(1);
    expect(all[0].depth).toBe("front");
  });

  it("creates a book and copies at a location", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { locations: locs } = await seedLocation("Ground", "Living Room", "Bookshelf A");
    const loc = locs[0];

    // Create a book
    const [book] = await db
      .insert(books)
      .values({
        title: "Piranesi",
        author: "Susanna Clarke",
        isbn13: "9781526622433",
      })
      .returning({ id: books.id });

    // Add copy #1
    await db
      .insert(copies)
      .values({ bookId: book.id, locationId: loc.id, copyNumber: 1 });

    // Add copy #2
    await db
      .insert(copies)
      .values({ bookId: book.id, locationId: loc.id, copyNumber: 2 });

    // Verify
    const bookCopies = await data.getBookCopies(book.id);
    expect(bookCopies).toHaveLength(2);
    expect(bookCopies[0].copyNumber).toBe(1);
    expect(bookCopies[1].copyNumber).toBe(2);
    expect(bookCopies[0].status).toBe("available");
    expect(bookCopies[1].status).toBe("available");
    expect(bookCopies[0].levelName).toBe("Ground");
    expect(bookCopies[0].roomName).toBe("Living Room");
  });

  it("creates a loan, updates copy status, and returns the loan", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { locations: locs } = await seedLocation("Downstairs", "Office", "Desk");
    const loc = locs[0];

    const [book] = await db
      .insert(books)
      .values({
        title: "Jonathan Strange & Mr Norrell",
        author: "Susanna Clarke",
      })
      .returning({ id: books.id });

    await db
      .insert(copies)
      .values({ bookId: book.id, locationId: loc.id, copyNumber: 1 });
    const [copyRow] = await data.getBookCopies(book.id);

    // Create a loan
    db.transaction((tx) => {
      tx.insert(loans)
        .values({ copyId: copyRow.id, borrowerName: "Alice", dateLoaned: "2026-05-01" })
        .run();
      tx.update(copies)
        .set({ status: "loaned" })
        .where(eq(copies.id, copyRow.id))
        .run();
    });

    // Verify copy status
    const loanedCopy = await data.getCopy(copyRow.id);
    expect(loanedCopy!.status).toBe("loaned");

    // Verify active loan
    const activeLoan = await data.getActiveLoanForCopy(copyRow.id);
    expect(activeLoan).not.toBeNull();
    expect(activeLoan!.borrowerName).toBe("Alice");
    expect(activeLoan!.dateReturned).toBeNull();

    // Verify loan history
    const history = await data.getLoanHistoryForBook(book.id);
    expect(history).toHaveLength(1);
    expect(history[0].loan.borrowerName).toBe("Alice");
    expect(history[0].loan.dateReturned).toBeNull();

    // Return the loan
    db.transaction((tx) => {
      tx.update(loans)
        .set({ dateReturned: "2026-05-15" })
        .where(eq(loans.id, activeLoan!.id))
        .run();
      tx.update(copies)
        .set({ status: "available" })
        .where(eq(copies.id, copyRow.id))
        .run();
    });

    // Verify copy is available again
    const returnedCopy = await data.getCopy(copyRow.id);
    expect(returnedCopy!.status).toBe("available");

    // Verify loan has return date
    const updatedHistory = await data.getLoanHistoryForBook(book.id);
    expect(updatedHistory).toHaveLength(1);
    expect(updatedHistory[0].loan.dateReturned).toBe("2026-05-15");

    // Verify no active loan
    const noLoan = await data.getActiveLoanForCopy(copyRow.id);
    expect(noLoan).toBeUndefined();
  });

  it("returns correct stats with active loan counting", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { locations: locs } = await seedLocation("Upstairs", "Spare Room", "Cabinet");
    const loc = locs[0];

    // Book with 2 copies (both available)
    const [b1] = await db
      .insert(books)
      .values({ title: "Book A", author: "Author A" })
      .returning({ id: books.id });
    await db
      .insert(copies)
      .values({ bookId: b1.id, locationId: loc.id, copyNumber: 1 });
    await db
      .insert(copies)
      .values({ bookId: b1.id, locationId: loc.id, copyNumber: 2 });

    // Another book with 1 copy (loaned)
    const [b2] = await db
      .insert(books)
      .values({ title: "Book B", author: "Author B" })
      .returning({ id: books.id });
    await db
      .insert(copies)
      .values({ bookId: b2.id, locationId: loc.id, copyNumber: 1 });
    const [copiesOfB2] = await data.getBookCopies(b2.id);

    db.transaction((tx) => {
      tx.insert(loans)
        .values({ copyId: copiesOfB2.id, borrowerName: "Bob", dateLoaned: "2026-04-01" })
        .run();
      tx.update(copies)
        .set({ status: "loaned" })
        .where(eq(copies.id, copiesOfB2.id))
        .run();
    });

    const stats = await data.getStats();
    expect(stats.books).toBe(2);
    expect(stats.copies).toBe(3);
    expect(stats.locations).toBe(1);
    expect(stats.activeLoans).toBe(1);
  });

  it("getCatalog applies filters correctly", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { locations: locs } = await seedLocation("Ground", "Library", "Main");
    const loc = locs[0];

    // Two books
    const [b1] = await db
      .insert(books)
      .values({
        title: "Dune",
        author: "Frank Herbert",
        isbn13: "9780441172719",
      })
      .returning({ id: books.id });
    await db
      .insert(copies)
      .values({ bookId: b1.id, locationId: loc.id, copyNumber: 1 });

    const [b2] = await db
      .insert(books)
      .values({
        title: "Neuromancer",
        author: "William Gibson",
        isbn13: "9780441569595",
      })
      .returning({ id: books.id });
    await db
      .insert(copies)
      .values({ bookId: b2.id, locationId: loc.id, copyNumber: 1 });

    // All books
    const all = await data.getCatalog({});
    expect(all).toHaveLength(2);

    // Filter by search query
    const duneResult = await data.getCatalog({ q: "Dune" });
    expect(duneResult).toHaveLength(1);
    expect(duneResult[0].title).toBe("Dune");

    const isbnResult = await data.getCatalog({ q: "9780441569595" });
    expect(isbnResult).toHaveLength(1);
    expect(isbnResult[0].title).toBe("Neuromancer");
  });
});

// ── describe: CSV export ─────────────────────────────────────────────────────

describe("CSV export", () => {
  let tempDir: string;
  let dbPath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cozystacks-csv-test-"));
    dbPath = path.join(tempDir, "test.sqlite");
    process.env.DATABASE_PATH = dbPath;
    process.env.LIBRARY_DATA_DIR = tempDir;
  });

  afterAll(() => {
    delete process.env.DATABASE_PATH;
    delete process.env.LIBRARY_DATA_DIR;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort
    }
  });

  beforeEach(async () => {
    vi.resetModules();
    await clearAllTables();
  });

  it("exportBooksCsv returns CSV with headers and data", async () => {
    const { db } = await import("./db");
    const csvModule = await import("./csv");

    const { locations: locs } = await seedLocation("Upstairs", "Bedroom", "Shelf 1");
    const loc = locs[0];

    await db
      .insert(books)
      .values({ title: "Test CSV Book", author: "CSV Author", isbn13: "9780345803481" });
    const [allBooks] = await db.select({ id: books.id }).from(books);
    await db
      .insert(copies)
      .values({ bookId: allBooks.id, locationId: loc.id, copyNumber: 1 });

    const csv = await csvModule.exportBooksCsv();

    expect(csv).toContain("title");
    expect(csv).toContain("author");
    expect(csv).toContain("isbn13");
    expect(csv).toContain("copyCount");
    expect(csv).toContain("Test CSV Book");
    expect(csv).toContain("CSV Author");
    expect(csv).toContain("9780345803481");
  });

  it("exportLocationsCsv returns CSV with location fields", async () => {
    const csvModule = await import("./csv");

    await seedLocation("Ground", "Kitchen", "Counter");

    const csv = await csvModule.exportLocationsCsv();

    expect(csv).toContain("level");
    expect(csv).toContain("room");
    expect(csv).toContain("bookshelf");
    expect(csv).toContain("shelfRow");
    expect(csv).toContain("depth");
    expect(csv).toContain("Ground");
    expect(csv).toContain("Kitchen");
    expect(csv).toContain("Counter");
  });

  it("exportLoansCsv returns CSV with loan + book info", async () => {
    const { db } = await import("./db");
    const csvModule = await import("./csv");

    const { locations: locs } = await seedLocation("Downstairs", "Den", "Shelf B");
    const loc = locs[0];

    await db
      .insert(books)
      .values({ title: "Loaned Book", author: "Loan Author" });
    const [bookRow] = await db.select({ id: books.id }).from(books);
    await db
      .insert(copies)
      .values({ bookId: bookRow.id, locationId: loc.id, copyNumber: 1 });
    const [copyRow] = await db.select({ id: copies.id }).from(copies);
    await db
      .insert(loans)
      .values({ copyId: copyRow.id, borrowerName: "Charlie", dateLoaned: "2026-06-01" });

    const csv = await csvModule.exportLoansCsv();

    expect(csv).toContain("borrowerName");
    expect(csv).toContain("bookTitle");
    expect(csv).toContain("copyNumber");
    expect(csv).toContain("Charlie");
    expect(csv).toContain("Loaned Book");
  });

  it("exportCopiesCsv returns CSV with copy + book + location fields", async () => {
    const { db } = await import("./db");
    const csvModule = await import("./csv");

    const { locations: locs } = await seedLocation("Attic", "Storage", "Box 3");
    const loc = locs[0];

    await db
      .insert(books)
      .values({
        title: "Copy Export Book",
        author: "Copy Author",
        isbn13: "9780451524935",
      });
    const [bookRow] = await db.select({ id: books.id }).from(books);
    await db
      .insert(copies)
      .values({
        bookId: bookRow.id,
        locationId: loc.id,
        copyNumber: 1,
        notes: "Signed copy",
      });

    const csv = await csvModule.exportCopiesCsv();

    // exportCopiesCsv includes bookTitle and isbn13 but NOT author
    expect(csv).toContain("bookTitle");
    expect(csv).toContain("isbn13");
    expect(csv).toContain("level");
    expect(csv).toContain("room");
    expect(csv).toContain("shelfRow");
    expect(csv).toContain("depth");
    expect(csv).toContain("Copy Export Book");
    expect(csv).toContain("9780451524935");
    expect(csv).toContain("Attic");
    expect(csv).toContain("Signed copy");
  });
});
