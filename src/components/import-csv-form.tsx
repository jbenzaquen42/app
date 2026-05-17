"use client";

import { useState, type FormEvent } from "react";

export function ImportCsvForm({ title, action, requiredHeaders }: { title: string; action: (formData: FormData) => void | Promise<void>; requiredHeaders: string[] }) {
  const [preview, setPreview] = useState<string[][]>([]);
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  async function updatePreview(file?: File) {
    setFileName(file?.name ?? "");
    if (!file) {
      setPreview([]);
      return;
    }
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(0, 6)
      .map((row) => row.split(",").slice(0, 6));
    setPreview(rows);
    const headers = rows[0]?.map((header) => header.trim()) ?? [];
    const missing = requiredHeaders.filter((header) => !headers.includes(header));
    setErrors(missing.map((header) => `Missing required header: ${header}`));
  }

  function confirmImport(event: FormEvent<HTMLFormElement>) {
    if (errors.length || !window.confirm(`Import ${fileName || "this CSV"}? Invalid or duplicate rows will be skipped.`)) {
      event.preventDefault();
    }
  }

  return (
    <form action={action} onSubmit={confirmImport} className="rounded-2xl bg-white/60 p-4">
      <label className="field-label">
        <span>{title}</span>
        <input className="field-input" type="file" name="file" accept=".csv,text/csv" required onChange={(event) => updatePreview(event.target.files?.[0])} />
      </label>
      {preview.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[#d2ad84]/60 bg-[#fffaf0] text-xs text-[#704b38]">
          <div className="bg-[#f3dfbd] px-3 py-2 font-bold">Preview: first {preview.length - 1} row(s)</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-96">
              <tbody>
                {preview.map((row, index) => (
                  <tr key={index} className={index === 0 ? "font-bold" : "border-t border-[#e7d1aa]"}>
                    {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {errors.length ? <ul className="mt-3 rounded-xl bg-[#f7ddd8] p-3 text-sm font-bold text-[#7d2d2a]">{errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      <button className="btn-primary mt-3" disabled={errors.length > 0}>Import {title.replace(" CSV", "").toLowerCase()}</button>
    </form>
  );
}
