import { exportLocationsCsv } from "@/lib/csv";

export async function GET() {
  return new Response(await exportLocationsCsv(), { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=locations.csv" } });
}
