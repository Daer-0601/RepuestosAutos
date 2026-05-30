import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { buscarClientesActivosParaCredito } from "@/lib/data/ventas-vendedor";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const ctx = await getVendedorStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number(searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw) ? limitRaw : 25;

  const clientes = await buscarClientesActivosParaCredito(q, limit);

  return NextResponse.json({ clientes }, { headers: { "Cache-Control": "no-store" } });
}
