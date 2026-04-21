import "server-only";

import { pool } from "@/lib/db";
import { condicionCodigoQrExacta } from "@/lib/data/producto-codigo-busqueda-exacta";
import { sqlInt } from "@/lib/data/sql-utils";
import type { RowDataPacket } from "mysql2";

export type CatalogoFiltrosInput = {
  /** Búsqueda amplia: tokens; basta que uno coincida en nombre, pieza, descripción, etc. (no usa código interno). */
  q: string;
  codigo: string;
  codigo_pieza: string;
  especificacion: string;
  medida: string;
  descripcion: string;
  repuesto: string;
  /** vacío = cualquiera; cero = sin stock; positivo = con stock total > 0 */
  stock: "" | "cero" | "positivo";
  /** Solo productos con stock &gt; 0 en esta sucursal */
  sucursalStockId: number | null;
  estado: "" | "activo" | "inactivo";
  /** Filas por carga (por defecto 50 para que la página no sea lenta). */
  pageSize: number;
};

/** Por defecto al entrar a productos. */
export const CATALOGO_FILAS_DEFAULT = 50;
/** Máximo permitido en el selector «Filas». */
export const CATALOGO_FILAS_MAX = 500;

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
  /** Proveedor de la última compra confirmada del producto. */
  proveedor_nombre: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  /** Última línea de compra confirmada (unitario). */
  precio_compra_unitario_bs: string | null;
  precio_compra_unitario_usd: string | null;
  punto_tope: string | null;
  estado: string;
  stock_total: number;
};

export type InventarioStockCell = {
  producto_id: number;
  sucursal_id: number;
  stock: number;
};

/** Parte el texto en tokens (espacios, comas, punto y coma, guiones); sin comodines SQL. */
function searchTokens(raw: string, maxTokens = 14): string[] {
  return raw
    .trim()
    .slice(0, 400)
    .split(/[\s,;-]+/)
    .map((t) => t.replace(/%/g, "").trim())
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, 80))
    .slice(0, maxTokens);
}

function tokenLikeParam(t: string): string {
  return `%${t.toLowerCase()}%`;
}

/**
 * Cualquier token alcanza (OR): más permisivo para texto libre.
 * Cada token: LIKE case-insensitive en la misma columna.
 */
function addFlexibleColumnAnyToken(
  parts: string[],
  params: (string | number | null)[],
  colExpr: string,
  raw: string
): void {
  const tokens = searchTokens(raw);
  if (tokens.length === 0) return;
  const inner = tokens.map(() => `LOWER(${colExpr}) LIKE ?`).join(" OR ");
  parts.push(`(${inner})`);
  for (const tok of tokens) {
    params.push(tokenLikeParam(tok));
  }
}

/**
 * Tokens más permisivos para el campo «Descripción» del catálogo (más separadores).
 */
function searchTokensDescripcion(raw: string, maxTokens = 20): string[] {
  return raw
    .trim()
    .slice(0, 400)
    .split(/[\s,;.\/_|\-–—()[\]{}]+/)
    .map((t) => t.replace(/%/g, "").replace(/['\u2018\u2019`´]/g, "").trim())
    .filter((t) => t.length > 0)
    .map((t) => t.slice(0, 80))
    .slice(0, maxTokens);
}

/**
 * Filtro «Descripción»: busca en descripción, nombre y especificación; cada palabra
 * puede coincidir en cualquiera de esos campos (OR entre tokens). Más flexible que
 * una sola columna y que separar solo por espacio.
 */
function addFlexibleDescripcionFilter(
  parts: string[],
  params: (string | number | null)[],
  raw: string
): void {
  const tokens = searchTokensDescripcion(raw);
  if (tokens.length === 0) return;
  const colExprs = [
    "IFNULL(p.descripcion,'')",
    "IFNULL(p.nombre,'')",
    "IFNULL(p.especificacion,'')",
  ];
  const perToken = tokens.map(() => {
    const ors = colExprs.map((c) => `LOWER(${c}) LIKE ?`).join(" OR ");
    return `(${ors})`;
  });
  parts.push(`(${perToken.join(" OR ")})`);
  for (const tok of tokens) {
    for (let i = 0; i < colExprs.length; i++) {
      params.push(tokenLikeParam(tok));
    }
  }
}

/** Código interno / QR: solo coincidencia exacta (ver `condicionCodigoQrExacta`). */
function addCodigoCatalogoFilter(
  parts: string[],
  params: (string | number | null)[],
  raw: string
): void {
  const frag = condicionCodigoQrExacta(raw, "p");
  if (!frag) return;
  parts.push(frag.sql);
  params.push(...frag.params);
}

/**
 * Búsqueda amplia: cada token en cualquier campo; con varias palabras basta que **alguna** coincida
 * (OR entre tokens). Sin código interno (solo el campo Código del formulario).
 */
function addFlexibleBusquedaAmplia(parts: string[], params: (string | number | null)[], raw: string): void {
  const tokens = searchTokens(raw);
  if (tokens.length === 0) return;

  const colExprs = [
    "IFNULL(p.nombre,'')",
    "IFNULL(p.codigo_pieza,'')",
    "IFNULL(p.descripcion,'')",
    "IFNULL(p.especificacion,'')",
    "IFNULL(p.medida,'')",
    "IFNULL(p.repuesto,'')",
  ];

  const perToken = tokens.map(() => {
    const ors = colExprs.map((c) => `LOWER(${c}) LIKE ?`).join(" OR ");
    return `(${ors})`;
  });
  parts.push(`(${perToken.join(" OR ")})`);
  for (const tok of tokens) {
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

  addCodigoCatalogoFilter(parts, params, f.codigo);
  addFlexibleColumnAnyToken(parts, params, "IFNULL(p.codigo_pieza,'')", f.codigo_pieza);
  addFlexibleColumnAnyToken(parts, params, "IFNULL(p.especificacion,'')", f.especificacion);
  addFlexibleColumnAnyToken(parts, params, "IFNULL(p.medida,'')", f.medida);
  addFlexibleDescripcionFilter(parts, params, f.descripcion);
  addFlexibleColumnAnyToken(parts, params, "IFNULL(p.repuesto,'')", f.repuesto);

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
  const lim = sqlInt(f.pageSize, CATALOGO_FILAS_MAX);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.codigo, p.qr_payload, p.codigo_pieza, p.especificacion, p.descripcion, p.repuesto, p.procedencia,
            p.medida, p.nombre, p.unidad, p.marca_auto,
            (SELECT pr.nombre
             FROM compra_detalle cd
             INNER JOIN compras c ON c.id = cd.compra_id AND c.estado = 'confirmada'
             INNER JOIN proveedores pr ON pr.id = c.proveedor_id
             WHERE cd.producto_id = p.id
             ORDER BY c.fecha DESC, cd.id DESC
             LIMIT 1) AS proveedor_nombre,
            p.precio_venta_lista_bs, p.precio_venta_lista_usd,
            p.punto_tope, p.estado,
            (SELECT cd.precio_compra_unitario_bs
             FROM compra_detalle cd
             INNER JOIN compras c ON c.id = cd.compra_id AND c.estado = 'confirmada'
             WHERE cd.producto_id = p.id
             ORDER BY c.fecha DESC, cd.id DESC
             LIMIT 1) AS precio_compra_unitario_bs,
            (SELECT cd.precio_compra_unitario_usd
             FROM compra_detalle cd
             INNER JOIN compras c ON c.id = cd.compra_id AND c.estado = 'confirmada'
             WHERE cd.producto_id = p.id
             ORDER BY c.fecha DESC, cd.id DESC
             LIMIT 1) AS precio_compra_unitario_usd,
            COALESCE((SELECT SUM(i.stock) FROM inventario i WHERE i.producto_id = p.id), 0) AS stock_total,
            (SELECT GROUP_CONCAT(pi.url_imagen ORDER BY pi.orden ASC, pi.id ASC SEPARATOR '\t')
               FROM producto_imagenes pi WHERE pi.producto_id = p.id) AS imagenes_concat
     FROM productos p
     ${sql}
     ORDER BY LOWER(p.nombre) ASC, LOWER(p.codigo) ASC, p.id ASC
     LIMIT ${lim} OFFSET 0`,
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
  if (m.medida.trim()) p.set("medida", m.medida.trim());
  if (m.descripcion.trim()) p.set("descripcion", m.descripcion.trim());
  if (m.repuesto.trim()) p.set("repuesto", m.repuesto.trim());
  if (m.stock) p.set("stock", m.stock);
  if (m.sucursalStockId != null) p.set("sucursal", String(m.sucursalStockId));
  if (m.estado === "") p.set("estado", "todos");
  else if (m.estado === "inactivo") p.set("estado", "inactivo");
  if (m.pageSize !== CATALOGO_FILAS_DEFAULT) p.set("perPage", String(m.pageSize));
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

  const perRaw = Number(s("perPage"));
  const pageSize =
    Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(perRaw, CATALOGO_FILAS_MAX) : CATALOGO_FILAS_DEFAULT;

  return {
    q: s("q"),
    codigo: s("codigo"),
    codigo_pieza: s("codigo_pieza"),
    especificacion: s("especificacion"),
    medida: s("medida"),
    descripcion: s("descripcion"),
    repuesto: s("repuesto"),
    stock,
    sucursalStockId,
    estado,
    pageSize,
  };
}
