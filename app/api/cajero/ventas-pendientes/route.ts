import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { formatDateTimeMysqlBolivia, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import {
  getVentaPendienteCobroDetalle,
  listVentasPendientesCobroCajero,
} from "@/lib/data/ventas-cobro-cajero";
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
  const ventaIdRaw = searchParams.get("ventaId");
  const ventaId = ventaIdRaw ? Number(ventaIdRaw) : NaN;

  if (Number.isFinite(ventaId) && ventaId > 0) {
    const detalle = await getVentaPendienteCobroDetalle(
      Math.trunc(ventaId),
      ctx.sucursalId,
      ctx.userId
    );
    if (!detalle) {
      return NextResponse.json({ error: "Venta no encontrada o ya cobrada." }, { status: 404 });
    }
    return NextResponse.json({ detalle });
  }

  const fechaParam = searchParams.get("fecha");
  const desdeParam = searchParams.get("desde")?.trim();
  const hastaParam = searchParams.get("hasta")?.trim();
  const fechaDesde = desdeParam ? parseIsoDateOnly(desdeParam) : fechaParam ? parseIsoDateOnly(fechaParam) : defaultHoyIso();
  const fechaHasta = hastaParam ? parseIsoDateOnly(hastaParam) : fechaDesde;
  if (!fechaDesde) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const rows = await listVentasPendientesCobroCajero(ctx.sucursalId, ctx.userId, {
    fechaDesde,
    fechaHasta: fechaHasta ?? fechaDesde,
  });
  return NextResponse.json({ fechaDesde, fechaHasta: fechaHasta ?? fechaDesde, rows });
}
