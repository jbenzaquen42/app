import { exportLoansCsv } from "@/lib/csv";

export async function GET() {
  return new Response(await exportLoansCsv(), { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=loans.csv" } });
}
