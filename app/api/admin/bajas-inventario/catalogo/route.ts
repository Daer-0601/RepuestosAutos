import { getAdminSession } from "@/lib/auth/admin-session";
import { CATALOGO_FILAS_DEFAULT, CATALOGO_FILAS_MAX } from "@/lib/catalogo-productos-constants";
import {
  countProductosCatalogo,
  listInventarioPorProductoIds,
  listProductosCatalogo,
  mergeStocksEnFilas,
  parseCatalogoFiltrosFromJsonBody,
  type ProductoCatalogoRowConStock,
} from "@/lib/data/productos-catalogo";
import { listSucursales } from "@/lib/data/sucursales";
import { sqlInt } from "@/lib/data/sql-utils";
import { NextResponse } from "next/server";

function serializeRow(r: ProductoCatalogoRowConStock) {
  return {
    ...r,
    stocksPorSucursal: Object.fromEntries(r.stocksPorSucursal.entries()),
  };
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const sucursalId = Number(b.sucursalId);
  if (!Number.isFinite(sucursalId) || sucursalId < 1) {
    return NextResponse.json({ error: "Elegí sucursal." }, { status: 400 });
  }

  const perRaw = b.perPage !== undefined ? Number(b.perPage) : CATALOGO_FILAS_DEFAULT;
  const pageSize =
    Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(Math.trunc(perRaw), CATALOGO_FILAS_MAX) : CATALOGO_FILAS_DEFAULT;

  const filtros = parseCatalogoFiltrosFromJsonBody({
    ...b,
    estado: "activo",
    perPage: pageSize,
  });

  if (b.soloConStockEnSucursal === true) {
    filtros.sucursalStockId = sucursalId;
  }

  const [total, list, sucursalesRaw] = await Promise.all([
    countProductosCatalogo(filtros),
    listProductosCatalogo(filtros),
    listSucursales(),
  ]);
  const inv = await listInventarioPorProductoIds(list.map((r) => r.id));
  const merged = mergeStocksEnFilas(list, inv);
  const sucursales = sucursalesRaw.filter((s) => s.estado === "activo").sort((a, b) => a.id - b.id);

  return NextResponse.json({
    total,
    rows: merged.map(serializeRow),
    sucursales,
  });
}
