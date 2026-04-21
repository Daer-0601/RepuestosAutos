import "server-only";

import { pool } from "@/lib/db";
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
import { getProducto } from "@/lib/data/productos";
import { getSucursal, listSucursales } from "@/lib/data/sucursales";
import { sqlInt } from "@/lib/data/sql-utils";
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
    };
  }
  if (modo === "referencia") {
    return {
      ...fields,
      stock: "positivo",
      sucursalStockId: null,
      estado: "activo",
      pageSize,
    };
  }
  return {
    ...fields,
    stock: "",
    sucursalStockId: null,
    estado: "activo",
    pageSize,
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
    descripcion: r.descripcion,
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
    `SELECT p.id, p.codigo, p.nombre, p.precio_venta_lista_bs, p.precio_venta_lista_usd, p.punto_tope
     FROM productos p
     WHERE p.estado = 'activo' AND (${frag.sql})`,
    [...frag.params]
  );
  if (prows.length !== 1) return null;
  const pr = prows[0] as RowDataPacket;
  const id = Number(pr.id);

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

export async function listClientesActivosParaVenta(): Promise<ClienteVentaOpt[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre FROM clientes WHERE activo = 1 ORDER BY nombre ASC`
  );
  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre ?? ""),
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
};

export async function listVentasPorSucursal(sucursalId: number, limit = 80): Promise<VentaListadoRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const lim = sqlInt(limit, 200);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id, v.fecha, v.tipo_pago, v.total_bs, v.total_usd, v.estado_cobro,
            c.nombre AS cliente_nombre
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
     ORDER BY v.fecha DESC, v.id DESC
     LIMIT ${lim}`,
    [sucursalId]
  );
  return rows as VentaListadoRow[];
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
  tipoPago: TipoPagoVenta;
  tipoCambioId: number;
  tipoCambioSnapshot: number;
  numeroDocumento: string | null;
  lineas: LineaVentaInput[];
  /** Solo aplica si tipoPago = credito (YYYY-MM-DD o null) */
  creditoFechaLimite: string | null;
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

    let precioBs =
      line.precioUnitarioBs !== null && Number.isFinite(line.precioUnitarioBs)
        ? round2(line.precioUnitarioBs)
        : round2(strNum(p.precio_venta_lista_bs) ?? NaN);
    if (!Number.isFinite(precioBs) || precioBs <= 0) {
      return { ok: false, message: `Definí precio de venta en Bs para ${p.codigo} (sin lista en catálogo).` };
    }

    const tope = strNum(p.punto_tope);
    if (tope !== null && precioBs > tope) {
      return { ok: false, message: `El precio de ${p.codigo} supera el tope (${tope.toFixed(2)} Bs).` };
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

  if (input.tipoPago === "credito") {
    if (input.clienteId == null || input.clienteId < 1) {
      return { ok: false, message: "Las ventas a crédito requieren cliente." };
    }
    const cli = await getCliente(input.clienteId);
    if (!cli || cli.activo !== 1) {
      return { ok: false, message: "Cliente inválido o inactivo." };
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

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

    const estadoCobro = input.tipoPago === "credito" ? "pendiente" : "cobrado";

    const [ventaRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO ventas (
        numero_documento, cliente_id, usuario_id, sucursal_id, tipo_pago,
        tipo_cambio_id, tipo_cambio_snapshot,
        subtotal_bs, subtotal_usd, total_bs, total_usd,
        estado, estado_cobro, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', ?, NOW())`,
      [
        input.numeroDocumento?.trim() || null,
        input.clienteId && input.clienteId > 0 ? input.clienteId : null,
        input.usuarioId,
        input.sucursalId,
        input.tipoPago,
        input.tipoCambioId,
        tc,
        subtotalBs,
        subtotalUsd,
        subtotalBs,
        subtotalUsd,
        estadoCobro,
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
        `UPDATE inventario SET stock = stock - ?, actualizado_en = NOW()
         WHERE producto_id = ? AND sucursal_id = ?`,
        [pl.cantidad, pl.productoId, input.sucursalId]
      );

      await conn.execute(
        `INSERT INTO movimientos_inventario (
          producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
        ) VALUES (?, ?, 'salida', ?, 'venta', ?, ?, ?, NOW())`,
        [
          pl.productoId,
          input.sucursalId,
          pl.cantidad,
          ventaId,
          input.usuarioId,
          `Venta #${ventaId}`,
        ]
      );
    }

    if (input.tipoPago === "credito") {
      let fechaLim: string | null = null;
      if (input.creditoFechaLimite?.trim()) {
        const d = input.creditoFechaLimite.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          await conn.rollback();
          return { ok: false, message: "Fecha límite de crédito inválida (usá AAAA-MM-DD)." };
        }
        fechaLim = d;
      }
      await conn.execute(
        `INSERT INTO creditos (venta_id, monto_total_bs, saldo_pendiente_bs, fecha_inicio, fecha_limite, estado)
         VALUES (?, ?, ?, CURDATE(), ?, 'pendiente')`,
        [ventaId, subtotalBs, subtotalBs, fechaLim]
      );
    }

    await conn.commit();
    return { ok: true, ventaId };
  } catch (e) {
    await conn.rollback();
    console.error("registrarVentaVendedor", e);
    return { ok: false, message: "No se pudo registrar la venta (error de base de datos)." };
  } finally {
    conn.release();
  }
}
