import { describe, expect, it } from "vitest";
import {
  depthsForCount,
  depthCountForDepth,
  desiredShelfSpots,
  shelfSpotKey,
} from "./bookshelf-shape";

describe("bookshelf-shape helpers", () => {
  describe("depthsForCount", () => {
    it("returns only ['front'] for depthCount 1", () => {
      expect(depthsForCount(1)).toEqual(["front"]);
    });

    it("returns ['front', 'back'] for depthCount >= 2", () => {
      expect(depthsForCount(2)).toEqual(["front", "back"]);
      expect(depthsForCount(3)).toEqual(["front", "back"]);
    });
  });

  describe("depthCountForDepth", () => {
    it("returns 2 for 'back'", () => {
      expect(depthCountForDepth("back")).toBe(2);
    });

    it("returns 1 for 'front'", () => {
      expect(depthCountForDepth("front")).toBe(1);
    });
  });

  describe("shelfSpotKey", () => {
    it("creates a pipe-delimited key from shelfRow and depth", () => {
      expect(shelfSpotKey(1, "front")).toBe("1|front");
      expect(shelfSpotKey(3, "back")).toBe("3|back");
    });
  });

  describe("desiredShelfSpots", () => {
    it("generates 1 spot for 1 row, 1 depth", () => {
      expect(desiredShelfSpots(1, 1)).toEqual([
        { shelfRow: 1, depth: "front", sortOrder: 0 },
      ]);
    });

    it("generates 2 spots for 2 rows, 1 depth", () => {
      expect(desiredShelfSpots(2, 1)).toEqual([
        { shelfRow: 1, depth: "front", sortOrder: 0 },
        { shelfRow: 2, depth: "front", sortOrder: 1 },
      ]);
    });

    it("generates 2 spots for 1 row, 2 depths", () => {
      expect(desiredShelfSpots(1, 2)).toEqual([
        { shelfRow: 1, depth: "front", sortOrder: 0 },
        { shelfRow: 1, depth: "back", sortOrder: 1 },
      ]);
    });

    it("generates 4 spots for 2 rows, 2 depths", () => {
      expect(desiredShelfSpots(2, 2)).toEqual([
        { shelfRow: 1, depth: "front", sortOrder: 0 },
        { shelfRow: 1, depth: "back", sortOrder: 1 },
        { shelfRow: 2, depth: "front", sortOrder: 2 },
        { shelfRow: 2, depth: "back", sortOrder: 3 },
      ]);
    });

    it("generates 12 spots for 6 rows, 2 depths", () => {
      expect(desiredShelfSpots(6, 2)).toHaveLength(12);
    });

    it("sortOrder increments monotonically across all spots", () => {
      const spots = desiredShelfSpots(3, 2);
      for (let i = 0; i < spots.length; i++) {
        expect(spots[i].sortOrder).toBe(i);
      }
    });

    it("every spot at even sortOrder is 'front', odd is 'back' when depthCount=2", () => {
      const spots = desiredShelfSpots(4, 2);
      for (const spot of spots) {
        if (spot.sortOrder % 2 === 0) {
          expect(spot.depth).toBe("front");
        } else {
          expect(spot.depth).toBe("back");
        }
      }
    });
  });
});
