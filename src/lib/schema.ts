import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// ── Books ───────────────────────────────────────────────────────────────────

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    author: text("author").notNull(),
    isbn10: text("isbn10"),
    isbn13: text("isbn13"),
    subtitle: text("subtitle"),
    publisher: text("publisher"),
    publishedDate: text("published_date"),
    description: text("description"),
    pageCount: integer("page_count"),
    categories: text("categories"),
    seriesName: text("series_name"),
    seriesNumber: text("series_number"),
    coverImagePath: text("cover_image_path"),
    metadataSource: text("metadata_source"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("books_title_idx").on(table.title),
    index("books_author_idx").on(table.author),
    index("books_isbn10_idx").on(table.isbn10),
    index("books_isbn13_idx").on(table.isbn13),
  ],
);

// ── Normalised house / shelf model ──────────────────────────────────────────

export const houseLevels = sqliteTable(
  "house_levels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull().unique(),
    sortOrder: integer("sort_order").notNull().default(0),
    sceneKey: text("scene_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    levelId: integer("level_id").notNull().references(() => houseLevels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    sceneKey: text("scene_key"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("rooms_level_name_idx").on(table.levelId, table.name),
  ],
);

export const bookshelfDefinitions = sqliteTable(
  "bookshelf_definitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    rowCount: integer("row_count").notNull().default(6),
    depthCount: integer("depth_count").notNull().default(2),
    isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
);

export const bookshelves = sqliteTable(
  "bookshelves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: integer("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    definitionId: integer("definition_id").references(() => bookshelfDefinitions.id),
    name: text("name").notNull(),
    rowCount: integer("row_count").notNull().default(6),
    depthCount: integer("depth_count").notNull().default(2),
    sortOrder: integer("sort_order").notNull().default(0),
    sceneKey: text("scene_key"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("bookshelves_room_name_idx").on(table.roomId, table.name),
  ],
);

export const locations = sqliteTable(
  "locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookshelfId: integer("bookshelf_id").notNull().references(() => bookshelves.id, { onDelete: "cascade" }),
    shelfRow: integer("shelf_row").notNull(),
    depth: text("depth", { enum: ["front", "back"] }).notNull().default("front"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("locations_bs_row_depth_idx").on(table.bookshelfId, table.shelfRow, table.depth),
  ],
);

// ── Copies & loans ──────────────────────────────────────────────────────────

export const copies = sqliteTable(
  "copies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
    copyNumber: integer("copy_number").notNull(),
    locationId: integer("location_id").notNull().references(() => locations.id),
    notes: text("notes"),
    conditionNotes: text("condition_notes"),
    status: text("status", { enum: ["available", "loaned"] }).notNull().default("available"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("copies_book_idx").on(table.bookId),
    index("copies_location_idx").on(table.locationId),
    index("copies_status_idx").on(table.status),
    uniqueIndex("copies_book_copy_number_idx").on(table.bookId, table.copyNumber),
  ],
);

export const loans = sqliteTable(
  "loans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    copyId: integer("copy_id").notNull().references(() => copies.id, { onDelete: "cascade" }),
    borrowerName: text("borrower_name").notNull(),
    dateLoaned: text("date_loaned").notNull(),
    dateReturned: text("date_returned"),
    contactInfo: text("contact_info"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("loans_copy_idx").on(table.copyId), index("loans_returned_idx").on(table.dateReturned)],
);

// ── Relations ───────────────────────────────────────────────────────────────

export const bookRelations = relations(books, ({ many }) => ({ copies: many(copies) }));

export const houseLevelRelations = relations(houseLevels, ({ many }) => ({ rooms: many(rooms) }));
export const roomRelations = relations(rooms, ({ one, many }) => ({
  level: one(houseLevels, { fields: [rooms.levelId], references: [houseLevels.id] }),
  bookshelves: many(bookshelves),
}));
export const bookshelfDefinitionRelations = relations(bookshelfDefinitions, ({ many }) => ({
  bookshelves: many(bookshelves),
}));
export const bookshelfRelations = relations(bookshelves, ({ one, many }) => ({
  room: one(rooms, { fields: [bookshelves.roomId], references: [rooms.id] }),
  definition: one(bookshelfDefinitions, {
    fields: [bookshelves.definitionId],
    references: [bookshelfDefinitions.id],
  }),
  locations: many(locations),
}));
export const locationRelations = relations(locations, ({ one, many }) => ({
  bookshelf: one(bookshelves, { fields: [locations.bookshelfId], references: [bookshelves.id] }),
  copies: many(copies),
}));
export const copyRelations = relations(copies, ({ one, many }) => ({
  book: one(books, { fields: [copies.bookId], references: [books.id] }),
  location: one(locations, { fields: [copies.locationId], references: [locations.id] }),
  loans: many(loans),
}));
export const loanRelations = relations(loans, ({ one }) => ({
  copy: one(copies, { fields: [loans.copyId], references: [copies.id] }),
}));

// ── Types ───────────────────────────────────────────────────────────────────

export type Book = typeof books.$inferSelect;
export type HouseLevel = typeof houseLevels.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type BookshelfDefinition = typeof bookshelfDefinitions.$inferSelect;
export type Bookshelf = typeof bookshelves.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Copy = typeof copies.$inferSelect;
export type Loan = typeof loans.$inferSelect;
