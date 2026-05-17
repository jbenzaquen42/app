"use client";

import { useMemo, useState } from "react";
import type { LocationDisplay } from "@/lib/data";

type LocationPickerProps = {
  locations: LocationDisplay[];
  name?: string;
  defaultValue?: number;
};

export function LocationPicker({ locations, name = "locationId", defaultValue }: LocationPickerProps) {
  const initial = defaultValue ? locations.find((location) => location.id === defaultValue) : undefined;
  const [levelName, setLevelName] = useState(initial?.levelName ?? "");
  const [roomName, setRoomName] = useState(initial?.roomName ?? "");
  const [bookshelfName, setBookshelfName] = useState(initial?.bookshelfName ?? "");
  const [shelfRow, setShelfRow] = useState(initial?.shelfRow ? String(initial.shelfRow) : "");
  const [depth, setDepth] = useState(initial?.depth ?? "");

  const levels = useMemo(() => unique(locations.map((location) => location.levelName)), [locations]);
  const rooms = useMemo(
    () => unique(locations.filter((location) => location.levelName === levelName).map((location) => location.roomName)),
    [locations, levelName],
  );
  const bookshelves = useMemo(
    () => unique(locations.filter((location) => location.levelName === levelName && location.roomName === roomName).map((location) => location.bookshelfName)),
    [locations, levelName, roomName],
  );
  const rows = useMemo(
    () => unique(
      locations
        .filter((location) => location.levelName === levelName && location.roomName === roomName && location.bookshelfName === bookshelfName)
        .map((location) => String(location.shelfRow)),
    ).sort((a, b) => Number(a) - Number(b)),
    [locations, levelName, roomName, bookshelfName],
  );
  const depths = useMemo(
    () => unique(
      locations
        .filter((location) => location.levelName === levelName && location.roomName === roomName && location.bookshelfName === bookshelfName && String(location.shelfRow) === shelfRow)
        .map((location) => location.depth),
    ),
    [locations, levelName, roomName, bookshelfName, shelfRow],
  );

  const selectedLocation = locations.find(
    (location) =>
      location.levelName === levelName &&
      location.roomName === roomName &&
      location.bookshelfName === bookshelfName &&
      String(location.shelfRow) === shelfRow &&
      location.depth === depth,
  );

  function chooseLevel(nextLevel: string) {
    const nextLocation = locations.find((location) => location.levelName === nextLevel);
    applyLocation(nextLocation);
  }

  function chooseRoom(nextRoom: string) {
    const nextLocation = locations.find((location) => location.levelName === levelName && location.roomName === nextRoom);
    applyLocation(nextLocation);
  }

  function chooseBookshelf(nextBookshelf: string) {
    const nextLocation = locations.find((location) => location.levelName === levelName && location.roomName === roomName && location.bookshelfName === nextBookshelf);
    applyLocation(nextLocation);
  }

  function chooseRow(nextRow: string) {
    const nextLocation = locations.find((location) => location.levelName === levelName && location.roomName === roomName && location.bookshelfName === bookshelfName && String(location.shelfRow) === nextRow);
    applyLocation(nextLocation);
  }

  function applyLocation(location: LocationDisplay | undefined) {
    setLevelName(location?.levelName ?? "");
    setRoomName(location?.roomName ?? "");
    setBookshelfName(location?.bookshelfName ?? "");
    setShelfRow(location?.shelfRow ? String(location.shelfRow) : "");
    setDepth(location?.depth ?? "");
  }

  function chooseById(locationId: string) {
    const nextLocation = locations.find((location) => String(location.id) === locationId);
    applyLocation(nextLocation);
  }

  return (
    <div className="rounded-[1.35rem] border border-[#d2ad84]/50 bg-[#fffaf0]/65 p-4 md:col-span-2">
      <input type="hidden" name={name} value={selectedLocation?.id ?? ""} required />
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#8f5f3f]">Where does it live?</p>
          <p className="text-sm font-bold text-[#704b38]">Choose level → room → bookcase → shelf row → depth.</p>
        </div>
        {selectedLocation ? <span className="rounded-full bg-[#5e7d50]/10 px-3 py-1 text-xs font-black text-[#5e7d50]">{selectedLocation.displayPath}</span> : null}
      </div>
      <label className="field-label md:hidden">
        <span>Shelf spot</span>
        <select className="field-input" value={selectedLocation?.id ?? ""} onChange={(event) => chooseById(event.target.value)} required>
          <option value="">Choose a shelf spot…</option>
          {locations.map((location) => <option key={location.id} value={location.id}>{location.displayPath}</option>)}
        </select>
      </label>
      <div className="hidden gap-3 md:grid md:grid-cols-5">
        <PickerSelect label="Level" value={levelName} options={levels} onChange={chooseLevel} />
        <PickerSelect label="Room" value={roomName} options={rooms} onChange={chooseRoom} />
        <PickerSelect label="Bookcase" value={bookshelfName} options={bookshelves} onChange={chooseBookshelf} />
        <PickerSelect label="Row" value={shelfRow} options={rows} onChange={chooseRow} />
        <PickerSelect label="Depth" value={depth} options={depths} onChange={setDepth} />
      </div>
    </div>
  );
}

function PickerSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      <span>{label}</span>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Choose…</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}
