import Link from "next/link";
import { BookOpen, Home, LibraryBig, MapPinned, PackagePlus, ScrollText, Settings, Upload } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/catalog", label: "Catalog", icon: LibraryBig },
  { href: "/scan", label: "Add/Scan", icon: PackagePlus },
  { href: "/locations", label: "Locations", icon: MapPinned },
  { href: "/loans", label: "Loans", icon: ScrollText },
  { href: "/import-export", label: "CSV", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-amber-900/10 bg-[#fff8e8]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#8f5f3f] text-[#fff8e8] shadow-lg shadow-amber-950/10">
            <BookOpen size={23} />
          </span>
          <span>
            <span className="block font-serif text-2xl font-bold leading-none text-[#4b2d22]">Cozy Stacks</span>
            <span className="text-xs uppercase tracking-[0.25em] text-[#8f5f3f]">home library</span>
          </span>
        </Link>
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="nav-pill">
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
