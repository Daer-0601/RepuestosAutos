import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { parseVendedoresIdsQuery } from "@/lib/arqueo/vendedores-query";
import { listSalidasDiariasArqueoSucursal, totalesSalidasDiarias } from "@/lib/data/arqueo-cajero";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import { NextResponse } from "next/server";

function defaultHoyIso(): string {
  return formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
}

/** Salidas de toda la sucursal (arqueo general impreso). */
export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = parseIsoDateOnly(searchParams.get("desde")) ?? defaultHoyIso();
  const hasta = parseIsoDateOnly(searchParams.get("hasta")) ?? defaultHoyIso();
  if (desde > hasta) {
    return NextResponse.json({ error: "La fecha desde no puede ser posterior a hasta." }, { status: 400 });
  }

  const vendedoresIds = parseVendedoresIdsQuery(searchParams.get("vendedores"));

  const lineas = await listSalidasDiariasArqueoSucursal(ctx.sucursalId, desde, hasta, 12000, vendedoresIds);
  const totales = totalesSalidasDiarias(lineas);

  return NextResponse.json(
    {
      sucursalNombre: ctx.sucursalNombre,
      fechaDesde: desde,
      fechaHasta: hasta,
      vendedoresIds,
      lineas,
      totales,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
  );
}
