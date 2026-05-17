import fs from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { coversDir } from "@/lib/paths";

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file.includes("..") || file.includes("/") || file.includes("\\")) notFound();
  try {
    const body = await fs.readFile(path.join(coversDir, file));
    const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=31536000" } });
  } catch {
    notFound();
  }
}
