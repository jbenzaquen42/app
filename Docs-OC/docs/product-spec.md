# Cozy Home Library Manager — Product Spec

Working name: **Cozy Home Library Manager**  
Final app name: TBD, should be cute and book-themed.

## 1. Product vision

Build a self-hosted, Docker-friendly app for managing a personal physical book collection at home. The app should feel warm, cute, and easy to use while still being practical for cataloging, searching, locating, and loaning books.

The long-term vision is a cozy illustrated home/library interface where the user can move through floors, rooms, and shelves visually. The first version should prioritize a reliable catalog and loan workflow over polished art.

## 2. Primary users

- Home users managing a private physical book collection.
- Primary day-to-day user: the girlfriend receiving/using the library system.
- Occasional admin/helper: the person setting up and maintaining Docker/home-server access.

## 3. First milestone goal

Create a working local web app that can run in Docker and provide:

- Database-backed book/copy/location/loan CRUD.
- Phone-friendly ISBN scanning where feasible.
- Manual fallback for all import and edit flows.
- Fast catalog search and filters.
- Structured physical locations.
- Simple loan tracking with history.
- CSV import/export.
- Rough but pleasant responsive UI.
- Offline access to already-saved catalog/search/location/loan data.

The first milestone does **not** need final art, accounts, reminders, AI shelf mapping, or a fully illustrated clickable house.

## 4. Deployment and operating assumptions

- Runs self-hosted in Docker on a home server or mini PC.
- Access is trusted home Wi‑Fi and optionally Tailscale.
- No user accounts/authentication in the first milestone.
- Collection size target: roughly 100–500 books.
- Database should be simple and reliable; SQLite is preferred for MVP.
- Persistent Docker volumes should store:
  - SQLite database file.
  - Cached cover images.
  - Optional uploaded/imported files later.

## 5. Recommended first stack

This can change later, but the simplest strong default is:

- Full-stack web app: **Next.js** or another simple server-rendered React framework.
- Database: **SQLite**.
- ORM/query layer: **Drizzle ORM** or Prisma.
- Barcode scanning: browser camera barcode scanning library, with typed ISBN fallback.
- Styling: CSS/Tailwind with cozy cottage visual tokens.
- Container: single Docker image plus mounted `/data` volume.

Key requirement: the app should remain easy to deploy as a single container.

## 6. Core concepts

### Book

The bibliographic/title-level record. Example: *Howl's Moving Castle*.

Fields:

- ID
- Title **required**
- Author **required**
- ISBN-10
- ISBN-13
- Subtitle
- Publisher
- Published date/year
- Description
- Page count
- Categories/genres/tags
- Series name
- Series number
- Cover image path/cache key
- Metadata source fields/log
- Created/updated timestamps

### Physical copy

A real owned copy of a book. Multiple copies of the same book can exist.

Fields:

- ID
- Book ID
- Copy number, automatically assigned per book
- Location ID **required**
- Optional copy notes
- Condition/status notes
- Current status: `available` or `loaned`
- Created/updated timestamps

### Location

Structured home location using the hierarchy:

`Floor > Room > Shelf > Section`

Examples:

- Upstairs > Bedroom > White Bookshelf > Top Shelf
- Downstairs > Living Room > Tall Shelf > Manga Section

Fields:

- ID
- Floor **required**
- Room **required**
- Shelf **required**
- Section **required**
- Optional notes
- Sort order fields

### Loan

A record of a physical copy being loaned to someone.

Fields:

- ID
- Copy ID
- Borrower name **required**
- Date loaned **required**
- Date returned, nullable
- Optional contact info
- Optional notes
- Created/updated timestamps

Loans have no due dates or reminders in the first milestone, but loan history should be preserved.

## 7. MVP user flows

### Add a book by ISBN scan

1. User opens Add Book on phone.
2. User scans ISBN barcode with phone camera.
3. App attempts metadata lookup from multiple public sources.
4. App shows editable metadata form.
5. User chooses or creates location.
6. User saves book/copy.
7. App downloads/caches cover image if available.

Fallbacks:

- User can type ISBN manually.
- User can skip lookup and enter title/author manually.
- Required fields before saving: title, author, and location.

### Add another physical copy

1. User opens an existing book.
2. User clicks Add Copy.
3. App assigns next copy number.
4. User chooses location and optional copy notes.
5. Copy is saved independently.

### Search and browse catalog

User can search by:

- Title
- Author
- ISBN
- Series
- Tags/categories
- Location text
- Borrower/loan status, if helpful

User can filter by:

- Availability: available/loaned/all
- Floor
- Room
- Shelf
- Section
- Author
- Category/tag

### Browse by location

1. User opens Locations.
2. User drills into Floor > Room > Shelf > Section.
3. User sees all copies stored there.
4. User can open a book/copy from the location view.

### Loan a book

1. User opens a copy record.
2. User clicks Loan Out.
3. User enters borrower name, date loaned, and optional contact/notes.
4. Copy status becomes loaned.
5. Loan appears in active loans list and book/copy history.

### Return a book

1. User opens active loan.
2. User clicks Return.
3. App records return date.
4. Copy status becomes available.
5. Loan remains in history.

### CSV export/import

MVP should include CSV export/import for:

- Books/copies/locations together or in clearly documented separate files.
- Locations.
- Loans/history export may be included if simple; otherwise at least export current loan state.

Import should be forgiving and show preview/errors before applying when possible.

## 8. Metadata lookup

When an ISBN is scanned or typed, the app should attempt multiple public metadata sources to improve coverage and cover quality.

Potential sources:

- Open Library API
- Google Books API
- ISBNdb or other sources only if an API key is later desired

MVP behavior:

- Try free/no-key sources first.
- Merge best available metadata.
- Prefer user edits over remote metadata.
- Cache cover images locally in the mounted data volume.
- App should continue working offline for saved books once metadata and images are cached.

## 9. UI and visual direction

Style target: **cozy cottage / warm home library**.

Initial UI should be simple but not sterile:

- Warm cream/parchment backgrounds.
- Soft browns, sage greens, dusty pinks, and honey/gold accents.
- Rounded cards and gentle shadows.
- Cute but readable icons.
- Book cover grid/list options.
- Phone-first add/scan flow.
- Responsive layouts for phone, tablet, and desktop.

Future visual direction:

- Cute house with upstairs/downstairs navigation.
- Clickable rooms and bookshelves.
- Possible handmade Blender art or sourced cute sprites.
- Photo upload and shelf mapping assistance.

## 10. Navigation structure

MVP navigation:

- Dashboard
  - Recently added books
  - Active loans
  - Quick add/scan button
- Catalog
  - Search and filters
  - Book list/grid
- Add/Scan
  - Camera scan
  - Manual ISBN
  - Manual book entry
- Locations
  - Floor/room/shelf/section browser
  - Location CRUD
- Loans
  - Active loans
  - Loan history
- Import/Export
  - CSV tools
- Settings/About
  - Data location/status
  - App version

## 11. Offline behavior

The app does not need full offline-first editing in the first milestone, but it should support offline access to already-saved data from the server on the local network.

Required:

- Catalog, search, location views, and loan views work without internet access once data is saved.
- Cached covers display without internet.
- Metadata lookup gracefully reports when internet is unavailable.

Optional later:

- Progressive Web App install support.
- Client-side cache for use when the server is unreachable.

## 12. Non-goals for first milestone

- Public internet exposure.
- Multi-user accounts or permissions.
- Due dates/reminders.
- Fully custom illustrated house UI.
- AI/photo-based shelf mapping.
- Automatic book spine recognition from shelf photos.
- Mobile native app.
- Large library enterprise features.
- Paid metadata API dependency.

## 13. Future enhancements

- Illustrated home map with upstairs/downstairs and clickable rooms.
- Clickable bookshelf views.
- Upload room/shelf photos and manually map regions to locations.
- Drag/drop book placement on shelf photos.
- AI-assisted shelf/photo recognition if feasible.
- PWA install and stronger client offline mode.
- Optional lightweight auth if exposed beyond trusted network/Tailscale.
- Due dates and gentle reminders.
- Tags, favorites, reading status, wish list, and recommendations.
- Better backup/restore bundle including database and covers.

## 14. Suggested milestone breakdown

### Milestone 0 — Project foundation

- Choose app name placeholder.
- Create repository/app scaffold.
- Add Dockerfile and docker-compose file.
- Add SQLite database volume path.
- Add base responsive layout and cozy style tokens.

### Milestone 1 — Core data model and CRUD

- Book CRUD.
- Location CRUD.
- Physical copy CRUD.
- Basic dashboard and catalog list.

### Milestone 2 — Search, filters, and location browsing

- Fast text search.
- Availability and location filters.
- Floor > Room > Shelf > Section location browser.

### Milestone 3 — ISBN import

- Manual ISBN entry.
- Public metadata lookup.
- Cover download/cache.
- Phone-camera barcode scanning where browser support allows.

### Milestone 4 — Loans

- Loan out copy.
- Return copy.
- Active loans list.
- Loan history on copy/book pages.

### Milestone 5 — CSV and polish pass

- CSV import/export for books/copies/locations.
- Usability fixes.
- Responsive pass for phone scanning and desktop browsing.
- Basic backup guidance.

## 15. Open questions before implementation

1. Should the first implementation use Next.js, or would you prefer a simpler stack like Flask/FastAPI + server-rendered templates?
2. Should Docker expose the app only on the local network by default, e.g. port `3000`?
3. Should the first CSV format be one combined file or separate `books.csv`, `copies.csv`, and `locations.csv` files?
4. Should tags/categories be freeform text in MVP, or postponed until after core catalog/loans work?
5. Do you want the first UI to include a simple placeholder house/home dashboard, even before illustrated navigation exists?

## 16. Acceptance criteria for first working milestone

The app is considered useful enough for first real use when:

- It runs with `docker compose up`.
- Data persists after container restart.
- A user can add a book manually.
- A user can scan or type an ISBN and import metadata when online.
- A user can correct imported metadata before saving.
- A user can create locations using Floor > Room > Shelf > Section.
- A user can assign each physical copy to a location.
- A user can search and filter the catalog.
- A user can loan a copy to a friend and later return it.
- Loan history is preserved.
- CSV export/import exists for core catalog/location data.
- Saved catalog/search/location/loan data remains usable without internet access.
