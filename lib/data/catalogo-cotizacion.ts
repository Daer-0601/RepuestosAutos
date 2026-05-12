import "server-only";

import { CATALOGO_FILAS_MAX } from "@/lib/catalogo-productos-constants";
import {
  countProductosCatalogo,
  listProductosCatalogo,
  parseCatalogoFiltrosFromJsonBody,
} from "@/lib/data/productos-catalogo";
import { sqlInt } from "@/lib/data/sql-utils";

const PEDIDO_PAGE_DEFAULT = 80;

/** Si el término parece un QR/código escaneado (largo, alfanumérico), una sola coincidencia exacta basta y no mezclamos ruido LIKE. */
function termParecePayloadEscaneado(term: string): boolean {
  return term.length >= 14 && /^[A-Za-z0-9_-]+$/.test(term);
}

export type ProductoCatalogoCotizacionJson = {
  id: number;
  codigo: string;
  codigo_pieza: string | null;
  nombre: string;
  medida: string | null;
  marca_auto: string | null;
  especificacion: string | null;
  repuesto: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  punto_tope: string | null;
  stock_total: number;
};

function mapRow(r: Awaited<ReturnType<typeof listProductosCatalogo>>[number]): ProductoCatalogoCotizacionJson {
  return {
    id: r.id,
    codigo: r.codigo,
    codigo_pieza: r.codigo_pieza,
    nombre: r.nombre,
    medida: r.medida,
    marca_auto: r.marca_auto,
    especificacion: r.especificacion,
    repuesto: r.repuesto,
    precio_venta_lista_bs: r.precio_venta_lista_bs,
    precio_venta_lista_usd: r.precio_venta_lista_usd,
    punto_tope: r.punto_tope,
    stock_total: r.stock_total,
  };
}

export async function catalogoCotizacionListarActivosPagina(
  page: number,
  perPageRaw: unknown
): Promise<{ productos: ProductoCatalogoCotizacionJson[]; total: number; page: number }> {
  const perRaw = perPageRaw !== undefined ? Number(perPageRaw) : PEDIDO_PAGE_DEFAULT;
  const perPage = Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(Math.trunc(perRaw), CATALOGO_FILAS_MAX) : PEDIDO_PAGE_DEFAULT;
  const p = Math.max(1, Math.trunc(Number(page) || 1));
  const pageOffset = (p - 1) * perPage;
  const filtros = parseCatalogoFiltrosFromJsonBody({
    q: "",
    codigo: "",
    codigo_pieza: "",
    especificacion: "",
    medida: "",
    descripcion: "",
    repuesto: "",
    stock: "",
    estado: "activo",
    perPage,
    pageOffset,
  });
  const total = await countProductosCatalogo(filtros);
  const rows = await listProductosCatalogo(filtros);
  return { productos: rows.map(mapRow), total, page: p };
}

/** Solo código interno (etiqueta / lector) o payload de QR exacto — no incluye código pieza. */
export async function catalogoCotizacionBuscarSoloCodigo(
  codigoRaw: string,
  perPageRaw: unknown
): Promise<{ productos: ProductoCatalogoCotizacionJson[]; total: number }> {
  const codigo = codigoRaw.trim();
  if (!codigo) {
    return { productos: [], total: 0 };
  }
  const perRaw = perPageRaw !== undefined ? Number(perPageRaw) : PEDIDO_PAGE_DEFAULT;
  const perPage =
    Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(Math.trunc(perRaw), CATALOGO_FILAS_MAX) : PEDIDO_PAGE_DEFAULT;

  const filtros = parseCatalogoFiltrosFromJsonBody({
    perPage,
    estado: "activo",
    stock: "",
    q: "",
    codigo,
    codigo_pieza: "",
    especificacion: "",
    medida: "",
    descripcion: "",
    repuesto: "",
    pageOffset: 0,
  });
  const total = await countProductosCatalogo(filtros);
  const rows = await listProductosCatalogo(filtros);
  return { productos: rows.map(mapRow), total };
}

/** Búsqueda amplia (`q`), misma semántica que el catálogo en otras pantallas. */
export async function catalogoCotizacionBuscarSoloQ(
  qRaw: string,
  perPageRaw: unknown
): Promise<{ productos: ProductoCatalogoCotizacionJson[]; total: number }> {
  const q = qRaw.trim();
  if (!q) {
    return { productos: [], total: 0 };
  }
  const perRaw = perPageRaw !== undefined ? Number(perPageRaw) : PEDIDO_PAGE_DEFAULT;
  const perPage =
    Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(Math.trunc(perRaw), CATALOGO_FILAS_MAX) : PEDIDO_PAGE_DEFAULT;

  const filtros = parseCatalogoFiltrosFromJsonBody({
    perPage,
    estado: "activo",
    stock: "",
    q,
    codigo: "",
    codigo_pieza: "",
    especificacion: "",
    medida: "",
    descripcion: "",
    repuesto: "",
    pageOffset: 0,
  });
  const total = await countProductosCatalogo(filtros);
  const rows = await listProductosCatalogo(filtros);
  return { productos: rows.map(mapRow), total };
}

export async function catalogoCotizacionBuscarPorTerm(
  termRaw: string,
  perPageRaw: unknown
): Promise<{ productos: ProductoCatalogoCotizacionJson[]; total: number }> {
  const term = termRaw.trim();
  if (!term) {
    return { productos: [], total: 0 };
  }
  const perRaw = perPageRaw !== undefined ? Number(perPageRaw) : PEDIDO_PAGE_DEFAULT;
  const perPage = Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(Math.trunc(perRaw), CATALOGO_FILAS_MAX) : PEDIDO_PAGE_DEFAULT;

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
    pageOffset: 0,
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
    return { productos: exactRows.map(mapRow), total };
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

  return { productos: rows.map(mapRow), total };
}
