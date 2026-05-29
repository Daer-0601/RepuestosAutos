import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import {
  getCotizacionPendienteImpresionDetalle,
  listCotizacionesPendientesImpresionSucursal,
} from "@/lib/data/cotizaciones-cajero";
import { parseIsoDateOnly } from "@/lib/fecha-bolivia";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getCajeroStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cotizacionIdRaw = searchParams.get("cotizacionId");
  const cotizacionId = cotizacionIdRaw ? Number(cotizacionIdRaw) : NaN;

  if (Number.isFinite(cotizacionId) && cotizacionId > 0) {
    const detalle = await getCotizacionPendienteImpresionDetalle(Math.trunc(cotizacionId), ctx.sucursalId);
    if (!detalle) {
      return NextResponse.json({ error: "Cotización no encontrada o ya impresa." }, { status: 404 });
    }
    return NextResponse.json({ detalle }, { headers: { "Cache-Control": "no-store" } });
  }

  const desdeParam = searchParams.get("desde")?.trim();
  const hastaParam = searchParams.get("hasta")?.trim();
  const filtrarPorDia = searchParams.get("filtrar") === "1";
  const fechaDesde = desdeParam ? parseIsoDateOnly(desdeParam) : null;
  const fechaHasta = hastaParam ? parseIsoDateOnly(hastaParam) : fechaDesde;

  const rows = await listCotizacionesPendientesImpresionSucursal(
    ctx.sucursalId,
    filtrarPorDia && fechaDesde
      ? { fechaDesde, fechaHasta: fechaHasta ?? fechaDesde }
      : undefined
  );
  return NextResponse.json(
    {
      filtrarPorDia,
      fechaDesde: filtrarPorDia ? fechaDesde : null,
      fechaHasta: filtrarPorDia ? fechaHasta : null,
      rows,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
