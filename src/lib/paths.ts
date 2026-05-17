import fs from "node:fs";
import path from "node:path";

export const dataDir = process.env.LIBRARY_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
export const coversDir = path.join(dataDir, "covers");
export const dbPath = process.env.DATABASE_PATH ?? path.join(dataDir, "library.sqlite");

export function ensureDataDirs() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(coversDir, { recursive: true });
}

export function coverPublicPath(fileName: string) {
  return `/covers/${fileName}`;
}
