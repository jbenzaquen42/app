import { exportBooksCsv } from "@/lib/csv";

export async function GET() {
  return new Response(await exportBooksCsv(), { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=books.csv" } });
}
