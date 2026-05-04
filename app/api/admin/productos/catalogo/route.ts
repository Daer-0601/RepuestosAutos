import { getAdminSession } from "@/lib/auth/admin-session";
import {
  countProductosCatalogo,
  listProductosCatalogo,
  parseCatalogoFiltrosFromJsonBody,
} from "@/lib/data/productos-catalogo";
import { sqlInt } from "@/lib/data/sql-utils";
import { CATALOGO_FILAS_MAX } from "@/lib/catalogo-productos-constants";
import { NextResponse } from "next/server";

const PEDIDO_PAGE_DEFAULT = 80;

/** Si el término parece un QR/código escaneado (largo, alfanumérico), una sola coincidencia exacta basta y no mezclamos ruido LIKE. */
function termParecePayloadEscaneado(term: string): boolean {
  return term.length >= 14 && /^[A-Za-z0-9_-]+$/.test(term);
}

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

  const base: Record<string, unknown> = {
    perPage,
    estado: "activo",
    stock: "",
    q: "",
    codigo: "",
    codigo_pieza: "",
    especificacion: "",
    medida: "",
    descripcion: "",
    repuesto: "",
  };

  const filtrosExact = parseCatalogoFiltrosFromJsonBody({ ...base, codigo: term, q: "" });
  const filtrosPieza = parseCatalogoFiltrosFromJsonBody({ ...base, codigo: "", codigo_pieza: term, q: "" });
  const filtrosWide = parseCatalogoFiltrosFromJsonBody({ ...base, codigo: "", codigo_pieza: "", q: term });

  const [exactRows, wideTotal, wideRows] = await Promise.all([
    listProductosCatalogo(filtrosExact),
    countProductosCatalogo(filtrosWide),
    listProductosCatalogo(filtrosWide),
  ]);

  if (termParecePayloadEscaneado(term) && exactRows.length === 1) {
    const total = await countProductosCatalogo(filtrosExact);
    const productos = exactRows.map((r) => ({
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

  const seen = new Set<number>();
  const rows: Awaited<ReturnType<typeof listProductosCatalogo>> = [];
  const pushUnique = (list: typeof rows) => {
    for (const r of list) {
      if (rows.length >= perPage) return;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      rows.push(r);
    }
  };

  pushUnique(exactRows);

  if (exactRows.length === 0) {
    const piezaRows = await listProductosCatalogo(filtrosPieza);
    pushUnique(piezaRows);
  }

  pushUnique(wideRows);

  let total = wideTotal;
  if (wideTotal === 0 && rows.length > 0) {
    total =
      exactRows.length > 0
        ? await countProductosCatalogo(filtrosExact)
        : await countProductosCatalogo(filtrosPieza);
  }

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
