import { getAdminSession } from "@/lib/auth/admin-session";
import { listProductosForOskCsvExport } from "@/lib/data/productos-export-osk";
import { buildProductosOskCsv } from "@/lib/export/productos-osk-csv";
import { NextResponse } from "next/server";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rows = await listProductosForOskCsvExport();
  const csv = buildProductosOskCsv(rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="repuestos osk.csv"',
    },
  });
}
