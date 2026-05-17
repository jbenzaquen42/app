import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

import { books, bookshelfDefinitions, bookshelves, copies, houseLevels, loans, locations, rooms } from "./schema";
import { desiredShelfSpots, shelfSpotKey } from "./bookshelf-shape";

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/**
 * Seed a minimal level + room + bookshelf + locations.
 * Returns the hierarchy objects so tests can reference them.
 */
async function seedShelf(
  levelName: string,
  roomName: string,
  shelfName: string,
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
    .where(and(eq(rooms.levelId, level.id), eq(rooms.name, roomName)))
    .limit(1);
  if (!room) {
    [room] = await db
      .insert(rooms)
      .values({ levelId: level.id, name: roomName, sortOrder: 0 })
      .returning();
  }

  const [bs] = await db
    .insert(bookshelves)
    .values({ roomId: room.id, name: shelfName, rowCount, depthCount })
    .returning();

  const locs: (typeof locations.$inferSelect)[] = [];
  let sortOrder = 0;
  for (let row = 1; row <= rowCount; row++) {
    const depths = depthCount >= 2 ? (["front", "back"] as const) : (["front"] as const);
    for (const d of depths) {
      const [loc] = await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: d, sortOrder: sortOrder++ })
        .returning();
      locs.push(loc);
    }
  }

  return { level, room, bookshelf: bs, locations: locs };
}

// ── describe: house / shelf / location ─────────────────────────────────────

describe("house / shelf / location", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cozystacks-house-"));
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

  // ── Default seed (fresh DB) ──────────────────────────────────────────────

  it("seeds defaults when database is initially created", async () => {
    // Use a separate fresh database to verify the one-time seeding
    const freshDir = fs.mkdtempSync(path.join(tempDir, "fresh-"));
    const freshDbPath = path.join(freshDir, "fresh.sqlite");
    process.env.DATABASE_PATH = freshDbPath;

    vi.resetModules();
    const data = await import("./data");

    const levels = await data.getHouseLevels();
    expect(levels).toHaveLength(2);
    expect(levels[0].name).toBe("Downstairs");
    expect(levels[1].name).toBe("Upstairs");

    const allRooms = await data.getRooms();
    expect(allRooms.map((r) => r.name).sort()).toEqual(["Living Room", "Loft"]);

    const defs = await data.getBookshelfDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toContain("Tall bookshelf");
    expect(defs[0].rowCount).toBe(6);
    expect(defs[0].depthCount).toBe(2);
    expect(defs[0].isPreset).toBe(true);

    const allShelves = await data.getBookshelves();
    expect(allShelves).toHaveLength(3);
    expect(allShelves.map((s) => s.name)).toEqual([
      "Downstairs Tall Shelf",
      "Upstairs Left Bookcase",
      "Upstairs Right Bookcase",
    ]);

    // 3 shelves × (6 rows × 2 depths) = 36 locations
    const allLocs = await data.getLocations();
    expect(allLocs).toHaveLength(36);

    // Clean up the fresh directory
    try {
      fs.rmSync(freshDir, { recursive: true, force: true });
    } catch { /* best-effort */ }

    // Restore main db path
    process.env.DATABASE_PATH = path.join(tempDir, "test.sqlite");
  });

  it("migrates old flat locations while preserving copy and loan assignments", async () => {
    const mainDb = await import("./db");
    mainDb.resetDb();

    const legacyDir = fs.mkdtempSync(path.join(tempDir, "legacy-"));
    const legacyDbPath = path.join(legacyDir, "legacy.sqlite");
    const previousDbPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = legacyDbPath;

    const legacy = new Database(legacyDbPath);
    legacy.pragma("foreign_keys = ON");
    legacy.exec(`
      CREATE TABLE books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        isbn10 TEXT,
        isbn13 TEXT,
        subtitle TEXT,
        publisher TEXT,
        published_date TEXT,
        description TEXT,
        page_count INTEGER,
        categories TEXT,
        series_name TEXT,
        series_number TEXT,
        cover_image_path TEXT,
        metadata_source TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        floor TEXT NOT NULL,
        room TEXT NOT NULL,
        shelf TEXT NOT NULL,
        section TEXT NOT NULL,
        notes TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE copies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        copy_number INTEGER NOT NULL,
        location_id INTEGER NOT NULL REFERENCES locations(id),
        notes TEXT,
        condition_notes TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        copy_id INTEGER NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
        borrower_name TEXT NOT NULL,
        date_loaned TEXT NOT NULL,
        date_returned TEXT,
        contact_info TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO books (id, title, author) VALUES (1, 'Migrated Book', 'Author');
      INSERT INTO locations (id, floor, room, shelf, section, notes, sort_order) VALUES
        (10, 'Upstairs', 'Bedroom', 'White Bookshelf', 'Top Shelf', 'near window', 0),
        (11, 'Upstairs', 'Bedroom', 'White Bookshelf', 'Back Row', NULL, 1);
      INSERT INTO copies (id, book_id, copy_number, location_id, notes, status) VALUES
        (20, 1, 1, 10, 'first copy', 'loaned'),
        (21, 1, 2, 11, NULL, 'available');
      INSERT INTO loans (id, copy_id, borrower_name, date_loaned, notes) VALUES
        (30, 20, 'Friend', '2026-01-02', 'legacy loan');
      PRAGMA user_version = 1;
    `);
    legacy.close();

    vi.resetModules();
    const data = await import("./data");
    const migratedDb = await import("./db");

    const houseMap = await data.getHouseMap();
    expect(houseMap).toHaveLength(1);
    expect(houseMap[0].level.name).toBe("Upstairs");
    expect(houseMap[0].rooms[0].room.name).toBe("Bedroom");
    const shelf = houseMap[0].rooms[0].bookshelves[0];
    expect(shelf.bookshelf.name).toBe("White Bookshelf");
    expect(shelf.bookshelf.rowCount).toBe(2);
    expect(shelf.bookshelf.depthCount).toBe(2);
    expect(shelf.locations.map((location) => location.id).sort((a, b) => a - b)).toEqual([10, 11]);

    const copiesAfter = await data.getBookCopies(1);
    expect(copiesAfter.map((copy) => copy.locationId).sort((a, b) => a - b)).toEqual([10, 11]);
    expect(copiesAfter[0].status).toBe("loaned");

    const loansAfter = await data.getLoans();
    expect(loansAfter).toHaveLength(1);
    expect(loansAfter[0].loan.borrowerName).toBe("Friend");

    const legacyTables = migratedDb.getSqlite()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'legacy_%'")
      .all();
    expect(legacyTables).toHaveLength(0);

    migratedDb.resetDb();
    process.env.DATABASE_PATH = previousDbPath;
    vi.resetModules();
    try {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    } catch { /* best-effort */ }
  });

  // ── getHouseMap ──────────────────────────────────────────────────────────

  it("getHouseMap returns complete nested structure with copy counts", async () => {
    const data = await import("./data");

    // Create 2 levels with rooms and shelves
    await seedShelf("Ground", "Kitchen", "Main Shelf", 2, 2);
    await seedShelf("Upstairs", "Bedroom", "Nightstand", 1, 1);

    const houseMap = await data.getHouseMap();

    // Only the explicit seed data (defaults not re-seeded after clearAllTables)
    expect(houseMap).toHaveLength(2);
    const ground = houseMap.find((l) => l.level.name === "Ground")!;
    expect(ground.rooms).toHaveLength(1);
    expect(ground.rooms[0].room.name).toBe("Kitchen");
    expect(ground.rooms[0].bookshelves).toHaveLength(1);
    const shelf = ground.rooms[0].bookshelves[0];
    expect(shelf.bookshelf.name).toBe("Main Shelf");
    expect(shelf.locations).toHaveLength(4); // 2 rows × 2 depths
    expect(shelf.copyCount).toBe(0);

    for (const loc of shelf.locations) {
      expect(loc.copyCount).toBe(0);
    }
  });

  it("getHouseMap reflects copyCount when copies are placed at locations", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { locations: locs } = await seedShelf("Ground", "Kitchen", "Shelf", 1, 1);
    const loc = locs[0];

    await db
      .insert(books)
      .values({ title: "House Map Copy Test", author: "Author" })
      .run();
    const [book] = await db.select({ id: books.id }).from(books);
    await db
      .insert(copies)
      .values({ bookId: book.id, locationId: loc.id, copyNumber: 1 })
      .run();

    const houseMap = await data.getHouseMap();
    const ground = houseMap.find((l) => l.level.name === "Ground")!;
    const shelf = ground.rooms[0].bookshelves[0];
    expect(shelf.copyCount).toBe(1);

    const targetLoc = shelf.locations.find((l) => l.id === loc.id)!;
    expect(targetLoc.copyCount).toBe(1);
  });

  // ── Bookshelf create / read ──────────────────────────────────────────────

  it("creates a bookshelf linked to a preset definition", async () => {
    const { db } = await import("./db");
    // Create a preset definition
    const [preset] = await db
      .insert(bookshelfDefinitions)
      .values({ name: "Test Preset (4×2)", rowCount: 4, depthCount: 2, isPreset: true, sortOrder: 0 })
      .returning();

    // Get a room to attach the shelf to
    const { room } = await seedShelf("Level", "Room", "Temp", 1, 1);
    // Delete the temp shelf so we can create our own
    await db.delete(bookshelves).where(eq(bookshelves.roomId, room.id)).run();

    const [bs] = await db
      .insert(bookshelves)
      .values({
        roomId: room.id,
        definitionId: preset.id,
        name: "New Preset Shelf",
        rowCount: preset.rowCount,
        depthCount: preset.depthCount,
      })
      .returning();

    expect(bs.definitionId).toBe(preset.id);
    expect(bs.rowCount).toBe(4);
    expect(bs.depthCount).toBe(2);

    // Generate locations (same pattern as createBookshelfAction)
    let so = 0;
    for (let row = 1; row <= 4; row++) {
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "front", sortOrder: so++ })
        .run();
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "back", sortOrder: so++ })
        .run();
    }

    const bsLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id))
      .orderBy(locations.sortOrder);
    expect(bsLocs).toHaveLength(8);
    expect(bsLocs[0].shelfRow).toBe(1);
    expect(bsLocs[0].depth).toBe("front");
    expect(bsLocs[7].shelfRow).toBe(4);
    expect(bsLocs[7].depth).toBe("back");
  });

  it("creates a bookshelf without a definition link (custom size)", async () => {
    const { db } = await import("./db");
    const { room } = await seedShelf("Level", "Room", "Temp", 1, 1);
    await db.delete(bookshelves).where(eq(bookshelves.roomId, room.id)).run();

    const [bs] = await db
      .insert(bookshelves)
      .values({ roomId: room.id, name: "Custom Shelf", rowCount: 3, depthCount: 1 })
      .returning();

    expect(bs.definitionId).toBeNull();
    expect(bs.rowCount).toBe(3);
    expect(bs.depthCount).toBe(1);

    let so = 0;
    for (let row = 1; row <= 3; row++) {
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "front", sortOrder: so++ })
        .run();
    }

    const bsLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id));
    expect(bsLocs).toHaveLength(3);
  });

  // ── Bookshelf resize ─────────────────────────────────────────────────────

  it("expanding a bookshelf adds new location rows/depths safely", async () => {
    const { db } = await import("./db");

    const { room } = await seedShelf("Level", "Room", "Temp", 1, 1);
    await db.delete(bookshelves).where(eq(bookshelves.roomId, room.id)).run();

    // Start small: 1 row, 1 depth
    const [bs] = await db
      .insert(bookshelves)
      .values({ roomId: room.id, name: "Expandable", rowCount: 1, depthCount: 1 })
      .returning();
    await db
      .insert(locations)
      .values({ bookshelfId: bs.id, shelfRow: 1, depth: "front", sortOrder: 0 })
      .run();

    // Expand to 2 rows, 2 depths → need to add Row1Back, Row2Front, Row2Back
    const existingBefore = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id))
      .all();
    const existingSet = new Set(existingBefore.map((l) => `${l.shelfRow}|${l.depth}`));

    let so = 0;
    for (let row = 1; row <= 2; row++) {
      for (const depth of ["front", "back"] as const) {
        if (!existingSet.has(`${row}|${depth}`)) {
          await db
            .insert(locations)
            .values({ bookshelfId: bs.id, shelfRow: row, depth, sortOrder: so })
            .run();
        }
        so++;
      }
    }

    await db
      .update(bookshelves)
      .set({ rowCount: 2, depthCount: 2 })
      .where(eq(bookshelves.id, bs.id))
      .run();

    const after = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id))
      .orderBy(locations.sortOrder);
    expect(after).toHaveLength(4);
    expect(after.map((l) => `${l.shelfRow}|${l.depth}`)).toEqual([
      "1|front",
      "1|back",
      "2|front",
      "2|back",
    ]);
  });

  it("shrinking a bookshelf removes empty locations", async () => {
    const { db } = await import("./db");

    const { room } = await seedShelf("Level", "Room", "Temp", 1, 1);
    await db.delete(bookshelves).where(eq(bookshelves.roomId, room.id)).run();

    // Start big: 2 rows, 2 depths
    const [bs] = await db
      .insert(bookshelves)
      .values({ roomId: room.id, name: "Shrinkable", rowCount: 2, depthCount: 2 })
      .returning();
    let so = 0;
    for (let row = 1; row <= 2; row++) {
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "front", sortOrder: so++ })
        .run();
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "back", sortOrder: so++ })
        .run();
    }

    // Shrink to 1 row, 1 depth: remove Row1Back, Row2Front, Row2Back
    const existing = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id))
      .all();
    for (const loc of existing) {
      const keep = loc.shelfRow <= 1 && loc.depth === "front";
      if (!keep) {
        await db.delete(locations).where(eq(locations.id, loc.id)).run();
      }
    }
    await db
      .update(bookshelves)
      .set({ rowCount: 1, depthCount: 1 })
      .where(eq(bookshelves.id, bs.id))
      .run();

    const remaining = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].shelfRow).toBe(1);
    expect(remaining[0].depth).toBe("front");
  });

  it("prevents removing a location that still has copies when shrinking", async () => {
    const { db } = await import("./db");

    const { room } = await seedShelf("Level", "Room", "Temp", 1, 1);
    await db.delete(bookshelves).where(eq(bookshelves.roomId, room.id)).run();

    // 2 rows, 2 depths
    const [bs] = await db
      .insert(bookshelves)
      .values({ roomId: room.id, name: "Occupied", rowCount: 2, depthCount: 2 })
      .returning();
    let so = 0;
    for (let row = 1; row <= 2; row++) {
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "front", sortOrder: so++ })
        .run();
      await db
        .insert(locations)
        .values({ bookshelfId: bs.id, shelfRow: row, depth: "back", sortOrder: so++ })
        .run();
    }

    const allLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id));

    // Place a copy in Row2Front (would be removed when shrinking to 1 row)
    const row2Front = allLocs.find((l) => l.shelfRow === 2 && l.depth === "front")!;
    await db.insert(books).values({ title: "Occupant", author: "Author" }).run();
    const [book] = await db.select({ id: books.id }).from(books);
    await db
      .insert(copies)
      .values({ bookId: book.id, locationId: row2Front.id, copyNumber: 1 })
      .run();

    // Try shrinking — guard: skip deletion for locations that have copies
    for (const loc of allLocs) {
      const keep = loc.shelfRow <= 1 && loc.depth === "front";
      if (!keep) {
        const used = await db
          .select({ id: copies.id })
          .from(copies)
          .where(eq(copies.locationId, loc.id))
          .limit(1)
          .get();
        if (used) continue; // matches updateBookshelfAction guard
        await db.delete(locations).where(eq(locations.id, loc.id)).run();
      }
    }

    const remaining = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id))
      .orderBy(locations.sortOrder);
    // Row1Front stays, Row2Front stays (has copy), Row1Back + Row2Back removed
    expect(remaining).toHaveLength(2);
    expect(remaining[0].shelfRow).toBe(1);
    expect(remaining[0].depth).toBe("front");
    expect(remaining[1].shelfRow).toBe(2);
    expect(remaining[1].depth).toBe("front");
  });

  // ── Delete behavior ──────────────────────────────────────────────────────

  it("deleting a bookshelf cascade-removes its locations", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { bookshelf, locations: shelfLocs } = await seedShelf("Deletable", "Hall", "Shelf A", 2, 2);
    expect(shelfLocs).toHaveLength(4);

    const allLocsBefore = await data.getLocations();
    const countBefore = allLocsBefore.length;

    // Delete the bookshelf
    await db.delete(bookshelves).where(eq(bookshelves.id, bookshelf.id)).run();

    const remainingLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bookshelf.id));
    expect(remainingLocs).toHaveLength(0);

    const allLocsAfter = await data.getLocations();
    expect(allLocsAfter).toHaveLength(countBefore - 4);
  });

  it("deleting a level cascade-removes rooms, bookshelves, and locations", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const { level, locations: shelfLocs } = await seedShelf("Removable", "Hall", "Shelf A", 2, 1);
    expect(shelfLocs).toHaveLength(2);

    const beforeCount = (await data.getLocations()).length;

    await db.delete(houseLevels).where(eq(houseLevels.id, level.id)).run();

    const remainingRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.levelId, level.id));
    expect(remainingRooms).toHaveLength(0);

    const afterCount = (await data.getLocations()).length;
    expect(afterCount).toBe(beforeCount - 2);

    const remainingLevels = await db
      .select()
      .from(houseLevels)
      .where(eq(houseLevels.id, level.id));
    expect(remainingLevels).toHaveLength(0);
  });

  // ── CSV location import (core DB logic) ─────────────────────────────

  it("imports locations from CSV-like rows (creates levels, rooms, bookshelves, locations)", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    // Same columns as exportLocationsCsv
    const rows = [
      { level: "Ground", room: "Kitchen", bookshelf: "Main Shelf", shelfRow: "1", depth: "front" },
      { level: "Ground", room: "Kitchen", bookshelf: "Main Shelf", shelfRow: "1", depth: "back" },
      { level: "Ground", room: "Kitchen", bookshelf: "Main Shelf", shelfRow: "2", depth: "front" },
      { level: "Ground", room: "Kitchen", bookshelf: "Pantry", shelfRow: "1", depth: "front" },
      { level: "Basement", room: "Storage", bookshelf: "Box 1", shelfRow: "1", depth: "front" },
    ];

    for (const row of rows) {
      const level = row.level.trim();
      const room = row.room.trim();
      const bookshelf = row.bookshelf.trim();
      const shelfRow = Number(row.shelfRow);
      const depth = row.depth.trim() || "front";
      if (!level || !room || !bookshelf || !Number.isFinite(shelfRow) || shelfRow < 1) continue;
      if (!["front", "back"].includes(depth)) continue;

      // Same logic as importLocationsAction
      let levelRow = await db.query.houseLevels.findFirst({
        where: eq(houseLevels.name, level),
      });
      if (!levelRow) {
        [levelRow] = await db
          .insert(houseLevels)
          .values({ name: level, sortOrder: 0 })
          .returning();
      }

      let roomRow = await db.query.rooms.findFirst({
        where: and(eq(rooms.levelId, levelRow.id), eq(rooms.name, room)),
      });
      if (!roomRow) {
        [roomRow] = await db
          .insert(rooms)
          .values({ levelId: levelRow.id, name: room, sortOrder: 0 })
          .returning();
      }

      let bsRow = await db.query.bookshelves.findFirst({
        where: and(eq(bookshelves.roomId, roomRow.id), eq(bookshelves.name, bookshelf)),
      });
      if (!bsRow) {
        [bsRow] = await db
          .insert(bookshelves)
          .values({
            roomId: roomRow.id,
            name: bookshelf,
            rowCount: Math.max(shelfRow, 1),
            depthCount: 2,
          })
          .returning();

        // Generate locations for new bookshelf (using shared helpers)
        const existing = await db
          .select({ shelfRow: locations.shelfRow, depth: locations.depth })
          .from(locations)
          .where(eq(locations.bookshelfId, bsRow.id));
        const existingSet = new Set(existing.map((l) => shelfSpotKey(l.shelfRow, l.depth)));
        for (const spot of desiredShelfSpots(bsRow.rowCount, bsRow.depthCount)) {
          if (!existingSet.has(shelfSpotKey(spot.shelfRow, spot.depth))) {
            await db
              .insert(locations)
              .values({ bookshelfId: bsRow.id, ...spot })
              .run();
          }
        }
      }

      await db
        .insert(locations)
        .values({
          bookshelfId: bsRow.id,
          shelfRow,
          depth: depth as "front" | "back",
          notes: null,
          sortOrder: 0,
        })
        .onConflictDoNothing();
    }

    // Verify
    const levels = await db.select().from(houseLevels);
    expect(levels.map((l) => l.name).sort()).toEqual(["Basement", "Ground"]);

    const allRooms = await db.select().from(rooms);
    expect(allRooms.map((r) => r.name).sort()).toEqual(["Kitchen", "Storage"]);

    const allShelves = await db.select().from(bookshelves);
    expect(allShelves.map((s) => s.name).sort()).toEqual(["Box 1", "Main Shelf", "Pantry"]);

    // Main Shelf: auto-generated {1/front, 1/back} at creation (rowCount=1),
    //   then row 3 inserts {2/front} which is new → 3 locs
    // Pantry: auto-generated {1/front, 1/back} at creation → 2 locs
    // Box 1: auto-generated {1/front, 1/back} at creation → 2 locs
    // Total: 3 + 2 + 2 = 7
    const allLocs = await data.getLocations();
    expect(allLocs).toHaveLength(7);
  });

  it("skips invalid CSV rows during location import", async () => {
    const { db } = await import("./db");
    const data = await import("./data");

    const rows = [
      { level: "", room: "Kitchen", bookshelf: "Shelf", shelfRow: "1", depth: "front" },        // no level
      { level: "Ground", room: "", bookshelf: "Shelf", shelfRow: "1", depth: "front" },        // no room
      { level: "Ground", room: "Kitchen", bookshelf: "", shelfRow: "1", depth: "front" },      // no bookshelf
      { level: "Ground", room: "Kitchen", bookshelf: "Shelf", shelfRow: "0", depth: "front" }, // shelfRow < 1
      { level: "Ground", room: "Kitchen", bookshelf: "Shelf", shelfRow: "1", depth: "side" },  // invalid depth
      { level: "Ground", room: "Kitchen", bookshelf: "Shelf", shelfRow: "1", depth: "front" }, // valid
    ];

    for (const row of rows) {
      const level = row.level.trim();
      const room = row.room.trim();
      const bookshelfName = row.bookshelf.trim();
      const shelfRow = Number(row.shelfRow);
      const depth = row.depth.trim() || "front";
      if (!level || !room || !bookshelfName || !Number.isFinite(shelfRow) || shelfRow < 1 || !["front", "back"].includes(depth)) {
        continue; // skip per importLocationsAction validation
      }

      let levelRow = await db.query.houseLevels.findFirst({
        where: eq(houseLevels.name, level),
      });
      if (!levelRow) {
        [levelRow] = await db
          .insert(houseLevels)
          .values({ name: level, sortOrder: 0 })
          .returning();
      }
      let roomRow = await db.query.rooms.findFirst({
        where: and(eq(rooms.levelId, levelRow.id), eq(rooms.name, room)),
      });
      if (!roomRow) {
        [roomRow] = await db
          .insert(rooms)
          .values({ levelId: levelRow.id, name: room, sortOrder: 0 })
          .returning();
      }
      let bsRow = await db.query.bookshelves.findFirst({
        where: and(eq(bookshelves.roomId, roomRow.id), eq(bookshelves.name, bookshelfName)),
      });
      if (!bsRow) {
        [bsRow] = await db
          .insert(bookshelves)
          .values({ roomId: roomRow.id, name: bookshelfName, rowCount: Math.max(shelfRow, 1), depthCount: 2 })
          .returning();
        const existing = await db
          .select({ shelfRow: locations.shelfRow, depth: locations.depth })
          .from(locations)
          .where(eq(locations.bookshelfId, bsRow.id));
        const existingSet = new Set(existing.map((l) => shelfSpotKey(l.shelfRow, l.depth)));
        for (const spot of desiredShelfSpots(bsRow.rowCount, bsRow.depthCount)) {
          if (!existingSet.has(shelfSpotKey(spot.shelfRow, spot.depth))) {
            await db
              .insert(locations)
              .values({ bookshelfId: bsRow.id, ...spot })
              .run();
          }
        }
      }
      await db
        .insert(locations)
        .values({ bookshelfId: bsRow.id, shelfRow, depth: depth as "front" | "back", notes: null, sortOrder: 0 })
        .onConflictDoNothing();
    }

    // Only 1 valid row → 1 level, 1 room, 1 bookshelf, 2 locations (rowCount=1, depthCount=2)
    const levels = await db.select().from(houseLevels);
    expect(levels).toHaveLength(1);
    expect(levels[0].name).toBe("Ground");

    const allLocs = await data.getLocations();
    expect(allLocs).toHaveLength(2); // front + back auto-generated
  });

  it("CSV import updates bookshelf rowCount/depthCount and repairs missing locations", async () => {
    const { db } = await import("./db");
    const { depthCountForDepth } = await import("./bookshelf-shape");

    // Seed a small bookshelf: 1 row, 1 depth → {1/front}
    const { bookshelf: bs, locations: seedLocs } = await seedShelf("Level", "Room", "Shelf", 1, 1);
    expect(seedLocs).toHaveLength(1);

    // Simulate importing a CSV row that exceeds the current shape:
    // shelfRow=2, depth="back" → should expand to 2 rows, 2 depths
    const shelfRow = 2;
    const depth = "back" as const;

    // --- mimic importLocationsAction ---
    // Compute new shape
    const rowCount = Math.max(bs.rowCount, shelfRow);
    const depthCount = Math.max(bs.depthCount, depthCountForDepth(depth));

    // Update bookshelf shape
    await db
      .update(bookshelves)
      .set({ rowCount, depthCount })
      .where(eq(bookshelves.id, bs.id))
      .run();

    // Repair missing locations (same logic as repairBookshelfLocations)
    const existingLocRows = await db
      .select({ shelfRow: locations.shelfRow, depth: locations.depth })
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id));
    const existingSet = new Set(existingLocRows.map((l) => shelfSpotKey(l.shelfRow, l.depth)));
    for (const spot of desiredShelfSpots(rowCount, depthCount)) {
      if (!existingSet.has(shelfSpotKey(spot.shelfRow, spot.depth))) {
        await db.insert(locations).values({ bookshelfId: bs.id, ...spot }).run();
      }
    }

    // Finally insert the specific row (as importLocationsAction does)
    await db
      .insert(locations)
      .values({ bookshelfId: bs.id, shelfRow, depth, notes: null, sortOrder: 0 })
      .onConflictDoNothing();
    // --- end mimic ---

    // Verify bookshelf shape was expanded
    const [updatedBs] = await db
      .select()
      .from(bookshelves)
      .where(eq(bookshelves.id, bs.id));
    expect(updatedBs.rowCount).toBe(2);
    expect(updatedBs.depthCount).toBe(2);

    // Verify all expected locations now exist
    const allLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id))
      .orderBy(locations.sortOrder);
    expect(allLocs).toHaveLength(4);
    expect(allLocs.map((l) => `${l.shelfRow}|${l.depth}`)).toEqual([
      "1|front",
      "1|back",
      "2|front",
      "2|back",
    ]);
  });

  it("CSV import does not shrink a bookshelf when a row fits within existing shape", async () => {
    const { db } = await import("./db");
    const { depthCountForDepth } = await import("./bookshelf-shape");

    // Seed a 3×2 bookshelf with all 6 locations
    const { bookshelf: bs } = await seedShelf("Level", "Room", "Big Shelf", 3, 2);

    // Simulate importing a row that fits: shelfRow=2, depth="front"
    const shelfRow = 2;
    const depth = "front" as const;

    const rowCount = Math.max(bs.rowCount, shelfRow);
    const depthCount = Math.max(bs.depthCount, depthCountForDepth(depth));

    // rowCount/depthCount should NOT change
    expect(rowCount).toBe(bs.rowCount);
    expect(depthCount).toBe(bs.depthCount);

    // No new locations should be needed
    const existingLocRows = await db
      .select({ shelfRow: locations.shelfRow, depth: locations.depth })
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id));
    const existingSet = new Set(existingLocRows.map((l) => shelfSpotKey(l.shelfRow, l.depth)));
    const missingSpots = desiredShelfSpots(rowCount, depthCount).filter(
      (spot) => !existingSet.has(shelfSpotKey(spot.shelfRow, spot.depth)),
    );
    expect(missingSpots).toHaveLength(0);

    // Insert the row (onConflictDoNothing since it already exists)
    await db
      .insert(locations)
      .values({ bookshelfId: bs.id, shelfRow, depth, notes: null, sortOrder: 0 })
      .onConflictDoNothing();

    // Verify shape unchanged
    const [updatedBs] = await db
      .select()
      .from(bookshelves)
      .where(eq(bookshelves.id, bs.id));
    expect(updatedBs.rowCount).toBe(3);
    expect(updatedBs.depthCount).toBe(2);

    // Verify still exactly 6 locations
    const allLocs = await db
      .select()
      .from(locations)
      .where(eq(locations.bookshelfId, bs.id));
    expect(allLocs).toHaveLength(6);
  });
});
