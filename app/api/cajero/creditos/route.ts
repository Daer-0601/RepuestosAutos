import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { listCreditosPendientesSucursal } from "@/lib/data/creditos";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const soloVencidos = searchParams.get("vencidos") === "1";
  const clienteIdRaw = searchParams.get("clienteId");
  const clienteIdParsed = clienteIdRaw != null ? Number(clienteIdRaw) : null;
  const clienteId =
    clienteIdParsed != null && Number.isFinite(clienteIdParsed) && clienteIdParsed > 0
      ? Math.trunc(clienteIdParsed)
      : null;

  const creditos = await listCreditosPendientesSucursal(ctx.sucursalId, {
    soloVencidos,
    clienteId,
  });

  return NextResponse.json(
    { sucursalNombre: ctx.sucursalNombre, creditos },
    { headers: { "Cache-Control": "no-store" } }
  );
}
