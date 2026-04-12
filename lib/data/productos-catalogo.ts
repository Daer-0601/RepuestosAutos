import "server-only";

import { pool } from "@/lib/db";
import { sqlInt } from "@/lib/data/sql-utils";
import type { RowDataPacket } from "mysql2";

export type CatalogoFiltrosInput = {
  /** Búsqueda amplia: tokens (espacio/coma); cada uno en cualquiera de código, nombre, pieza, texto, medida, etc. */
  q: string;
  codigo: string;
  codigo_pieza: string;
  especificacion: string;
  descripcion: string;
  procedencia: string;
  repuesto: string;
  marca: string;
  /** vacío = cualquiera; cero = sin stock; positivo = con stock total > 0 */
  stock: "" | "cero" | "positivo";
  /** Solo productos con stock &gt; 0 en esta sucursal */
  sucursalStockId: number | null;
  estado: "" | "activo" | "inactivo";
  page: number;
  pageSize: number;
};

function parseImagenesGroupConcat(raw: string | null | undefined): string[] {
  if (raw == null || raw === "") return [];
  /* GROUP_CONCAT usa SEPARATOR con tab (literal); MySQL no admite SEPARATOR CHAR(31) en varias versiones. */
  return raw
    .split("\t")
    .map((u) => u.trim())
    .filter(Boolean);
}

export type ProductoCatalogoRow = {
  id: number;
  codigo: string;
  /** Texto que codifica el QR (etiqueta). */
  qr_payload: string;
  /** URLs en orden de `producto_imagenes`. */
  imagenes_urls: string[];
  codigo_pieza: string | null;
  especificacion: string | null;
  descripcion: string | null;
  repuesto: string | null;
  procedencia: string | null;
  medida: string | null;
  nombre: string;
  unidad: string | null;
  marca_auto: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  punto_tope: string | null;
  estado: string;
  stock_total: number;
};

export type InventarioStockCell = {
  producto_id: number;
  sucursal_id: number;
  stock: number;
};

/** Parte el texto en tokens (espacios, comas, punto y coma); sin comodines SQL. */
function searchTokens(raw: string, maxTokens = 14): string[] {
  return raw
    .trim()
    .slice(0, 400)
    .split(/[\s,;]+/)
    .map((t) => t.replace(/%/g, "").trim())
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, 80))
    .slice(0, maxTokens);
}

function tokenLikeParam(t: string): string {
  return `%${t.toLowerCase()}%`;
}

/**
 * Cada token debe aparecer en la misma columna (AND entre tokens), sin distinguir mayúsculas.
 */
function addFlexibleColumn(
  parts: string[],
  params: (string | number | null)[],
  colExpr: string,
  raw: string
): void {
  const tokens = searchTokens(raw);
  if (tokens.length === 0) return;
  const inner = tokens.map(() => `LOWER(${colExpr}) LIKE ?`).join(" AND ");
  parts.push(`(${inner})`);
  for (const tok of tokens) {
    params.push(tokenLikeParam(tok));
  }
}

/** Cada token debe coincidir en al menos uno de los campos (OR por campo, AND entre tokens). */
function addFlexibleBusquedaAmplia(parts: string[], params: (string | number | null)[], raw: string): void {
  const tokens = searchTokens(raw);
  if (tokens.length === 0) return;

  const colExprs = [
    "IFNULL(p.codigo,'')",
    "IFNULL(p.nombre,'')",
    "IFNULL(p.codigo_pieza,'')",
    "IFNULL(p.descripcion,'')",
    "IFNULL(p.especificacion,'')",
    "IFNULL(p.medida,'')",
    "IFNULL(p.repuesto,'')",
    "IFNULL(p.procedencia,'')",
    "IFNULL(p.marca_auto,'')",
  ];

  for (const tok of tokens) {
    const ors = colExprs.map((c) => `LOWER(${c}) LIKE ?`).join(" OR ");
    parts.push(`(${ors})`);
    for (let i = 0; i < colExprs.length; i++) {
      params.push(tokenLikeParam(tok));
    }
  }
}

function buildWhere(f: CatalogoFiltrosInput): { sql: string; params: (string | number | null)[] } {
  const parts: string[] = [];
  const params: (string | number | null)[] = [];

  if (f.estado === "activo" || f.estado === "inactivo") {
    parts.push("p.estado = ?");
    params.push(f.estado);
  }

  addFlexibleBusquedaAmplia(parts, params, f.q);

  addFlexibleColumn(parts, params, "p.codigo", f.codigo);
  addFlexibleColumn(parts, params, "IFNULL(p.codigo_pieza,'')", f.codigo_pieza);
  addFlexibleColumn(parts, params, "IFNULL(p.especificacion,'')", f.especificacion);
  addFlexibleColumn(parts, params, "IFNULL(p.descripcion,'')", f.descripcion);
  addFlexibleColumn(parts, params, "IFNULL(p.procedencia,'')", f.procedencia);
  addFlexibleColumn(parts, params, "IFNULL(p.repuesto,'')", f.repuesto);
  addFlexibleColumn(parts, params, "IFNULL(p.marca_auto,'')", f.marca);

  if (f.stock === "cero") {
    parts.push(
      "COALESCE((SELECT SUM(i2.stock) FROM inventario i2 WHERE i2.producto_id = p.id), 0) = 0"
    );
  } else if (f.stock === "positivo") {
    parts.push(
      "COALESCE((SELECT SUM(i2.stock) FROM inventario i2 WHERE i2.producto_id = p.id), 0) > 0"
    );
  }

  if (f.sucursalStockId != null && Number.isFinite(f.sucursalStockId) && f.sucursalStockId > 0) {
    parts.push(
      "EXISTS (SELECT 1 FROM inventario i3 WHERE i3.producto_id = p.id AND i3.sucursal_id = ? AND i3.stock > 0)"
    );
    params.push(f.sucursalStockId);
  }

  const sql = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  return { sql, params };
}

export async function countProductosCatalogo(f: CatalogoFiltrosInput): Promise<number> {
  const { sql, params } = buildWhere(f);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM productos p ${sql}`,
    params
  );
  return Number((rows[0] as { c: number }).c);
}

export async function listProductosCatalogo(f: CatalogoFiltrosInput): Promise<ProductoCatalogoRow[]> {
  const { sql, params } = buildWhere(f);
  const lim = sqlInt(f.pageSize, 500);
  const page = Math.max(1, Math.trunc(f.page) || 1);
  const offset = (page - 1) * lim;

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.codigo, p.qr_payload, p.codigo_pieza, p.especificacion, p.descripcion, p.repuesto, p.procedencia,
            p.medida, p.nombre, p.unidad, p.marca_auto, p.precio_venta_lista_bs, p.precio_venta_lista_usd,
            p.punto_tope, p.estado,
            COALESCE((SELECT SUM(i.stock) FROM inventario i WHERE i.producto_id = p.id), 0) AS stock_total,
            (SELECT GROUP_CONCAT(pi.url_imagen ORDER BY pi.orden ASC, pi.id ASC SEPARATOR '\t')
               FROM producto_imagenes pi WHERE pi.producto_id = p.id) AS imagenes_concat
     FROM productos p
     ${sql}
     ORDER BY p.id DESC
     LIMIT ${lim} OFFSET ${offset}`,
    params
  );
  return (rows as (ProductoCatalogoRow & { imagenes_concat?: string | null })[]).map(
    ({ imagenes_concat, ...r }) => ({
      ...r,
      imagenes_urls: parseImagenesGroupConcat(imagenes_concat),
    })
  );
}

export async function listInventarioPorProductoIds(
  productoIds: number[]
): Promise<InventarioStockCell[]> {
  if (productoIds.length === 0) return [];
  const placeholders = productoIds.map(() => "?").join(",");
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT producto_id, sucursal_id, stock
     FROM inventario
     WHERE producto_id IN (${placeholders})`,
    productoIds
  );
  return rows as InventarioStockCell[];
}

/** Query string para enlaces de paginación y pestañas de sucursal (solo incluye valores no vacíos). */
export type ProductoCatalogoRowConStock = ProductoCatalogoRow & {
  stocksPorSucursal: Map<number, number>;
};

export function mergeStocksEnFilas(
  rows: ProductoCatalogoRow[],
  inv: InventarioStockCell[]
): ProductoCatalogoRowConStock[] {
  const m = new Map<number, Map<number, number>>();
  for (const c of inv) {
    if (!m.has(c.producto_id)) m.set(c.producto_id, new Map());
    m.get(c.producto_id)!.set(c.sucursal_id, c.stock);
  }
  return rows.map((r) => ({
    ...r,
    stocksPorSucursal: m.get(r.id) ?? new Map(),
  }));
}

export function stringifyCatalogoFiltros(
  f: CatalogoFiltrosInput,
  overrides?: Partial<CatalogoFiltrosInput>
): string {
  const m = { ...f, ...overrides };
  const p = new URLSearchParams();
  if (m.q.trim()) p.set("q", m.q.trim());
  if (m.codigo.trim()) p.set("codigo", m.codigo.trim());
  if (m.codigo_pieza.trim()) p.set("codigo_pieza", m.codigo_pieza.trim());
  if (m.especificacion.trim()) p.set("especificacion", m.especificacion.trim());
  if (m.descripcion.trim()) p.set("descripcion", m.descripcion.trim());
  if (m.procedencia.trim()) p.set("procedencia", m.procedencia.trim());
  if (m.repuesto.trim()) p.set("repuesto", m.repuesto.trim());
  if (m.marca.trim()) p.set("marca", m.marca.trim());
  if (m.stock) p.set("stock", m.stock);
  if (m.sucursalStockId != null) p.set("sucursal", String(m.sucursalStockId));
  if (m.estado === "") p.set("estado", "todos");
  else if (m.estado === "inactivo") p.set("estado", "inactivo");
  if (m.pageSize !== 10) p.set("perPage", String(m.pageSize));
  if (m.page > 1) p.set("page", String(m.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function parseCatalogoFiltros(sp: Record<string, string | string[] | undefined>): CatalogoFiltrosInput {
  const s = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] ?? "" : v ?? "";
  };

  const stockRaw = s("stock");
  const stock: CatalogoFiltrosInput["stock"] =
    stockRaw === "cero" || stockRaw === "positivo" ? stockRaw : "";

  const est = s("estado");
  let estado: CatalogoFiltrosInput["estado"];
  if (est === "todos" || est === "all") estado = "";
  else if (est === "inactivo") estado = "inactivo";
  else estado = "activo";

  const sucRaw = Number(s("sucursal"));
  const sucursalStockId = Number.isFinite(sucRaw) && sucRaw > 0 ? sucRaw : null;

  const page = Math.max(1, Number(s("page")) || 1);
  const perRaw = Number(s("perPage"));
  const pageSize = Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(perRaw, 500) : 10;

  return {
    q: s("q"),
    codigo: s("codigo"),
    codigo_pieza: s("codigo_pieza"),
    especificacion: s("especificacion"),
    descripcion: s("descripcion"),
    procedencia: s("procedencia"),
    repuesto: s("repuesto"),
    marca: s("marca"),
    stock,
    sucursalStockId,
    estado,
    page,
    pageSize,
  };
}
