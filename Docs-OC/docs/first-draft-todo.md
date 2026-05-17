# First Draft App Todo List

This todo list is for completing the first usable draft of the self-hosted cozy home library manager described in `docs/product-spec.md`.

Definition of first draft: a Docker-runnable local app with persistent database-backed CRUD, responsive rough UI, saved-data offline usability, ISBN import/scanning fallback, structured locations, search/filtering, CSV import/export, multiple copies, and loan history.

## Phase 0 — Project decisions

- [x] Choose initial app name placeholder.
- [x] Confirm first implementation stack.
  - Suggested default: Next.js + SQLite + Drizzle ORM + Tailwind/CSS.
- [x] Confirm Docker default port.
  - Suggested default: `3000`.
- [x] Confirm CSV strategy.
  - Suggested default: separate `books.csv`, `copies.csv`, `locations.csv`, `loans.csv` exports, with import support for books/copies/locations first.
- [x] Decide whether tags/categories ship in first draft as freeform text.
- [x] Decide whether the dashboard includes a simple placeholder cozy house card before illustrated navigation exists.

## Phase 1 — Repository and app foundation

- [x] Scaffold web app project.
- [x] Add package manager lockfile.
- [x] Add project README with local setup instructions.
- [x] Add `.gitignore` for dependencies, build output, local data, environment files, and generated cache files.
- [x] Add environment variable pattern for data paths and app settings.
- [x] Add base app shell/layout.
- [x] Add primary navigation:
  - [x] Dashboard
  - [x] Catalog
  - [x] Add/Scan
  - [x] Locations
  - [x] Loans
  - [x] Import/Export
  - [x] Settings/About
- [x] Add responsive layout foundation for desktop and phone.
- [x] Add cozy visual tokens:
  - [x] Cream/parchment background
  - [x] Warm browns
  - [x] Sage green
  - [x] Dusty pink
  - [x] Honey/gold accent
  - [x] Rounded cards
  - [x] Gentle shadows
- [ ] Add reusable UI primitives:
  - [ ] Button
  - [ ] Input
  - [ ] Textarea
  - [ ] Select
  - [ ] Checkbox/toggle if needed
  - [ ] Card
  - [ ] Modal/dialog
  - [ ] Empty state
  - [ ] Error state
  - [ ] Loading state
  - [ ] Toast/notification

## Phase 2 — Docker and persistence foundation

- [x] Add Dockerfile for production app.
- [x] Add `docker-compose.yml`.
- [x] Configure persistent `/data` volume.
- [x] Configure SQLite database path inside `/data`.
- [x] Configure cover image cache directory inside `/data/covers`.
- [x] Ensure app creates required data directories on startup.
- [x] Document Docker usage:
  - [x] `docker compose up`
  - [x] Volume location
  - [x] Backup guidance
  - [x] Local network/Tailscale access note
- [ ] Verify data persists after container restart.

## Phase 3 — Database schema and migrations

- [x] Add ORM/query library.
- [x] Add migration tooling.
- [x] Create `books` table.
  - [x] `id`
  - [x] `title` required
  - [x] `author` required
  - [x] `isbn10`
  - [x] `isbn13`
  - [x] `subtitle`
  - [x] `publisher`
  - [x] `publishedDate` or `publishedYear`
  - [x] `description`
  - [x] `pageCount`
  - [x] `categories` or `tags`
  - [x] `seriesName`
  - [x] `seriesNumber`
  - [x] `coverImagePath`
  - [x] `metadataSource`
  - [x] `createdAt`
  - [x] `updatedAt`
- [x] Create `locations` table.
  - [x] `id`
  - [x] `floor` required
  - [x] `room` required
  - [x] `shelf` required
  - [x] `section` required
  - [x] `notes`
  - [x] `sortOrder`
  - [x] `createdAt`
  - [x] `updatedAt`
- [x] Create `copies` table.
  - [x] `id`
  - [x] `bookId`
  - [x] `copyNumber`
  - [x] `locationId`
  - [x] `notes`
  - [x] `conditionNotes`
  - [x] `status`: `available` or `loaned`
  - [x] `createdAt`
  - [x] `updatedAt`
- [x] Create `loans` table.
  - [x] `id`
  - [x] `copyId`
  - [x] `borrowerName` required
  - [x] `dateLoaned` required
  - [x] `dateReturned` nullable
  - [x] `contactInfo`
  - [x] `notes`
  - [x] `createdAt`
  - [x] `updatedAt`
- [x] Add indexes for search/filter performance.
  - [x] Book title
  - [x] Book author
  - [x] ISBN fields
  - [x] Location hierarchy fields
  - [x] Copy status
  - [x] Loan active state/date fields
- [ ] Add migration command/documentation.
- [ ] Add seed data script for local development.

## Phase 4 — Server/domain logic

- [x] Add validation schemas for book input.
- [x] Add validation schemas for location input.
- [x] Add validation schemas for copy input.
- [x] Add validation schemas for loan input.
- [x] Implement book create/update/delete/read functions.
- [x] Implement location create/update/delete/read functions.
- [x] Implement copy create/update/delete/read functions.
- [x] Implement loan create/update/delete/read functions.
- [x] Implement automatic copy number assignment per book.
- [ ] Prevent deleting a book with copies unless using an explicit cascade/confirmation flow.
- [ ] Prevent deleting a location currently assigned to copies unless reassigned or confirmed.
- [x] Ensure loaning a copy changes copy status to `loaned`.
- [x] Ensure returning a loan records `dateReturned` and changes copy status to `available`.
- [x] Ensure only one active loan can exist per copy.
- [ ] Add centralized error handling for validation/database failures.

## Phase 5 — Core CRUD UI

### Books and catalog

- [ ] Build catalog page.
- [ ] Add book list view.
- [ ] Add book card/grid view if practical.
- [ ] Add book detail page.
- [ ] Add manual book create form.
- [ ] Add book edit form.
- [ ] Add book delete confirmation.
- [ ] Display cover image when available.
- [ ] Display placeholder cover when missing.
- [ ] Display copies under book detail.
- [ ] Add copy count and availability summary to book cards/list rows.

### Physical copies

- [ ] Add copy creation flow from book detail.
- [ ] Add copy edit flow.
- [ ] Add copy delete confirmation.
- [ ] Show copy number.
- [ ] Show copy location.
- [ ] Show copy status.
- [ ] Show copy notes/condition notes.
- [ ] Allow moving a copy to another location.

### Locations

- [ ] Build locations page.
- [ ] Add location create form.
- [ ] Add location edit form.
- [ ] Add location delete confirmation.
- [ ] Add Floor > Room > Shelf > Section browser.
- [ ] Show copies assigned to selected location.
- [ ] Allow opening book/copy from location view.
- [ ] Add sensible sort order for floors/rooms/shelves/sections.

## Phase 6 — Search and filters

- [ ] Add search input to catalog.
- [ ] Search by title.
- [ ] Search by author.
- [ ] Search by ISBN-10/ISBN-13.
- [ ] Search by series.
- [ ] Search by tags/categories if included.
- [ ] Search by location text.
- [ ] Add availability filter:
  - [ ] All
  - [ ] Available
  - [ ] Loaned
- [ ] Add location filters:
  - [ ] Floor
  - [ ] Room
  - [ ] Shelf
  - [ ] Section
- [ ] Add author filter if practical.
- [ ] Add category/tag filter if included.
- [ ] Add clear filters button.
- [ ] Add empty state for no results.
- [ ] Ensure search/filter remains fast for 100–500 books.

## Phase 7 — Dashboard

- [ ] Build dashboard page.
- [ ] Add quick Add/Scan button.
- [ ] Add recently added books section.
- [ ] Add active loans section.
- [ ] Add small stats summary:
  - [ ] Total books
  - [ ] Total physical copies
  - [ ] Active loans
  - [ ] Locations count
- [ ] Add cozy placeholder house/library visual card if chosen.
- [ ] Add links to Catalog, Locations, and Loans.

## Phase 8 — ISBN metadata import

- [ ] Add ISBN utility functions.
  - [ ] Normalize ISBN input.
  - [ ] Validate ISBN-10.
  - [ ] Validate ISBN-13.
  - [ ] Convert ISBN-10/ISBN-13 where useful.
- [ ] Add metadata lookup service interface.
- [ ] Implement Open Library lookup.
- [ ] Implement Google Books lookup.
- [ ] Merge metadata from multiple sources.
- [ ] Prefer better cover image when sources differ.
- [ ] Preserve source attribution/debug info.
- [ ] Build manual ISBN entry flow.
- [ ] Show lookup loading state.
- [ ] Show lookup failure state with manual-entry fallback.
- [ ] Show editable review form before saving imported book.
- [ ] Allow correcting title, author, ISBNs, metadata, and location before save.
- [ ] Download/cache cover image into `/data/covers`.
- [ ] Store local cached cover path in database.
- [ ] Handle missing cover gracefully.
- [ ] Handle internet unavailable gracefully.

## Phase 9 — Barcode scanning

- [ ] Choose browser barcode scanning library/API.
- [ ] Build phone-friendly scan page.
- [ ] Request camera permission clearly.
- [ ] Scan EAN/ISBN barcodes.
- [ ] Extract ISBN from scan result.
- [ ] Trigger metadata lookup after successful scan.
- [ ] Add manual ISBN fallback on same screen.
- [ ] Add guidance for HTTPS/camera limitations if browser requires secure context.
- [ ] Test on desktop browser with manual fallback.
- [ ] Test on phone browser where possible.
- [ ] Ensure failed camera access does not block manual entry.

## Phase 10 — Loans

- [ ] Build loans page.
- [ ] Add active loans list.
- [ ] Add loan history list.
- [ ] Add loan-out flow from copy/book detail.
- [ ] Add borrower name field.
- [ ] Add date loaned field with sensible default to today.
- [ ] Add optional contact info field.
- [ ] Add optional notes field.
- [ ] Add return flow.
- [ ] Record return date.
- [ ] Show loan status on catalog/book/copy views.
- [ ] Show loan history on book/copy detail.
- [ ] Prevent loaning an already-loaned copy.
- [ ] Allow editing loan notes/contact info if needed.
- [ ] No due dates/reminders in first draft.

## Phase 11 — CSV import/export

- [ ] Define CSV schemas.
  - [ ] `books.csv`
  - [ ] `copies.csv`
  - [ ] `locations.csv`
  - [ ] `loans.csv` export if practical
- [ ] Document required and optional columns.
- [x] Implement locations export.
- [x] Implement books export.
- [x] Implement copies export.
- [x] Implement loans export or active-loans export.
- [x] Implement locations import.
- [x] Implement books import.
- [x] Implement copies import.
- [ ] Add import preview if practical.
- [ ] Add validation errors for bad CSV rows.
- [ ] Support matching existing locations during import.
- [ ] Support matching existing books by ISBN/title-author during import if practical.
- [ ] Add user-facing import success/failure summary.
- [ ] Include sample CSV files or examples in docs.

## Phase 12 — Offline saved-data behavior

- [ ] Ensure saved catalog pages do not depend on external APIs.
- [ ] Ensure saved location pages do not depend on external APIs.
- [ ] Ensure saved loan pages do not depend on external APIs.
- [ ] Ensure cached cover images load from local volume/path.
- [ ] Ensure metadata lookup failure does not affect existing catalog use.
- [ ] Add clear message when lookup cannot access internet.
- [ ] Optional: add basic PWA manifest if low effort.
- [ ] Optional: add service worker/client cache only if it does not complicate first draft.

## Phase 13 — Settings/About and maintenance

- [ ] Add Settings/About page.
- [ ] Show app version/build info.
- [ ] Show database path or data volume info.
- [ ] Show cover cache info if useful.
- [ ] Add backup guidance:
  - [ ] Stop container or use safe backup method.
  - [ ] Copy `/data` volume.
  - [ ] Restore `/data` volume.
- [ ] Add note that app assumes trusted Wi‑Fi/Tailscale and no public exposure.
- [ ] Add note that no accounts/auth are included in first draft.

## Phase 14 — UX polish pass

- [ ] Improve phone Add/Scan flow spacing and button sizes.
- [ ] Improve desktop catalog browsing density.
- [ ] Add helpful empty states:
  - [ ] No books yet
  - [ ] No locations yet
  - [ ] No active loans
  - [ ] No search results
- [ ] Add confirmation dialogs for destructive actions.
- [ ] Add success/error toasts for common actions.
- [ ] Add loading skeletons/spinners where needed.
- [ ] Add accessible labels for form fields and buttons.
- [ ] Verify keyboard navigation for core flows.
- [ ] Verify color contrast for cozy palette.
- [ ] Ensure forms clearly mark required fields.
- [ ] Ensure validation errors are readable and actionable.

## Phase 15 — Testing and validation

- [x] Run real-user stress test pass with realistic locations, books, copies, loans, returns, searches, and CSV exports.
- [x] Add basic automated tests for ISBN utilities.
- [ ] Add basic automated tests for metadata merge logic.
- [x] Add basic automated tests for loan state transitions.
- [x] Add basic automated tests for copy number assignment.
- [x] Add basic automated tests for CSV parsing/export formatting.
- [ ] Add manual test checklist.
- [ ] Manually test adding a book without ISBN.
- [ ] Manually test adding a book by typed ISBN.
- [ ] Manually test scanner fallback path.
- [ ] Manually test creating and editing a location.
- [ ] Manually test assigning a copy to a location.
- [ ] Manually test multiple copies of one book.
- [ ] Manually test search and filters.
- [ ] Manually test loan out and return.
- [ ] Manually test loan history remains after return.
- [ ] Manually test CSV export.
- [ ] Manually test CSV import on fresh data.
- [ ] Manually test app without internet after data is saved.
- [ ] Manually test Docker container restart preserves data.
- [x] Run lint/typecheck/test commands.
- [x] Fix all first-draft blocking errors found so far.

## Phase 16 — First draft documentation

- [ ] Update README with project purpose.
- [ ] Add local development setup.
- [ ] Add Docker setup.
- [ ] Add first-run instructions.
- [ ] Add how to add books manually.
- [ ] Add how to scan/type ISBNs.
- [ ] Add how to create locations.
- [ ] Add how to loan/return books.
- [ ] Add CSV import/export instructions.
- [ ] Add backup/restore guidance.
- [ ] Add limitations/non-goals for first draft.
- [ ] Add future roadmap summary.

## Phase 17 — First draft acceptance checklist

- [ ] App runs with `docker compose up`.
- [ ] Data persists after container restart.
- [ ] User can add a book manually.
- [ ] User can scan or type an ISBN and import metadata when online.
- [ ] User can correct imported metadata before saving.
- [ ] User can create locations using Floor > Room > Shelf > Section.
- [ ] User can assign each physical copy to a location.
- [ ] User can track multiple copies of the same book.
- [ ] User can search catalog by title, author, ISBN, and location text.
- [ ] User can filter by availability and location.
- [ ] User can loan a copy to a friend.
- [ ] User can return a loaned copy.
- [ ] Loan history is preserved.
- [ ] CSV export/import exists for core catalog/location data.
- [ ] Saved catalog/search/location/loan data remains usable without internet access.
- [ ] UI is rough but usable on phone and desktop.
- [ ] First-draft docs are complete enough to run and use the app.
