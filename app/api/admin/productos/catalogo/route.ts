import { getAdminSession } from "@/lib/auth/admin-session";
import {
  catalogoCotizacionBuscarPorTerm,
  catalogoCotizacionListarActivosPagina,
} from "@/lib/data/catalogo-cotizacion";
import {
  countProductosCatalogo,
  listProductosCatalogo,
  parseCatalogoFiltrosFromJsonBody,
} from "@/lib/data/productos-catalogo";
import { sqlInt } from "@/lib/data/sql-utils";
import { CATALOGO_FILAS_MAX } from "@/lib/catalogo-productos-constants";
import { NextResponse } from "next/server";

const PEDIDO_PAGE_DEFAULT = 80;

function nz(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function tieneFiltrosCatalogoAvanzados(b: Record<string, unknown>): boolean {
  return (
    nz(b.q).length > 0 ||
    nz(b.codigo).length > 0 ||
    nz(b.codigo_pieza).length > 0 ||
    nz(b.especificacion).length > 0 ||
    nz(b.medida).length > 0 ||
    nz(b.descripcion).length > 0 ||
    nz(b.repuesto).length > 0 ||
    nz(b.stock).length > 0 ||
    (typeof b.sucursal === "number" && Number.isFinite(b.sucursal) && b.sucursal > 0) ||
    (typeof b.sucursal === "string" && nz(b.sucursal).length > 0)
  );
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

  const perRaw = b.perPage !== undefined ? Number(b.perPage) : PEDIDO_PAGE_DEFAULT;
  const perPage = Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(Math.trunc(perRaw), CATALOGO_FILAS_MAX) : PEDIDO_PAGE_DEFAULT;

  if (b.listarActivos === true) {
    const page = Math.max(1, Math.trunc(Number(b.page) || 1));
    const data = await catalogoCotizacionListarActivosPagina(page, perPage);
    return NextResponse.json(data);
  }

  if (tieneFiltrosCatalogoAvanzados(b)) {
    const filtros = parseCatalogoFiltrosFromJsonBody({
      ...b,
      estado: typeof b.estado === "string" && b.estado.trim() ? b.estado : "activo",
      perPage,
    });
    const total = await countProductosCatalogo(filtros);
    const rows = await listProductosCatalogo(filtros);
    const productos = rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      codigo_pieza: r.codigo_pieza,
      nombre: r.nombre,
      medida: r.medida,
      marca_auto: r.marca_auto,
      especificacion: r.especificacion,
      repuesto: r.repuesto,
    }));
    return NextResponse.json({ productos, total });
  }

  const term = typeof b.term === "string" ? b.term.trim() : "";
  if (!term) {
    return NextResponse.json({ productos: [], total: 0 });
  }

  const { productos, total } = await catalogoCotizacionBuscarPorTerm(term, perPage);
  const productosPedido = productos.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    codigo_pieza: r.codigo_pieza,
    nombre: r.nombre,
    medida: r.medida,
    marca_auto: r.marca_auto,
    especificacion: r.especificacion,
    repuesto: r.repuesto,
  }));
  return NextResponse.json({ productos: productosPedido, total });
}
