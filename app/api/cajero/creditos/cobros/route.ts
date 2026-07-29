import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { listCobrosCreditoSucursal } from "@/lib/data/creditos";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import { NextResponse } from "next/server";

function defaultHoyIso(): string {
  return formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
}

export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = parseIsoDateOnly(searchParams.get("desde")) ?? defaultHoyIso();
  const hasta = parseIsoDateOnly(searchParams.get("hasta")) ?? desde;
  if (desde > hasta) {
    return NextResponse.json({ error: "La fecha desde no puede ser posterior a hasta." }, { status: 400 });
  }

  const cobros = await listCobrosCreditoSucursal(ctx.sucursalId, desde, hasta);

  return NextResponse.json(
    {
      sucursalNombre: ctx.sucursalNombre,
      fechaDesde: desde,
      fechaHasta: hasta,
      cobros,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
