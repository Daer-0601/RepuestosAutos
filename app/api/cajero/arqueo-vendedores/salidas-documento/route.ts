import { getCajeroStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import {
  getVendedorActivoEnSucursal,
  listSalidasDiariasArqueoPorVendedor,
  totalesSalidasDiarias,
} from "@/lib/data/arqueo-cajero";
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
  const usuarioRaw = searchParams.get("usuarioId");
  const usuarioId = usuarioRaw != null ? Math.trunc(Number(usuarioRaw)) : NaN;
  if (!Number.isFinite(usuarioId) || usuarioId < 1) {
    return NextResponse.json({ error: "Parámetro usuarioId inválido." }, { status: 400 });
  }

  const desde = parseIsoDateOnly(searchParams.get("desde")) ?? defaultHoyIso();
  const hasta = parseIsoDateOnly(searchParams.get("hasta")) ?? defaultHoyIso();
  if (desde > hasta) {
    return NextResponse.json({ error: "La fecha desde no puede ser posterior a hasta." }, { status: 400 });
  }

  const vendedor = await getVendedorActivoEnSucursal(usuarioId, ctx.sucursalId);
  if (!vendedor) {
    return NextResponse.json({ error: "Vendedor no encontrado en tu sucursal." }, { status: 404 });
  }

  const lineas = await listSalidasDiariasArqueoPorVendedor(ctx.sucursalId, usuarioId, desde, hasta);
  const totales = totalesSalidasDiarias(lineas);

  return NextResponse.json(
    {
      sucursalNombre: ctx.sucursalNombre,
      vendedor,
      fechaDesde: desde,
      fechaHasta: hasta,
      lineas,
      totales,
    },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" } }
  );
}
