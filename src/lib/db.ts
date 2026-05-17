import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { dbPath, ensureDataDirs } from "./paths";
import * as schema from "./schema";

let sqlite: Database.Database | undefined;
type CountRow = { cnt: number };
type IdRow = { id: number };
type TableInfoRow = { name: string };
type LegacyLocationRow = {
  id: number;
  floor: string | null;
  room: string | null;
  shelf: string | null;
  section: string | null;
  notes: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export function getSqlite() {
  if (!sqlite) {
    ensureDataDirs();
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    initializeSchema(sqlite);
  }
  return sqlite;
}

// ── Schema versioning ───────────────────────────────────────────────────────

const SCHEMA_VERSION = 2;

export const db = drizzle(getSqlite(), { schema });

/** Close and reset the singleton connection (used by tests for isolation). */
export function resetDb() {
  if (sqlite) {
    sqlite.close();
    sqlite = undefined;
  }
}

function initializeSchema(database: Database.Database) {
  const version = database.pragma("user_version", { simple: true }) as number;

  if (version >= SCHEMA_VERSION) return;
  let shouldMigrateOldLocations = false;

  // ── Detect old flat locations schema before v2 creation ───────────────────
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  const hasOldLocations = tables.some((t) => t.name === "locations");

  if (hasOldLocations) {
    const cols = database.pragma("table_info(locations)") as TableInfoRow[];
    const isOldSchema = cols.some((column) => column.name === "floor");

    if (isOldSchema) {
      const hasBooks = tables.some((t) => t.name === "books");
      const bookCount = hasBooks
        ? (database.prepare("SELECT COUNT(*) as cnt FROM books").get() as CountRow).cnt
        : 0;

      if (bookCount > 0) {
        prepareOldLocationMigration(database, tables.map((table) => table.name));
        shouldMigrateOldLocations = true;
      } else {
        // No book data — safe to remake the old draft tables.
        database.exec("DROP TABLE IF EXISTS loans");
        database.exec("DROP TABLE IF EXISTS copies");
        database.exec("DROP TABLE IF EXISTS locations");
        database.exec("DROP TABLE IF EXISTS books");
      }
    }
  }

  // ── Create new schema ─────────────────────────────────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS books (
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
    CREATE INDEX IF NOT EXISTS books_title_idx ON books(title);
    CREATE INDEX IF NOT EXISTS books_author_idx ON books(author);
    CREATE INDEX IF NOT EXISTS books_isbn10_idx ON books(isbn10);
    CREATE INDEX IF NOT EXISTS books_isbn13_idx ON books(isbn13);

    CREATE TABLE IF NOT EXISTS house_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      scene_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level_id INTEGER NOT NULL REFERENCES house_levels(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      scene_key TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(level_id, name)
    );

    CREATE TABLE IF NOT EXISTS bookshelf_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 6,
      depth_count INTEGER NOT NULL DEFAULT 2,
      is_preset INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookshelves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      definition_id INTEGER REFERENCES bookshelf_definitions(id),
      name TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 6,
      depth_count INTEGER NOT NULL DEFAULT 2,
      sort_order INTEGER NOT NULL DEFAULT 0,
      scene_key TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, name)
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bookshelf_id INTEGER NOT NULL REFERENCES bookshelves(id) ON DELETE CASCADE,
      shelf_row INTEGER NOT NULL,
      depth TEXT NOT NULL DEFAULT 'front' CHECK(depth IN ('front', 'back')),
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(bookshelf_id, shelf_row, depth)
    );

    CREATE TABLE IF NOT EXISTS copies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      copy_number INTEGER NOT NULL,
      location_id INTEGER NOT NULL REFERENCES locations(id),
      notes TEXT,
      condition_notes TEXT,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'loaned')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(book_id, copy_number)
    );
    CREATE INDEX IF NOT EXISTS copies_book_idx ON copies(book_id);
    CREATE INDEX IF NOT EXISTS copies_location_idx ON copies(location_id);
    CREATE INDEX IF NOT EXISTS copies_status_idx ON copies(status);

    CREATE TABLE IF NOT EXISTS loans (
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
    CREATE INDEX IF NOT EXISTS loans_copy_idx ON loans(copy_id);
    CREATE INDEX IF NOT EXISTS loans_returned_idx ON loans(date_returned);
  `);

  if (shouldMigrateOldLocations) {
    migrateOldLocationsToHouseSchema(database);
  }

  // ── Seed defaults (idempotent) ────────────────────────────────────────────
  seedDefaults(database);

  database.pragma(`user_version = ${SCHEMA_VERSION}`);
}

// ── v1 flat location → v2 house/shelf migration ─────────────────────────────

function prepareOldLocationMigration(database: Database.Database, tableNames: string[]) {
  database.pragma("foreign_keys = OFF");
  database.exec("DROP TABLE IF EXISTS legacy_loans");
  database.exec("DROP TABLE IF EXISTS legacy_copies");
  database.exec("DROP TABLE IF EXISTS legacy_locations");
  if (tableNames.includes("loans")) database.exec("ALTER TABLE loans RENAME TO legacy_loans");
  if (tableNames.includes("copies")) database.exec("ALTER TABLE copies RENAME TO legacy_copies");
  database.exec("ALTER TABLE locations RENAME TO legacy_locations");
}

function migrateOldLocationsToHouseSchema(database: Database.Database) {
  const legacyLocations = database
    .prepare(
      `SELECT
        id,
        floor,
        room,
        shelf,
        section,
        notes,
        sort_order,
        created_at,
        updated_at
      FROM legacy_locations
      ORDER BY COALESCE(sort_order, id), id`,
    )
    .all() as LegacyLocationRow[];

  const insertLevel = database.prepare(
    "INSERT OR IGNORE INTO house_levels (name, sort_order, created_at, updated_at) VALUES (?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))",
  );
  const getLevel = database.prepare("SELECT id FROM house_levels WHERE name = ?");
  const insertRoom = database.prepare(
    "INSERT OR IGNORE INTO rooms (level_id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))",
  );
  const getRoom = database.prepare("SELECT id FROM rooms WHERE level_id = ? AND name = ?");
  const insertBookshelf = database.prepare(
    "INSERT OR IGNORE INTO bookshelves (room_id, name, row_count, depth_count, sort_order, created_at, updated_at) VALUES (?, ?, 1, 1, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))",
  );
  const getBookshelf = database.prepare("SELECT id, row_count, depth_count FROM bookshelves WHERE room_id = ? AND name = ?");
  const updateBookshelfShape = database.prepare(
    "UPDATE bookshelves SET row_count = MAX(row_count, ?), depth_count = MAX(depth_count, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  );
  const insertLocation = database.prepare(
    `INSERT INTO locations (id, bookshelf_id, shelf_row, depth, notes, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP))`,
  );

  const levelSort = new Map<string, number>();
  const roomSort = new Map<string, number>();
  const shelfSort = new Map<string, number>();
  const shelfRows = new Map<string, number>();

  for (const oldLocation of legacyLocations) {
    const levelName = normalizeLegacyPart(oldLocation.floor, "Unknown level");
    const roomName = normalizeLegacyPart(oldLocation.room, "Unknown room");
    const shelfName = normalizeLegacyPart(oldLocation.shelf, "Legacy bookshelf");
    const sectionName = normalizeLegacyPart(oldLocation.section, "Legacy section");
    const levelOrder = getOrCreateSort(levelSort, levelName);
    insertLevel.run(levelName, levelOrder, oldLocation.created_at, oldLocation.updated_at);
    const levelId = (getLevel.get(levelName) as IdRow).id;

    const roomKey = `${levelId}:${roomName}`;
    const roomOrder = getOrCreateSort(roomSort, roomKey);
    insertRoom.run(levelId, roomName, roomOrder, oldLocation.created_at, oldLocation.updated_at);
    const roomId = (getRoom.get(levelId, roomName) as IdRow).id;

    const shelfKey = `${roomId}:${shelfName}`;
    const shelfOrder = getOrCreateSort(shelfSort, shelfKey);
    insertBookshelf.run(roomId, shelfName, shelfOrder, oldLocation.created_at, oldLocation.updated_at);
    const bookshelf = getBookshelf.get(roomId, shelfName) as { id: number; row_count: number; depth_count: number };

    const row = getOrCreateSort(shelfRows, `${bookshelf.id}:${sectionName}`) + 1;
    const depth = sectionName.toLowerCase().includes("back") ? "back" : "front";
    const depthCount = depth === "back" ? 2 : 1;
    updateBookshelfShape.run(row, depthCount, bookshelf.id);
    insertLocation.run(
      oldLocation.id,
      bookshelf.id,
      row,
      depth,
      legacyLocationNotes(sectionName, oldLocation.notes),
      oldLocation.sort_order ?? row - 1,
      oldLocation.created_at,
      oldLocation.updated_at,
    );
  }

  copyLegacyTableRows(database, "legacy_copies", "copies", [
    ["id", "id"],
    ["book_id", "book_id"],
    ["copy_number", "copy_number"],
    ["location_id", "location_id"],
    ["notes", "notes"],
    ["condition_notes", "condition_notes"],
    ["status", "'available'"],
    ["created_at", "CURRENT_TIMESTAMP"],
    ["updated_at", "CURRENT_TIMESTAMP"],
  ]);
  copyLegacyTableRows(database, "legacy_loans", "loans", [
    ["id", "id"],
    ["copy_id", "copy_id"],
    ["borrower_name", "borrower_name"],
    ["date_loaned", "date_loaned"],
    ["date_returned", "date_returned"],
    ["contact_info", "contact_info"],
    ["notes", "notes"],
    ["created_at", "CURRENT_TIMESTAMP"],
    ["updated_at", "CURRENT_TIMESTAMP"],
  ]);

  database.exec("DROP TABLE IF EXISTS legacy_loans");
  database.exec("DROP TABLE IF EXISTS legacy_copies");
  database.exec("DROP TABLE IF EXISTS legacy_locations");
  database.pragma("foreign_keys = ON");
  const fkErrors = database.pragma("foreign_key_check") as unknown[];
  if (fkErrors.length > 0) throw new Error("Migration failed foreign key validation.");
}

function copyLegacyTableRows(
  database: Database.Database,
  legacyTable: string,
  targetTable: string,
  columns: Array<[target: string, sourceOrFallback: string]>,
) {
  const exists = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
    .get(legacyTable);
  if (!exists) return;
  const legacyColumns = new Set(
    (database.pragma(`table_info(${legacyTable})`) as TableInfoRow[]).map((column) => column.name),
  );
  const targetColumns = columns.map(([target]) => target).join(", ");
  const sourceColumns = columns
    .map(([target, sourceOrFallback]) => legacyColumns.has(target) ? target : sourceOrFallback)
    .join(", ");
  database.exec(`INSERT INTO ${targetTable} (${targetColumns}) SELECT ${sourceColumns} FROM ${legacyTable}`);
}

function normalizeLegacyPart(value: string | null, fallback: string) {
  return value?.trim() || fallback;
}

function getOrCreateSort(sortMap: Map<string, number>, key: string) {
  const existing = sortMap.get(key);
  if (existing !== undefined) return existing;
  const next = sortMap.size;
  sortMap.set(key, next);
  return next;
}

function legacyLocationNotes(sectionName: string, notes: string | null) {
  const sectionNote = `Legacy section: ${sectionName}`;
  return notes?.trim() ? `${sectionNote}\n${notes.trim()}` : sectionNote;
}

// ── Default seed data ───────────────────────────────────────────────────────

function seedDefaults(database: Database.Database) {
  const levelCount = (
    database.prepare("SELECT COUNT(*) as cnt FROM house_levels").get() as CountRow
  ).cnt;
  if (levelCount > 0) return; // already seeded

  // Levels
  database
    .prepare("INSERT INTO house_levels (name, sort_order) VALUES ('Downstairs', 0)")
    .run();
  database
    .prepare("INSERT INTO house_levels (name, sort_order) VALUES ('Upstairs', 1)")
    .run();

  const downstairsId = (
    database.prepare("SELECT id FROM house_levels WHERE name = 'Downstairs'").get() as IdRow
  ).id;
  const upstairsId = (
    database.prepare("SELECT id FROM house_levels WHERE name = 'Upstairs'").get() as IdRow
  ).id;

  // Rooms
  database
    .prepare("INSERT INTO rooms (level_id, name, sort_order) VALUES (?, 'Living Room', 0)")
    .run(downstairsId);
  database
    .prepare("INSERT INTO rooms (level_id, name, sort_order) VALUES (?, 'Loft', 0)")
    .run(upstairsId);

  // Preset definition
  database
    .prepare(
      "INSERT INTO bookshelf_definitions (name, row_count, depth_count, is_preset, sort_order) VALUES ('Tall bookshelf (6 shelves, 2 deep)', 6, 2, 1, 0)",
    )
    .run();

  // Bookshelves
  const livingRoomId = (
    database
      .prepare("SELECT id FROM rooms WHERE level_id = ? AND name = 'Living Room'")
      .get(downstairsId) as IdRow
  ).id;
  const loftId = (
    database
      .prepare("SELECT id FROM rooms WHERE level_id = ? AND name = 'Loft'")
      .get(upstairsId) as IdRow
  ).id;
  const defId = (
    database.prepare("SELECT id FROM bookshelf_definitions LIMIT 1").get() as IdRow
  ).id;

  database
    .prepare(
      "INSERT INTO bookshelves (room_id, definition_id, name, row_count, depth_count, sort_order) VALUES (?, ?, 'Downstairs Tall Shelf', 6, 2, 0)",
    )
    .run(livingRoomId, defId);
  database
    .prepare(
      "INSERT INTO bookshelves (room_id, definition_id, name, row_count, depth_count, sort_order) VALUES (?, ?, 'Upstairs Left Bookcase', 6, 2, 0)",
    )
    .run(loftId, defId);
  database
    .prepare(
      "INSERT INTO bookshelves (room_id, definition_id, name, row_count, depth_count, sort_order) VALUES (?, ?, 'Upstairs Right Bookcase', 6, 2, 1)",
    )
    .run(loftId, defId);

  // Generate locations for each bookshelf (row=1..rowCount, depth=front/back)
  const bookshelves = database
    .prepare("SELECT id, row_count, depth_count FROM bookshelves")
    .all() as { id: number; row_count: number; depth_count: number }[];

  const insertLoc = database.prepare(
    "INSERT INTO locations (bookshelf_id, shelf_row, depth, sort_order) VALUES (?, ?, ?, ?)",
  );

  for (const bs of bookshelves) {
    let sortOrder = 0;
    for (let row = 1; row <= bs.row_count; row++) {
      if (bs.depth_count >= 2) {
        insertLoc.run(bs.id, row, "front", sortOrder++);
        insertLoc.run(bs.id, row, "back", sortOrder++);
      } else {
        insertLoc.run(bs.id, row, "front", sortOrder++);
      }
    }
  }
}
