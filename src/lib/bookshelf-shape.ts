export type ShelfDepth = "front" | "back";

export type ShelfSpot = {
  shelfRow: number;
  depth: ShelfDepth;
  sortOrder: number;
};

export function depthsForCount(depthCount: number): ShelfDepth[] {
  return depthCount >= 2 ? ["front", "back"] : ["front"];
}

export function depthCountForDepth(depth: ShelfDepth) {
  return depth === "back" ? 2 : 1;
}

export function desiredShelfSpots(rowCount: number, depthCount: number): ShelfSpot[] {
  const spots: ShelfSpot[] = [];
  let sortOrder = 0;
  for (let shelfRow = 1; shelfRow <= rowCount; shelfRow++) {
    for (const depth of depthsForCount(depthCount)) {
      spots.push({ shelfRow, depth, sortOrder: sortOrder++ });
    }
  }
  return spots;
}

export function shelfSpotKey(shelfRow: number, depth: ShelfDepth) {
  return `${shelfRow}|${depth}`;
}
