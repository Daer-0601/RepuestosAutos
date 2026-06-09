import "server-only";

import { pool } from "@/lib/db";
import { assertClientePuedeRecibirCredito } from "@/lib/data/creditos";
import { getCliente } from "@/lib/data/clientes";
import { condicionCodigoQrExacta } from "@/lib/data/producto-codigo-busqueda-exacta";
import { CATALOGO_FILAS_DEFAULT, CATALOGO_FILAS_MAX } from "@/lib/catalogo-productos-constants";
import {
  countProductosCatalogo,
  listInventarioPorProductoIds,
  listProductosCatalogo,
  mergeStocksEnFilas,
  type CatalogoFiltrosInput,
} from "@/lib/data/productos-catalogo";
import { getProducto, listProductoImagenes } from "@/lib/data/productos";
import { getSucursal, listSucursales } from "@/lib/data/sucursales";
import { sqlInt } from "@/lib/data/sql-utils";
import { MYSQL_SESSION_OFFSET, formatDateTimeMysqlBolivia, mysqlValueToIsoDateOnly } from "@/lib/fecha-bolivia";

/** Ventas entregadas o pendientes a crédito no son ingreso al contado. */
const SQL_EXCLUIR_VENTAS_CREDITO = `
  AND v.tipo_pago <> 'credito'
  AND NOT EXISTS (SELECT 1 FROM creditos cr0 WHERE cr0.venta_id = v.id)`;
import { assertCajeroDestinoValido, ensureVentasCobroCajaColumns } from "@/lib/data/ventas-cobro-cajero";
import { validarPrecioVentaBs } from "@/lib/venta-precio-lista-tope-range";
import type {
  ModoCatalogoVenta,
  ProductoVentaCompletoRow,
  StockSucursalInfo,
  VentaCatalogoApiRow,
} from "@/lib/types/venta-vendedor-catalogo";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

export type TipoPagoVenta = "efectivo" | "qr" | "tarjeta" | "credito";

export type { ModoCatalogoVenta, ProductoVentaCompletoRow, StockSucursalInfo, VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";

export type ProductoVentaLookupRow = {
  id: number;
  codigo: string;
  nombre: string;
  stock: number;
  precio_venta_lista_bs: number | null;
  precio_venta_lista_usd: number | null;
  punto_tope: number | null;
};

function catalogoCamposTexto(b: Record<string, unknown>): Pick<
  CatalogoFiltrosInput,
  "q" | "codigo" | "codigo_pieza" | "especificacion" | "medida" | "descripcion" | "repuesto"
> {
  const s = (k: string) => (typeof b[k] === "string" ? (b[k] as string).trim() : "");
  return {
    q: s("q"),
    codigo: s("codigo"),
    codigo_pieza: s("codigo_pieza"),
    especificacion: s("especificacion"),
    medida: s("medida"),
    descripcion: s("descripcion"),
    repuesto: s("repuesto"),
  };
}

/**
 * Misma lógica de filtros que el catálogo admin, adaptada al vendedor:
 * - `mi_sucursal`: solo ítems con stock &gt; 0 en la sucursal del vendedor (para vender).
 * - `referencia`: stock total &gt; 0 en cualquier sucursal (ver dónde hay).
 * - `todos`: productos activos sin filtrar por inventario.
 */
export function parseVentaCatalogoFiltros(
  miSucursalId: number,
  b: Record<string, unknown>
): CatalogoFiltrosInput {
  const modoRaw = typeof b.modo === "string" ? b.modo : "mi_sucursal";
  const modo: ModoCatalogoVenta =
    modoRaw === "referencia" || modoRaw === "todos" ? modoRaw : "mi_sucursal";
  const perRaw = Number(b.perPage);
  const pageSize =
    Number.isFinite(perRaw) && perRaw >= 10 ? sqlInt(perRaw, CATALOGO_FILAS_MAX) : CATALOGO_FILAS_DEFAULT;
  const fields = catalogoCamposTexto(b);

  if (modo === "mi_sucursal") {
    return {
      ...fields,
      stock: "",
      sucursalStockId: miSucursalId,
      estado: "activo",
      pageSize,
      pageOffset: 0,
    };
  }
  if (modo === "referencia") {
    return {
      ...fields,
      stock: "positivo",
      sucursalStockId: null,
      estado: "activo",
      pageSize,
      pageOffset: 0,
    };
  }
  return {
    ...fields,
    stock: "",
    sucursalStockId: null,
    estado: "activo",
    pageSize,
    pageOffset: 0,
  };
}

export async function listProductosParaVentaCatalogoJson(input: {
  miSucursalId: number;
  filtros: CatalogoFiltrosInput;
}): Promise<{ total: number; sucursales: { id: number; nombre: string }[]; rows: VentaCatalogoApiRow[] }> {
  const sucursales = (await listSucursales())
    .filter((s) => s.estado === "activo")
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const total = await countProductosCatalogo(input.filtros);
  const list = await listProductosCatalogo(input.filtros);
  const inv = await listInventarioPorProductoIds(list.map((r) => r.id));
  const merged = mergeStocksEnFilas(list, inv);

  const rows: VentaCatalogoApiRow[] = merged.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nombre: r.nombre,
    codigo_pieza: r.codigo_pieza,
    medida: r.medida,
    unidad: r.unidad,
    descripcion: r.descripcion,
    marca_auto: r.marca_auto,
    procedencia: r.procedencia,
    qr_payload: r.qr_payload ?? "",
    imagenes_urls: Array.isArray(r.imagenes_urls) ? r.imagenes_urls : [],
    precio_venta_lista_bs: r.precio_venta_lista_bs,
    precio_venta_lista_usd: r.precio_venta_lista_usd,
    punto_tope: r.punto_tope,
    stock_total: r.stock_total,
    stocksPorSucursal: sucursales.map((s) => ({
      sucursalId: s.id,
      stock: r.stocksPorSucursal.get(s.id) ?? 0,
    })),
  }));

  return {
    total,
    sucursales: sucursales.map((s) => ({ id: s.id, nombre: s.nombre })),
    rows,
  };
}

export async function getProductoVentaCompletoPorCodigo(
  miSucursalId: number,
  rawCodigo: string
): Promise<ProductoVentaCompletoRow | null> {
  if (!Number.isFinite(miSucursalId) || miSucursalId < 1) return null;
  const frag = condicionCodigoQrExacta(rawCodigo, "p");
  if (!frag) return null;

  const [prows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id, p.codigo, p.nombre, p.codigo_pieza, p.medida, p.unidad, p.descripcion, p.marca_auto, p.procedencia, p.qr_payload,
            p.precio_venta_lista_bs, p.precio_venta_lista_usd, p.punto_tope
     FROM productos p
     WHERE p.estado = 'activo' AND (${frag.sql})`,
    [...frag.params]
  );
  if (prows.length !== 1) return null;
  const pr = prows[0] as RowDataPacket;
  const id = Number(pr.id);
  const imagenes_urls = await listProductoImagenes(id);

  const sucursales = (await listSucursales())
    .filter((s) => s.estado === "activo")
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const [irows] = await pool.execute<RowDataPacket[]>(
    `SELECT sucursal_id, stock FROM inventario WHERE producto_id = ?`,
    [id]
  );
  const map = new Map<number, number>();
  for (const row of irows as RowDataPacket[]) {
    map.set(Number(row.sucursal_id), Number(row.stock ?? 0));
  }

  const porSucursal: StockSucursalInfo[] = sucursales.map((s) => ({
    sucursalId: s.id,
    sucursalNombre: s.nombre,
    stock: map.get(s.id) ?? 0,
  }));
  const stockMiSucursal = map.get(miSucursalId) ?? 0;

  return {
    id,
    codigo: String(pr.codigo ?? ""),
    nombre: String(pr.nombre ?? ""),
    codigo_pieza: pr.codigo_pieza != null && String(pr.codigo_pieza).trim() !== "" ? String(pr.codigo_pieza) : null,
    medida: pr.medida != null && String(pr.medida).trim() !== "" ? String(pr.medida) : null,
    unidad: pr.unidad != null && String(pr.unidad).trim() !== "" ? String(pr.unidad) : null,
    descripcion: pr.descripcion != null && String(pr.descripcion).trim() !== "" ? String(pr.descripcion) : null,
    marca_auto: pr.marca_auto != null && String(pr.marca_auto).trim() !== "" ? String(pr.marca_auto) : null,
    procedencia: pr.procedencia != null && String(pr.procedencia).trim() !== "" ? String(pr.procedencia) : null,
    qr_payload: String(pr.qr_payload ?? ""),
    imagenes_urls,
    precio_venta_lista_bs: strNum(pr.precio_venta_lista_bs as string | null),
    precio_venta_lista_usd: strNum(pr.precio_venta_lista_usd as string | null),
    punto_tope: strNum(pr.punto_tope as string | null),
    stockMiSucursal,
    porSucursal,
    puedeVenderEnMiSucursal: stockMiSucursal > 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function strNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Solo productos con stock &gt; 0 en la sucursal (para agregar al carrito). */
export async function buscarProductoParaVenta(
  sucursalId: number,
  rawCodigo: string
): Promise<ProductoVentaLookupRow | null> {
  const full = await getProductoVentaCompletoPorCodigo(sucursalId, rawCodigo);
  if (!full || full.stockMiSucursal < 1) return null;
  return {
    id: full.id,
    codigo: full.codigo,
    nombre: full.nombre,
    stock: full.stockMiSucursal,
    precio_venta_lista_bs: full.precio_venta_lista_bs,
    precio_venta_lista_usd: full.precio_venta_lista_usd,
    punto_tope: full.punto_tope,
  };
}

export type ClienteVentaOpt = {
  id: number;
  nombre: string;
};

export type ClienteCreditoBusquedaRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  carnet_identidad: string | null;
};

export async function listClientesActivosParaVenta(): Promise<ClienteVentaOpt[]> {
  const rows = await buscarClientesActivosParaCredito("", 500);
  return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
}

/** Clientes activos y habilitados para crédito (mismo directorio que «Clientes»). */
export async function buscarClientesActivosParaCredito(
  q: string,
  limit = 25
): Promise<ClienteCreditoBusquedaRow[]> {
  const { ensureCreditosSchema } = await import("@/lib/data/creditos");
  await ensureCreditosSchema();

  const term = q.trim();
  const max = Math.min(Math.max(Math.trunc(limit) || 25, 1), 100);
  const params: (string | number)[] = [];
  let filtro = "";

  if (term) {
    const like = `%${term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    filtro = `AND (nombre LIKE ? OR IFNULL(telefono, '') LIKE ? OR IFNULL(carnet_identidad, '') LIKE ?)`;
    params.push(like, like, like);
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, telefono, carnet_identidad
     FROM clientes
     WHERE activo = 1 AND COALESCE(bloqueado_credito, 0) = 0
     ${filtro}
     ORDER BY nombre ASC
     LIMIT ${max}`,
    params
  );

  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre ?? "").trim(),
    telefono: r.telefono != null && String(r.telefono).trim() !== "" ? String(r.telefono).trim() : null,
    carnet_identidad:
      r.carnet_identidad != null && String(r.carnet_identidad).trim() !== ""
        ? String(r.carnet_identidad).trim()
        : null,
  }));
}

export type VentaListadoRow = {
  id: number;
  fecha: Date;
  tipo_pago: TipoPagoVenta;
  total_bs: string;
  total_usd: string;
  estado_cobro: "cobrado" | "pendiente";
  cliente_nombre: string | null;
  vendedor_nombre: string;
};

export type VentaDetalleProductoRow = {
  ventaId: number;
  productoId: number;
  codigo: string;
  codigoPieza: string;
  medida: string;
  nombre: string;
  repuesto: string | null;
  marcaAuto: string | null;
  procedencia: string | null;
  unidad: string | null;
  cantidad: number;
  precioUnitarioBs: number;
  totalLineaBs: number;
};

export async function listVentasDetalleProductosPorIds(
  ventaIds: number[]
): Promise<VentaDetalleProductoRow[]> {
  const ids = [...new Set(ventaIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT d.venta_id,
            d.producto_id,
            d.cantidad,
            d.precio_unitario_bs,
            d.total_linea_bs,
            COALESCE(NULLIF(TRIM(p.codigo), ''), '—') AS codigo,
            COALESCE(NULLIF(TRIM(p.codigo_pieza), ''), '—') AS codigo_pieza,
            COALESCE(NULLIF(TRIM(p.medida), ''), '—') AS medida,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS nombre,
            NULLIF(TRIM(p.repuesto), '') AS repuesto,
            NULLIF(TRIM(p.marca_auto), '') AS marca_auto,
            NULLIF(TRIM(p.procedencia), '') AS procedencia,
            NULLIF(TRIM(p.unidad), '') AS unidad
     FROM venta_detalle d
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE d.venta_id IN (${placeholders})
     ORDER BY d.venta_id ASC, d.id ASC`,
    ids
  );

  return (rows as RowDataPacket[]).map((r) => ({
    ventaId: Number(r.venta_id),
    productoId: Number(r.producto_id),
    codigo: String(r.codigo ?? "—"),
    codigoPieza: String(r.codigo_pieza ?? "—"),
    medida: String(r.medida ?? "—"),
    nombre: String(r.nombre ?? "—"),
    repuesto: r.repuesto != null && String(r.repuesto).trim() !== "" ? String(r.repuesto) : null,
    marcaAuto: r.marca_auto != null && String(r.marca_auto).trim() !== "" ? String(r.marca_auto) : null,
    procedencia: r.procedencia != null && String(r.procedencia).trim() !== "" ? String(r.procedencia) : null,
    unidad: r.unidad != null && String(r.unidad).trim() !== "" ? String(r.unidad) : null,
    cantidad: Number(r.cantidad ?? 0),
    precioUnitarioBs: Number(r.precio_unitario_bs ?? 0),
    totalLineaBs: Number(r.total_linea_bs ?? 0),
  }));
}

export async function listVentasPorSucursal(
  sucursalId: number,
  limit = 80,
  opts?: { fechaDesde: string; fechaHasta: string } | null
): Promise<VentaListadoRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const hasFecha =
    opts != null &&
    typeof opts.fechaDesde === "string" &&
    typeof opts.fechaHasta === "string" &&
    opts.fechaDesde.length > 0 &&
    opts.fechaHasta.length > 0;
  const lim = hasFecha ? sqlInt(limit, 5000) : sqlInt(limit, 200);
  const dateClause = hasFecha ? "AND DATE(v.fecha) >= ? AND DATE(v.fecha) <= ?" : "";
  const params: (string | number)[] = [sucursalId];
  if (hasFecha) {
    params.push(opts!.fechaDesde, opts!.fechaHasta);
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.fecha, v.tipo_pago, v.total_bs, v.total_usd, v.estado_cobro,
            COALESCE(NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(v.cliente_nombre_libre), '')) AS cliente_nombre,
            COALESCE(NULLIF(TRIM(u.nombre_completo), ''), u.username, '—') AS vendedor_nombre
     FROM ventas v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
     ${SQL_EXCLUIR_VENTAS_CREDITO}
     ${dateClause}
     ORDER BY v.fecha DESC, v.id DESC
     LIMIT ${lim}`,
    params
  );
  return rows as VentaListadoRow[];
}

export type VentaTotalesPorDiaRow = {
  fecha: string;
  cantidad: number;
  totalBs: number;
  totalUsd: number;
};

/** Totales agrupados por día (DATE de `ventas.fecha`) en el rango inclusive. */
export async function listTotalesVentasPorDiaPorSucursal(
  sucursalId: number,
  fechaDesde: string,
  fechaHasta: string
): Promise<VentaTotalesPorDiaRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return [];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(v.fecha) AS dia,
            COUNT(*) AS n,
            COALESCE(SUM(v.total_bs), 0) AS sum_bs,
            COALESCE(SUM(v.total_usd), 0) AS sum_usd
     FROM ventas v
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
       ${SQL_EXCLUIR_VENTAS_CREDITO}
       AND DATE(v.fecha) >= ? AND DATE(v.fecha) <= ?
     GROUP BY DATE(v.fecha)
     ORDER BY dia DESC`,
    [sucursalId, d1, d2]
  );

  return (rows as RowDataPacket[]).map((r) => ({
    fecha: mysqlValueToIsoDateOnly(r.dia) ?? "",
    cantidad: Number(r.n),
    totalBs: Number(r.sum_bs),
    totalUsd: Number(r.sum_usd),
  })).filter((row) => row.fecha !== "");
}

/** Sumas de todas las ventas confirmadas en el rango (sin límite de filas). */
export async function sumTotalesVentasPorSucursalEnRango(
  sucursalId: number,
  fechaDesde: string,
  fechaHasta: string
): Promise<{ totalBs: number; totalUsd: number; cantidad: number }> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) {
    return { totalBs: 0, totalUsd: 0, cantidad: 0 };
  }
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return { totalBs: 0, totalUsd: 0, cantidad: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(v.total_bs), 0) AS sum_bs,
            COALESCE(SUM(v.total_usd), 0) AS sum_usd,
            COUNT(*) AS n
     FROM ventas v
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
       ${SQL_EXCLUIR_VENTAS_CREDITO}
       AND DATE(v.fecha) >= ? AND DATE(v.fecha) <= ?`,
    [sucursalId, d1, d2]
  );
  const r = rows[0] as { sum_bs: unknown; sum_usd: unknown; n: unknown } | undefined;
  if (!r) return { totalBs: 0, totalUsd: 0, cantidad: 0 };
  return {
    totalBs: Number(r.sum_bs),
    totalUsd: Number(r.sum_usd),
    cantidad: Number(r.n),
  };
}

export type LineaVentaInput = {
  productoId: number;
  cantidad: number;
  /** null = precio de lista del catálogo */
  precioUnitarioBs: number | null;
};

export type RegistrarVentaVendedorInput = {
  usuarioId: number;
  sucursalId: number;
  clienteId: number | null;
  /** Obligatorio si `enviarACaja` es false (cobro inmediato legacy). */
  tipoPago?: TipoPagoVenta | null;
  tipoCambioId: number;
  tipoCambioSnapshot: number;
  numeroDocumento: string | null;
  /** Comprobante en pantalla / impresión (ej. proforma_1). */
  tipoNota: string | null;
  /** Comprador ocasional sin `cliente_id`. */
  clienteNombreLibre: string | null;
  clienteNit: string | null;
  lineas: LineaVentaInput[];
  /** Solo aplica si tipoPago = credito (YYYY-MM-DD o null) */
  creditoFechaLimite: string | null;
  /** Envía la venta a caja; el cajero registra forma de pago y cobro. */
  enviarACaja?: boolean;
  /** Venta a crédito (cliente obligatorio; entrega y nota en caja). */
  esCredito?: boolean;
  cajeroDestinoUsuarioId?: number | null;
};

export type RegistrarVentaVendedorResult =
  | { ok: true; ventaId: number }
  | { ok: false; message: string };

type ChunkVenta = {
  loteId: number;
  cantidad: number;
  costoUnitBs: number;
  costoUnitUsd: number;
};

type LineaPreparada = {
  productoId: number;
  cantidad: number;
  precioUnitBs: number;
  precioUnitUsd: number;
  chunks: ChunkVenta[];
};

async function prepararLineasVenta(
  conn: PoolConnection,
  sucursalId: number,
  tc: number,
  lineas: LineaVentaInput[]
): Promise<{ ok: true; preparadas: LineaPreparada[] } | { ok: false; message: string }> {
  const sorted = [...lineas].sort(
    (a, b) => Math.trunc(Number(a.productoId)) - Math.trunc(Number(b.productoId))
  );
  const seen = new Set<number>();
  const preparadas: LineaPreparada[] = [];

  for (const line of sorted) {
    const pid = Math.trunc(Number(line.productoId));
    const cant = Math.trunc(Number(line.cantidad));
    if (!Number.isFinite(pid) || pid < 1) {
      return { ok: false, message: "Ítem con producto inválido." };
    }
    if (!Number.isFinite(cant) || cant < 1) {
      return { ok: false, message: "La cantidad debe ser al menos 1 en cada ítem." };
    }
    if (seen.has(pid)) {
      return { ok: false, message: "El mismo producto aparece más de una vez. Unificá cantidades en una sola línea." };
    }
    seen.add(pid);

    const p = await getProducto(pid);
    if (!p || p.estado !== "activo") {
      return { ok: false, message: `Producto #${pid} no existe o está inactivo.` };
    }

    const precioBs =
      line.precioUnitarioBs !== null && Number.isFinite(line.precioUnitarioBs)
        ? round2(line.precioUnitarioBs)
        : round2(strNum(p.precio_venta_lista_bs) ?? NaN);
    if (!Number.isFinite(precioBs) || precioBs <= 0) {
      return { ok: false, message: `Definí precio de venta en Bs para ${p.codigo} (sin lista en catálogo).` };
    }

    const chkPrecio = validarPrecioVentaBs(precioBs, strNum(p.punto_tope));
    if (!chkPrecio.ok) {
      return { ok: false, message: `${p.codigo}: ${chkPrecio.message}` };
    }

    const precioUsd = round4(precioBs / tc);

    const [invRows] = await conn.execute<RowDataPacket[]>(
      `SELECT stock FROM inventario WHERE producto_id = ? AND sucursal_id = ? FOR UPDATE`,
      [pid, sucursalId]
    );
    const stockInv = Number((invRows[0] as { stock?: number } | undefined)?.stock ?? 0);
    if (stockInv < cant) {
      return { ok: false, message: `Stock insuficiente para ${p.codigo} (disponible: ${stockInv}).` };
    }

    const [lotes] = await conn.execute<RowDataPacket[]>(
      `SELECT id, stock_restante, costo_unitario_bs, costo_unitario_usd
       FROM lotes
       WHERE producto_id = ?
         AND sucursal_id = ?
         AND agotado = 0
         AND stock_restante > 0
       ORDER BY fecha_ingreso ASC, id ASC
       FOR UPDATE`,
      [pid, sucursalId]
    );

    const lotesData = (lotes as RowDataPacket[]).map((l) => ({
      id: Number(l.id),
      stock_restante: Number(l.stock_restante),
      costo_unitario_bs: Number(l.costo_unitario_bs),
      costo_unitario_usd: Number(l.costo_unitario_usd),
    }));

    const disp = lotesData.reduce((s, l) => s + l.stock_restante, 0);
    if (disp < cant) {
      return { ok: false, message: `No hay lotes con stock suficiente para ${p.codigo} (FIFO).` };
    }

    const chunks: ChunkVenta[] = [];
    let rest = cant;
    for (const lot of lotesData) {
      if (rest <= 0) break;
      const take = Math.min(rest, lot.stock_restante);
      if (take <= 0) continue;
      chunks.push({
        loteId: lot.id,
        cantidad: take,
        costoUnitBs: round2(lot.costo_unitario_bs),
        costoUnitUsd: round4(lot.costo_unitario_usd),
      });
      rest -= take;
    }

    preparadas.push({
      productoId: pid,
      cantidad: cant,
      precioUnitBs: precioBs,
      precioUnitUsd: precioUsd,
      chunks,
    });
  }

  return { ok: true, preparadas };
}

export async function registrarVentaVendedor(input: RegistrarVentaVendedorInput): Promise<RegistrarVentaVendedorResult> {
  const tc = input.tipoCambioSnapshot;
  if (!Number.isFinite(tc) || tc <= 0) {
    return { ok: false, message: "Tipo de cambio inválido." };
  }

  const suc = await getSucursal(input.sucursalId);
  if (!suc || suc.estado !== "activo") {
    return { ok: false, message: "Sucursal inválida o inactiva." };
  }

  if (!input.lineas.length) {
    return { ok: false, message: "Agregá al menos un producto." };
  }

  const enviarACaja = input.enviarACaja === true;
  if (enviarACaja) {
    const cajeroId = input.cajeroDestinoUsuarioId;
    if (cajeroId == null || !Number.isFinite(cajeroId) || cajeroId < 1) {
      return { ok: false, message: "Elegí el cajero que cobrará esta venta." };
    }
    const chkCajero = await assertCajeroDestinoValido(input.sucursalId, Math.trunc(cajeroId));
    if (!chkCajero.ok) return chkCajero;
  } else if (!input.tipoPago) {
    return { ok: false, message: "Tipo de pago inválido." };
  }

  const esCredito = input.esCredito === true || input.tipoPago === "credito";
  if (esCredito) {
    if (input.clienteId == null || input.clienteId < 1) {
      return { ok: false, message: "Las ventas a crédito requieren un cliente registrado." };
    }
    const chk = await assertClientePuedeRecibirCredito(Math.trunc(input.clienteId));
    if (!chk.ok) return chk;
  }

  const conn = await pool.getConnection();
  try {
    await ensureVentasCobroCajaColumns();
    await conn.query(`SET time_zone = '${MYSQL_SESSION_OFFSET}'`);
    await conn.beginTransaction();

    const fechaVentaMysql = formatDateTimeMysqlBolivia(new Date());

    const prep = await prepararLineasVenta(conn, input.sucursalId, tc, input.lineas);
    if (!prep.ok) {
      await conn.rollback();
      return prep;
    }

    let subtotalBs = 0;
    let subtotalUsd = 0;
    for (const pl of prep.preparadas) {
      for (const ch of pl.chunks) {
        const tBs = round2(ch.cantidad * pl.precioUnitBs);
        const tUsd = round4(ch.cantidad * pl.precioUnitUsd);
        subtotalBs = round2(subtotalBs + tBs);
        subtotalUsd = round4(subtotalUsd + tUsd);
      }
    }

    const estadoCobro = enviarACaja || esCredito ? "pendiente" : "cobrado";
    const tipoPagoInsert = enviarACaja
      ? esCredito
        ? "credito"
        : "efectivo"
      : input.tipoPago!;
    const tipoNotaInsert =
      input.tipoNota?.trim() ||
      (esCredito ? "nota_entrega" : enviarACaja ? "proforma_1" : null);
    const cajeroDestinoId =
      enviarACaja && input.cajeroDestinoUsuarioId != null
        ? Math.trunc(input.cajeroDestinoUsuarioId)
        : null;

    /* Columnas en `ventas`: ver `db/schema_ventas.sql` o migración `db/migrations/001_ventas_tipo_nota_cliente_libre.sql`. */
    const [ventaRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO ventas (
        numero_documento, tipo_nota, cliente_id, cliente_nombre_libre, cliente_nit,
        usuario_id, cajero_destino_usuario_id, sucursal_id, tipo_pago,
        tipo_cambio_id, tipo_cambio_snapshot,
        subtotal_bs, subtotal_usd, total_bs, total_usd,
        estado, estado_cobro, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, ?)`,
      [
        input.numeroDocumento?.trim() || null,
        tipoNotaInsert,
        input.clienteId && input.clienteId > 0 ? input.clienteId : null,
        input.clienteNombreLibre?.trim() || null,
        input.clienteNit?.trim() || null,
        input.usuarioId,
        cajeroDestinoId,
        input.sucursalId,
        tipoPagoInsert,
        input.tipoCambioId,
        tc,
        subtotalBs,
        subtotalUsd,
        subtotalBs,
        subtotalUsd,
        estadoCobro,
        fechaVentaMysql,
      ]
    );
    const ventaId = ventaRes.insertId;

    for (const pl of prep.preparadas) {
      for (const ch of pl.chunks) {
        const totalLineaBs = round2(ch.cantidad * pl.precioUnitBs);
        const totalLineaUsd = round4(ch.cantidad * pl.precioUnitUsd);

        const [cur] = await conn.execute<RowDataPacket[]>(
          `SELECT stock_restante FROM lotes WHERE id = ? FOR UPDATE`,
          [ch.loteId]
        );
        const curStock = Number((cur[0] as { stock_restante?: number } | undefined)?.stock_restante ?? 0);
        if (curStock < ch.cantidad) {
          await conn.rollback();
          return { ok: false, message: "El stock del lote cambió durante la venta. Intentá de nuevo." };
        }
        const nuevo = curStock - ch.cantidad;
        await conn.execute(
          `UPDATE lotes SET stock_restante = ?, agotado = ? WHERE id = ?`,
          [nuevo, nuevo <= 0 ? 1 : 0, ch.loteId]
        );

        await conn.execute(
          `INSERT INTO venta_detalle (
            venta_id, producto_id, lote_id, cantidad,
            precio_unitario_bs, precio_unitario_usd,
            costo_unitario_bs, costo_unitario_usd,
            total_linea_bs, total_linea_usd
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ventaId,
            pl.productoId,
            ch.loteId,
            ch.cantidad,
            pl.precioUnitBs,
            pl.precioUnitUsd,
            ch.costoUnitBs,
            ch.costoUnitUsd,
            totalLineaBs,
            totalLineaUsd,
          ]
        );
      }

      await conn.execute(
        `UPDATE inventario SET stock = stock - ?, actualizado_en = ?
         WHERE producto_id = ? AND sucursal_id = ?`,
        [pl.cantidad, fechaVentaMysql, pl.productoId, input.sucursalId]
      );

      await conn.execute(
        `INSERT INTO movimientos_inventario (
          producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
        ) VALUES (?, ?, 'salida', ?, 'venta', ?, ?, ?, ?)`,
        [
          pl.productoId,
          input.sucursalId,
          pl.cantidad,
          ventaId,
          input.usuarioId,
          `Venta #${ventaId}`,
          fechaVentaMysql,
        ]
      );
    }

    await conn.commit();
    return { ok: true, ventaId };
  } catch (e) {
    await conn.rollback();
    console.error("registrarVentaVendedor", e);
    const sqlMessage =
      e !== null &&
      typeof e === "object" &&
      "sqlMessage" in e &&
      typeof (e as { sqlMessage?: unknown }).sqlMessage === "string"
        ? (e as { sqlMessage: string }).sqlMessage
        : e instanceof Error
          ? e.message
          : String(e);
    let hint = "";
    if (/unknown column/i.test(sqlMessage)) {
      hint =
        " Si falta `tipo_nota`, `cliente_nombre_libre` o `cliente_nit` en la tabla `ventas`, ejecutá el bloque ALTER comentado arriba de `INSERT INTO ventas` en este mismo archivo.";
    }
    return {
      ok: false,
      message: `No se pudo registrar la venta (base de datos): ${sqlMessage}.${hint}`,
    };
  } finally {
    conn.release();
  }
}
