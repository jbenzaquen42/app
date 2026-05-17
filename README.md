# Cozy Stacks

A self-hosted, Docker-friendly home library manager for physical books. The first draft focuses on practical cataloging: books, physical copies, structured home locations, ISBN lookup/scanning fallback, search, loans, and CSV export.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

To run the production build locally:

```bash
npm run build
npm start
```

Local data defaults to `./data` unless `LIBRARY_DATA_DIR` or `DATABASE_PATH` is set.

## Run with Docker

```bash
docker compose up --build
```

The app listens on port `3000` and stores persistent data in the `cozy-stacks-data` volume mounted at `/data` in the container.

Open <http://localhost:3000> after the container starts.

## Check the app

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## First-use flow

1. Create one or more locations: Floor > Room > Shelf > Section.
2. Use Add/Scan to scan or type an ISBN, or choose manual entry.
3. Review and correct metadata, choose a location, then save.
4. Browse/search the Catalog or Locations pages.
5. Loan a copy from a book detail page and return it from Loans.
6. Export CSV snapshots from Import/Export.

## Backup

Back up the Docker volume or the configured data directory. It contains:

- SQLite database
- Cached cover images

Avoid exposing this app directly to the public internet until authentication is added. The first draft assumes trusted home Wi‑Fi and/or Tailscale access.

## First-draft limitations

- No accounts/authentication.
- CSV import preview is not finished yet.
- Barcode camera access may require HTTPS depending on browser/device; typed ISBN fallback is always available.
- Illustrated house navigation and photo shelf mapping are future enhancements.
