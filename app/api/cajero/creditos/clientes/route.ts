import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { buscarClientesCreditosPendientesSucursal } from "@/lib/data/creditos";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) ? limitRaw : 25;

  const clientes = await buscarClientesCreditosPendientesSucursal(ctx.sucursalId, q, limit);

  return NextResponse.json({ clientes }, { headers: { "Cache-Control": "no-store" } });
}
