import Link from "next/link";
import { lookupIsbnAction } from "@/app/actions";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return <><PageHeader eyebrow="Add/Scan" title="Catalog a book"><Link className="btn-secondary" href="/books/new">Manual entry</Link></PageHeader><div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]"><Card><h2 className="font-serif text-2xl font-bold">Scan with your phone camera</h2><p className="mb-4 text-[#704b38]">If the browser blocks camera access, type the ISBN instead. Saved books remain usable without internet.</p><form action={lookupIsbnAction} className="space-y-4"><BarcodeScanner /><button className="btn-primary w-full">Look up ISBN</button></form></Card><Card><h2 className="font-serif text-2xl font-bold">What happens next?</h2><ol className="mt-4 list-decimal space-y-3 pl-5 text-[#704b38]"><li>Try Open Library and Google Books metadata.</li><li>Cache a cover image locally when available.</li><li>Let you correct fields before saving.</li><li>Require only title, author, and location.</li></ol></Card></div></>;
}
