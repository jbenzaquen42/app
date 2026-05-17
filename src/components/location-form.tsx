import { createBookshelfAction, createRoomAction, updateLocationNotesAction } from "@/app/actions";
import type { LocationDisplay } from "@/lib/data";
import type { BookshelfDefinition, HouseLevel, Room } from "@/lib/schema";
import { Field, SubmitButton } from "./ui";

export function LocationForm({
  location,
  levels = [],
  rooms = [],
  bookshelfDefinitions = [],
}: {
  location?: LocationDisplay;
  levels?: HouseLevel[];
  rooms?: Room[];
  bookshelfDefinitions?: BookshelfDefinition[];
}) {
  if (location) {
    return (
      <form action={updateLocationNotesAction.bind(null, location.id)} className="grid gap-3">
        <div className="rounded-2xl bg-white/60 p-4 text-sm font-bold text-[#704b38]">{location.displayPath}</div>
        <Field
          label="Notes"
          name="notes"
          defaultValue={location.notes}
          placeholder="e.g. Near the window"
        />
        <div>
          <SubmitButton>Save notes</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#f3dfbd]/50 p-4 text-sm text-[#704b38]">
        <strong className="text-[#44291f]">House recipe:</strong> choose a level, add rooms, then add bookcases. Every bookcase automatically gets shelf rows and front/back spots.
      </div>
      <form action={createRoomAction} className="grid gap-3 md:grid-cols-2">
        <label className="field-label">
          <span>Level *</span>
          <select className="field-input" name="levelId" required>
            {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
          </select>
        </label>
        <Field label="Room name" name="name" required placeholder="Living Room" />
        <div className="md:col-span-2">
          <SubmitButton>Add room</SubmitButton>
        </div>
      </form>
      <form action={createBookshelfAction} className="grid gap-3 md:grid-cols-2">
        <label className="field-label">
          <span>Room *</span>
          <select className="field-input" name="roomId" required>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
        <label className="field-label">
          <span>Bookshelf preset</span>
          <select className="field-input" name="definitionId" defaultValue="">
            <option value="">Custom size</option>
            {bookshelfDefinitions.map((definition) => (
              <option key={definition.id} value={definition.id}>
                {definition.name} ({definition.rowCount} rows · {definition.depthCount} deep)
              </option>
            ))}
          </select>
          <span className="text-xs font-medium normal-case tracking-normal text-[#8f6b52]">Pick a preset to link this shelf, or leave custom.</span>
        </label>
        <Field label="Bookshelf name" name="name" required placeholder="Tall Shelf" />
        <Field label="Rows" name="rowCount" type="number" defaultValue={6} />
        <Field label="Depths" name="depthCount" type="number" defaultValue={2} />
        <Field label="Notes" name="notes" placeholder="Oak shelf by the window…" />
        <div className="md:col-span-2">
          <SubmitButton>Add bookshelf</SubmitButton>
        </div>
      </form>
    </div>
  );
}
