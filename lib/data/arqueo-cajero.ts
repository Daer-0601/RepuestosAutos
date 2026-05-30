import "server-only";

import { ventasRangoFechaSql } from "@/lib/fecha-bolivia";
import { withBoliviaMysqlSession } from "@/lib/mysql-bolivia-session";
import type { RowDataPacket } from "mysql2";

export type ArqueoVendedorRow = {
  usuarioId: number;
  nombreCompleto: string;
  username: string;
  cantidadVentas: number;
  totalBs: number;
  totalUsd: number;
  /** Totales en Bs por forma de pago (ventas confirmadas en el rango). */
  bsEfectivo: number;
  bsQr: number;
  bsTarjeta: number;
  bsCredito: number;
};

/**
 * Arqueo por vendedor: todos los usuarios rol vendedor activos en la sucursal,
 * con sumas de ventas confirmadas en el rango de fechas (calendario Bolivia).
 */
export async function arqueoVentasPorVendedoresSucursal(
  sucursalId: number,
  fechaDesde: string,
  fechaHasta: string
): Promise<ArqueoVendedorRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return [];

  const rango = ventasRangoFechaSql(d1, d2);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT u.id AS usuario_id,
            u.nombre_completo AS nombre_completo,
            u.username AS username,
            COUNT(v.id) AS cantidad_ventas,
            COALESCE(SUM(v.total_bs), 0) AS total_bs,
            COALESCE(SUM(v.total_usd), 0) AS total_usd,
            COALESCE(SUM(CASE WHEN v.estado_cobro = 'cobrado' AND v.tipo_pago = 'efectivo' THEN v.total_bs ELSE 0 END), 0) AS bs_efectivo,
            COALESCE(SUM(CASE WHEN v.estado_cobro = 'cobrado' AND v.tipo_pago = 'qr' THEN v.total_bs ELSE 0 END), 0) AS bs_qr,
            COALESCE(SUM(CASE WHEN v.estado_cobro = 'cobrado' AND v.tipo_pago = 'tarjeta' THEN v.total_bs ELSE 0 END), 0) AS bs_tarjeta,
            COALESCE(SUM(CASE WHEN v.estado_cobro = 'cobrado' AND v.tipo_pago = 'credito' THEN v.total_bs ELSE 0 END), 0) AS bs_credito
     FROM usuarios u
     LEFT JOIN ventas v ON v.usuario_id = u.id
       AND v.sucursal_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}
     WHERE u.rol_id = 3 AND u.sucursal_id = ? AND u.activo = 1
     GROUP BY u.id, u.nombre_completo, u.username
     ORDER BY u.nombre_completo ASC, u.username ASC`,
      [sucursalId, ...rango.params, sucursalId]
    )
  );

  return (rows as RowDataPacket[]).map((r) => ({
    usuarioId: Number(r.usuario_id),
    nombreCompleto: String(r.nombre_completo ?? "").trim() || String(r.username ?? ""),
    username: String(r.username ?? ""),
    cantidadVentas: Number(r.cantidad_ventas ?? 0),
    totalBs: Number(r.total_bs ?? 0),
    totalUsd: Number(r.total_usd ?? 0),
    bsEfectivo: Number(r.bs_efectivo ?? 0),
    bsQr: Number(r.bs_qr ?? 0),
    bsTarjeta: Number(r.bs_tarjeta ?? 0),
    bsCredito: Number(r.bs_credito ?? 0),
  }));
}

/** Línea de detalle para documento de salidas diarias (arqueo cajero). */
export type SalidasDiariasArqueoLinea = {
  fecha: string;
  ventaId: number;
  numeroDocumento: string | null;
  /** Vendedor que registró la venta. */
  vendedorNombre: string;
  /** Código interno del producto (`productos.codigo`). */
  codigoInterno: string;
  codigoPieza: string;
  medida: string;
  descripcion: string;
  cantidad: number;
  totalLineaBs: number;
  totalLineaUsd: number;
};

function mapSalidasDiariasRow(r: RowDataPacket): SalidasDiariasArqueoLinea {
  const totalLineaBs = Number(r.total_linea_bs ?? 0);
  const tc = Number(r.tipo_cambio_snapshot ?? 0);
  const totalLineaUsd =
    tc > 0 && Number.isFinite(tc) ? Math.round((totalLineaBs / tc) * 1e4) / 1e4 : 0;
  return {
    fecha:
      r.fecha instanceof Date
        ? r.fecha.toISOString()
        : typeof r.fecha === "string"
          ? r.fecha
          : "",
    ventaId: Number(r.venta_id),
    numeroDocumento:
      r.numero_documento != null && String(r.numero_documento).trim() !== ""
        ? String(r.numero_documento).trim()
        : null,
    vendedorNombre: String(r.vendedor_nombre ?? "—"),
    codigoInterno: String(r.codigo_interno ?? "—"),
    codigoPieza: String(r.codigo_pieza ?? "—"),
    medida: String(r.medida ?? "—"),
    descripcion: String(r.descripcion ?? "—"),
    cantidad: Number(r.cantidad ?? 0),
    totalLineaBs,
    totalLineaUsd,
  };
}

const SQL_SALIDAS_DIARIAS_SELECT = `SELECT v.fecha AS fecha,
            v.id AS venta_id,
            v.numero_documento AS numero_documento,
            v.tipo_cambio_snapshot AS tipo_cambio_snapshot,
            d.cantidad AS cantidad,
            d.total_linea_bs AS total_linea_bs,
            COALESCE(NULLIF(TRIM(u.nombre_completo), ''), NULLIF(TRIM(u.username), ''), '—') AS vendedor_nombre,
            COALESCE(NULLIF(TRIM(p.codigo), ''), '—') AS codigo_interno,
            COALESCE(NULLIF(TRIM(p.codigo_pieza), ''), '—') AS codigo_pieza,
            COALESCE(NULLIF(TRIM(p.medida), ''), '—') AS medida,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS descripcion`;

export async function getVendedorActivoEnSucursal(
  usuarioId: number,
  sucursalId: number
): Promise<{ nombreCompleto: string; username: string } | null> {
  if (!Number.isFinite(usuarioId) || usuarioId < 1) return null;
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return null;
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT u.nombre_completo, u.username
     FROM usuarios u
     WHERE u.id = ? AND u.rol_id = 3 AND u.sucursal_id = ? AND u.activo = 1
     LIMIT 1`,
      [usuarioId, sucursalId]
    )
  );
  const r = rows[0] as RowDataPacket | undefined;
  if (!r) return null;
  return {
    nombreCompleto: String(r.nombre_completo ?? "").trim() || String(r.username ?? ""),
    username: String(r.username ?? ""),
  };
}

/**
 * Detalle de ítems vendidos por un vendedor en la sucursal (ventas confirmadas, rango calendario Bolivia).
 */
export async function listSalidasDiariasArqueoPorVendedor(
  sucursalId: number,
  usuarioId: number,
  fechaDesde: string,
  fechaHasta: string,
  limitRows = 8000
): Promise<SalidasDiariasArqueoLinea[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  if (!Number.isFinite(usuarioId) || usuarioId < 1) return [];
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return [];

  const lim = Math.min(Math.max(1, Math.trunc(limitRows)), 12000);
  const rango = ventasRangoFechaSql(d1, d2);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `${SQL_SALIDAS_DIARIAS_SELECT}
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     INNER JOIN usuarios u ON u.id = v.usuario_id
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE v.sucursal_id = ?
       AND v.usuario_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}
     ORDER BY v.fecha ASC, v.id ASC, d.id ASC
     LIMIT ${lim}`,
      [sucursalId, usuarioId, ...rango.params]
    )
  );

  return (rows as RowDataPacket[]).map(mapSalidasDiariasRow);
}

/**
 * Salidas de toda la sucursal (todos los vendedores), para arqueo general impreso.
 */
export async function listSalidasDiariasArqueoSucursal(
  sucursalId: number,
  fechaDesde: string,
  fechaHasta: string,
  limitRows = 12000
): Promise<SalidasDiariasArqueoLinea[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return [];

  const lim = Math.min(Math.max(1, Math.trunc(limitRows)), 12000);
  const rango = ventasRangoFechaSql(d1, d2);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `${SQL_SALIDAS_DIARIAS_SELECT}
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     INNER JOIN usuarios u ON u.id = v.usuario_id
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE v.sucursal_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}
     ORDER BY v.fecha ASC, v.id ASC, d.id ASC
     LIMIT ${lim}`,
      [sucursalId, ...rango.params]
    )
  );

  return (rows as RowDataPacket[]).map(mapSalidasDiariasRow);
}

export function totalesSalidasDiarias(lineas: SalidasDiariasArqueoLinea[]): { totalBs: number; totalUsd: number } {
  let totalBs = 0;
  let totalUsd = 0;
  for (const ln of lineas) {
    totalBs = Math.round((totalBs + ln.totalLineaBs) * 100) / 100;
    totalUsd = Math.round((totalUsd + ln.totalLineaUsd) * 1e4) / 1e4;
  }
  return { totalBs, totalUsd };
}
