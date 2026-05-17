"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LocationDisplay } from "@/lib/data";

type ShelfGridProps = {
  locations: LocationDisplay[];
  selectedId?: number;
};

const depths = ["front", "back"] as const;

export function ShelfGrid({ locations, selectedId }: ShelfGridProps) {
  const rows = useMemo(() => [...new Set(locations.map((location) => location.shelfRow))].sort((a, b) => a - b), [locations]);
  const hasBack = locations.some((location) => location.depth === "back");
  const [visibleDepth, setVisibleDepth] = useState<"all" | "front" | "back">("all");
  const visibleDepths = depths.filter((depth) => hasBack ? visibleDepth === "all" || visibleDepth === depth : depth === "front");

  return (
    <div className="shelf-grid" aria-label="Bookshelf rows">
      {hasBack ? (
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Depth view">
          {(["all", "front", "back"] as const).map((depth) => (
            <button
              key={depth}
              type="button"
              onClick={() => setVisibleDepth(depth)}
              className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider transition ${visibleDepth === depth ? "bg-[#5e7d50] text-white shadow-md" : "bg-white/65 text-[#704b38] hover:bg-white"}`}
            >
              {depth === "all" ? "Both depths" : depth}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`mb-2 grid gap-2 text-xs font-bold uppercase tracking-wider text-[#8f6b52] ${visibleDepths.length === 2 ? "grid-cols-[3.5rem_1fr_1fr]" : "grid-cols-[3.5rem_1fr]"}`}>
        <span>Row</span>
        {visibleDepths.map((depth) => <span key={depth}>{depth}</span>)}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row} className={`grid gap-2 ${visibleDepths.length === 2 ? "grid-cols-[3.5rem_1fr_1fr]" : "grid-cols-[3.5rem_1fr]"}`}>
            <div className="flex items-center justify-center rounded-2xl bg-[#8f5f3f]/10 font-serif text-xl font-bold text-[#704b38]">{row}</div>
            {visibleDepths.map((depth) => {
              const location = locations.find((candidate) => candidate.shelfRow === row && candidate.depth === depth);
              const active = location?.id === selectedId;
              const copyCount = location?.copyCount ?? 0;
              return location ? (
                <div
                  key={depth}
                  className={`shelf-cell group relative ${depth === "back" ? "shelf-cell-back" : ""} ${active ? "shelf-cell-active" : ""}`}
                >
                  <Link
                    href={`/locations?location=${location.id}`}
                    className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e7d50] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf0]"
                    aria-label={`View ${depth} shelf row ${row}`}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider">{depth}</span>
                      <span className="block text-xs text-[#704b38]">Shelf row {row}</span>
                    </div>
                    <span className="rounded-full bg-[#5e7d50]/10 px-2 py-0.5 text-xs font-bold text-[#5e7d50]">{copyCount}</span>
                  </div>
                  <BookSpines count={copyCount} />
                  <div className="relative z-10 mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-[#704b38] group-hover:bg-white">View spot</span>
                    <Link className="rounded-full bg-[#8f5f3f] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#704b38] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5e7d50] focus-visible:ring-offset-2" href={`/books/new?locationId=${location.id}`}>Add book</Link>
                  </div>
                </div>
              ) : (
                <span key={depth} className="shelf-cell shelf-cell-empty">Not built</span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function BookSpines({ count }: { count: number }) {
  const visible = Math.min(count, 8);
  return (
    <div className="mt-2 flex min-h-5 items-end gap-1" aria-label={`${count} books in this shelf spot`}>
      {Array.from({ length: visible }).map((_, index) => (
        <span
          key={index}
          className="inline-block w-1.5 rounded-t-sm bg-[#8f5f3f]/70"
          style={{ height: `${12 + (index % 3) * 4}px` }}
        />
      ))}
      {count > visible ? <span className="text-xs font-bold text-[#704b38]">+{count - visible}</span> : null}
      {count === 0 ? <span className="text-xs font-bold text-[#8f6b52]">empty</span> : null}
    </div>
  );
}
