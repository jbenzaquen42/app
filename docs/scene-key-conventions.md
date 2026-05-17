# Scene key conventions

`house_levels`, `rooms`, and `bookshelves` all include a nullable `sceneKey` field so the 2D house map can later connect to a Blender or 3D scene without changing the location model.

Use stable, lowercase, slug-style keys:

- Levels: `level.downstairs`, `level.upstairs`
- Rooms: `room.downstairs.living-room`, `room.upstairs.loft`
- Bookshelves: `shelf.downstairs.living-room.tall-shelf`, `shelf.upstairs.loft.left-bookcase`

Guidelines:

1. Treat `sceneKey` as an external asset identifier, not display text.
2. Never derive book location from a scene key; the database hierarchy remains the source of truth.
3. Keep keys stable when renaming a room or bookshelf if a 3D asset already references it.
4. Prefer prefix namespaces (`level.`, `room.`, `shelf.`) so Blender object names and app records are easy to match.
5. Shelf spots are addressed by `bookshelf.sceneKey + shelfRow + depth`; no separate scene key is needed for each row/depth unless a future 3D workflow requires it.
