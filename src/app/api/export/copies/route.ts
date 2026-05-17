import { exportCopiesCsv } from "@/lib/csv";

export async function GET() {
  return new Response(await exportCopiesCsv(), { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=copies.csv" } });
}
