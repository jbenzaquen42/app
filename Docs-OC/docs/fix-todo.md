# Fix Todo — First Draft QA Follow-ups

This list tracks fixes discovered during automated stress testing and real-user QA.

## Must fix before calling first draft stable

- [x] Complete a real browser workflow pass using the app UI:
  - [x] Create multiple locations.
  - [x] Add multiple books/copies through the UI.
  - [x] Add duplicate copies.
  - [x] Loan and return copies.
  - [x] Browse/search/filter catalog.
  - [x] Visit CSV import/export.
- [x] Fix blocking UI bugs discovered during that pass.
- [x] Run full validation suite after fixes.

## Fixed during QA

- [x] Fix loan/return server action transaction crash from async transaction callbacks.
- [x] Revalidate book detail pages after loan/return actions so copy status updates correctly.
- [x] Fix delegated stress-test lint issues.

## Should fix soon

- [x] Improve location UX with friendlier labels/examples.
- [x] Add import preview with row-level validation.
- [x] Improve scanner lifecycle warnings in dev.
- [x] Improve cover display across catalog/book cards.
- [x] Add stronger destructive-action confirmations.

## Fixed after final goal pass

- [x] Added location-form guidance and placeholders explaining Floor / Room / Shelf / Section.
- [x] Added CSV import previews with required-header checks before submit.
- [x] Changed scanner to start camera only after the user clicks “Start camera scan”.
- [x] Added reusable cover art rendering for catalog, dashboard, and book detail pages.
- [x] Added confirmation prompts for deleting books, copies, and locations.
- [x] Re-ran full validation suite successfully.

## Deferred overhaul items

- [ ] Replace raw location CRUD with guided “Where is this book?” flow.
- [ ] Add cozy illustrated home/dashboard navigation.
- [ ] Add room/shelf visual browsing.
- [ ] Add photo-based shelf mapping prototype.
