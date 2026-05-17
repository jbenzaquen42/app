import { Card, PageHeader } from "@/components/ui";
import { coversDir, dataDir, dbPath } from "@/lib/paths";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <><PageHeader eyebrow="Settings" title="Home server notes" /><Card><dl className="grid gap-4 text-sm md:grid-cols-2"><div><dt className="font-bold">Data directory</dt><dd className="text-[#704b38]">{dataDir}</dd></div><div><dt className="font-bold">Database</dt><dd className="text-[#704b38]">{dbPath}</dd></div><div><dt className="font-bold">Cover cache</dt><dd className="text-[#704b38]">{coversDir}</dd></div><div><dt className="font-bold">Access model</dt><dd className="text-[#704b38]">Trusted Wi‑Fi/Tailscale. No accounts in first draft.</dd></div></dl><h2 className="mt-8 font-serif text-2xl font-bold">Backup guidance</h2><p className="mt-2 text-[#704b38]">Back up the mounted <code>/data</code> volume, including the SQLite database and cover cache. Avoid public internet exposure until authentication is added.</p></Card></>;
}
