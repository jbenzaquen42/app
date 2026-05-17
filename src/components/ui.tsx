import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="mb-8 rounded-[2rem] border border-amber-900/10 bg-[#fffaf0]/80 p-6 shadow-xl shadow-amber-950/5">
      {eyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-[#9b6b45]">{eyebrow}</p> : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="font-serif text-4xl font-black tracking-tight text-[#44291f] md:text-5xl">{title}</h1>
        {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </section>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`cozy-card ${className}`}>{children}</div>;
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
      {children}
    </Link>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "danger" | "secondary" }) {
  const className = variant === "danger" ? "btn-danger" : variant === "secondary" ? "btn-secondary" : "btn-primary";
  return <button className={className}>{children}</button>;
}

export function Field({ label, name, defaultValue, required, type = "text", placeholder, help }: { label: string; name: string; defaultValue?: string | number | null; required?: boolean; type?: string; placeholder?: string; help?: string }) {
  return (
    <label className="field-label">
      <span>{label}{required ? " *" : ""}</span>
      <input className="field-input" name={name} type={type} required={required} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
      {help ? <span className="text-xs font-medium normal-case tracking-normal text-[#8f6b52]">{help}</span> : null}
    </label>
  );
}

export function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) {
  return (
    <label className="field-label md:col-span-2">
      <span>{label}</span>
      <textarea className="field-input min-h-28" name={name} defaultValue={defaultValue ?? ""} />
    </label>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-[#c79b73] bg-[#fffaf0]/60 p-8 text-center text-[#704b38]">
      <div aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dca36b]/20 font-serif text-3xl text-[#8f5f3f]">▤</div>
      <p className="font-serif text-2xl font-bold text-[#44291f]">{title}</p>
      {children ? <div className="mt-2 text-sm">{children}</div> : null}
    </div>
  );
}

export function CoverArt({ src, title, className = "" }: { src?: string | null; title: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#d9b98f]/50 ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Cover for ${title}`} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-4 text-center font-serif text-lg font-bold text-[#6b4632]">
          {title}
        </div>
      )}
    </div>
  );
}
