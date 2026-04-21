import { getVendedorStaffContextOrNull } from "@/lib/auth/staff-panel-context";
import { listProductosParaVentaCatalogoJson, parseVentaCatalogoFiltros } from "@/lib/data/ventas-vendedor";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const ctx = await getVendedorStaffContextOrNull();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const filtros = parseVentaCatalogoFiltros(ctx.sucursalId, b);
  const data = await listProductosParaVentaCatalogoJson({
    miSucursalId: ctx.sucursalId,
    filtros,
  });

  return NextResponse.json(data);
}
