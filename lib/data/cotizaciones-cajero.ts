import "server-only";

import { pool } from "@/lib/db";
import { MYSQL_SESSION_OFFSET, formatDateTimeMysqlBolivia } from "@/lib/fecha-bolivia";
import type { RowDataPacket } from "mysql2";

let cotizacionesSchemaReady = false;

/** Crea tablas de cotización si no existen y aplica columnas de flujo cajero en instalaciones previas. */
export async function ensureCotizacionCajaColumns(): Promise<void> {
  if (cotizacionesSchemaReady) return;

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS cotizaciones (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      usuario_id INT UNSIGNED NOT NULL,
      cajero_destino_usuario_id INT UNSIGNED NULL,
      cajero_impresion_usuario_id INT UNSIGNED NULL,
      cliente_nombre VARCHAR(255) NULL,
      cliente_nit VARCHAR(64) NULL,
      notas TEXT NULL,
      tipo_cambio_id INT UNSIGNED NOT NULL,
      tipo_cambio_snapshot DECIMAL(18,6) NOT NULL,
      total_bs DECIMAL(18,2) NOT NULL,
      total_usd DECIMAL(18,6) NOT NULL,
      estado VARCHAR(24) NOT NULL DEFAULT 'pendiente',
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_impresion DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_cotizaciones_fecha (fecha),
      KEY idx_cotizaciones_usuario (usuario_id),
      KEY idx_cotizaciones_estado (estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS cotizacion_detalle (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      cotizacion_id INT UNSIGNED NOT NULL,
      producto_id INT UNSIGNED NOT NULL,
      cantidad INT NOT NULL,
      precio_unitario_bs DECIMAL(18,4) NOT NULL,
      precio_unitario_usd DECIMAL(18,6) NOT NULL,
      total_linea_bs DECIMAL(18,2) NOT NULL,
      total_linea_usd DECIMAL(18,6) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_cotizacion_detalle_cot (cotizacion_id),
      KEY idx_cotizacion_detalle_prod (producto_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const alters = [
    `ALTER TABLE cotizaciones ADD COLUMN cajero_destino_usuario_id INT UNSIGNED NULL AFTER usuario_id`,
    `ALTER TABLE cotizaciones ADD COLUMN cajero_impresion_usuario_id INT UNSIGNED NULL AFTER cajero_destino_usuario_id`,
    `ALTER TABLE cotizaciones ADD COLUMN fecha_impresion DATETIME NULL AFTER fecha`,
  ];
  for (const sql of alters) {
    try {
      await pool.execute(sql);
    } catch (err: unknown) {
      const e = err as { errno?: number };
      if (e.errno !== 1060) throw err;
    }
  }

  cotizacionesSchemaReady = true;
}

export type CotizacionPendienteImpresionRow = {
  id: number;
  fecha: string;
  totalBs: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  vendedorNombre: string;
  cajeroAsignadoNombre: string | null;
  cantidadItems: number;
};

export async function listCotizacionesPendientesImpresionSucursal(
  sucursalId: number,
  opts?: { fechaDesde?: string | null; fechaHasta?: string | null }
): Promise<CotizacionPendienteImpresionRow[]> {
  await ensureCotizacionCajaColumns();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];

  const conn = await pool.getConnection();
  try {
    await conn.query(`SET time_zone = '${MYSQL_SESSION_OFFSET}'`);

    const params: (string | number)[] = [sucursalId];
    let dateClause = "";
    const d1 = opts?.fechaDesde?.trim();
    const d2 = opts?.fechaHasta?.trim();
    if (d1 && /^\d{4}-\d{2}-\d{2}$/.test(d1) && d2 && /^\d{4}-\d{2}-\d{2}$/.test(d2)) {
      dateClause = "AND c.fecha >= ? AND c.fecha < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(`${d1} 00:00:00`, `${d2} 00:00:00`);
    } else if (d1 && /^\d{4}-\d{2}-\d{2}$/.test(d1)) {
      dateClause = "AND c.fecha >= ? AND c.fecha < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(`${d1} 00:00:00`, `${d1} 00:00:00`);
    }

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT c.id, c.fecha, c.total_bs,
              NULLIF(TRIM(c.cliente_nombre), '') AS cliente_nombre,
              NULLIF(TRIM(c.cliente_nit), '') AS cliente_nit,
              u.nombre_completo AS vendedor_nombre,
              u.username AS vendedor_username,
              COALESCE(NULLIF(TRIM(uc.nombre_completo), ''), NULLIF(TRIM(uc.username), '')) AS cajero_asignado,
              COALESCE(det.n_items, 0) AS n_items
       FROM cotizaciones c
       INNER JOIN usuarios u ON u.id = c.usuario_id
       LEFT JOIN usuarios uc ON uc.id = c.cajero_destino_usuario_id
       LEFT JOIN (
         SELECT cotizacion_id, COUNT(*) AS n_items
         FROM cotizacion_detalle
         GROUP BY cotizacion_id
       ) det ON det.cotizacion_id = c.id
       WHERE u.sucursal_id = ?
         AND c.estado = 'pendiente'
         ${dateClause}
       ORDER BY c.fecha ASC, c.id ASC`,
      params
    );

    return (rows as RowDataPacket[]).map((r) => ({
      id: Number(r.id),
      fecha: r.fecha instanceof Date ? formatDateTimeMysqlBolivia(r.fecha) : String(r.fecha ?? ""),
      totalBs: Number(r.total_bs ?? 0),
      clienteNombre:
        r.cliente_nombre != null && String(r.cliente_nombre).trim() !== "" ? String(r.cliente_nombre) : null,
      clienteNit: r.cliente_nit != null && String(r.cliente_nit).trim() !== "" ? String(r.cliente_nit) : null,
      vendedorNombre: String(r.vendedor_nombre ?? "").trim() || String(r.vendedor_username ?? ""),
      cajeroAsignadoNombre:
        r.cajero_asignado != null && String(r.cajero_asignado).trim() !== "" ? String(r.cajero_asignado) : null,
      cantidadItems: Number(r.n_items ?? 0),
    }));
  } finally {
    conn.release();
  }
}

export type CotizacionImpresionDetalle = {
  id: number;
  fecha: string;
  totalBs: number;
  totalUsd: number;
  tipoCambioSnapshot: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  notas: string | null;
  vendedorNombre: string;
  lineas: {
    codigoPieza: string;
    medida: string;
    nombre: string;
    cantidad: number;
    precioUnitarioBs: number;
    totalLineaBs: number;
  }[];
};

export async function getCotizacionPendienteImpresionDetalle(
  cotizacionId: number,
  sucursalId: number
): Promise<CotizacionImpresionDetalle | null> {
  await ensureCotizacionCajaColumns();
  if (!Number.isFinite(cotizacionId) || cotizacionId < 1 || !Number.isFinite(sucursalId) || sucursalId < 1) {
    return null;
  }

  const [headRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.fecha, c.total_bs, c.total_usd, c.tipo_cambio_snapshot,
            NULLIF(TRIM(c.cliente_nombre), '') AS cliente_nombre,
            NULLIF(TRIM(c.cliente_nit), '') AS cliente_nit,
            NULLIF(TRIM(c.notas), '') AS notas,
            u.nombre_completo AS vendedor_nombre,
            u.username AS vendedor_username
     FROM cotizaciones c
     INNER JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.id = ? AND u.sucursal_id = ? AND c.estado = 'pendiente'
     LIMIT 1`,
    [cotizacionId, sucursalId]
  );
  const h = headRows[0];
  if (!h) return null;

  const [lineRows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.cantidad, d.precio_unitario_bs, d.total_linea_bs,
            COALESCE(NULLIF(TRIM(p.codigo_pieza), ''), '—') AS codigo_pieza,
            COALESCE(NULLIF(TRIM(p.medida), ''), '—') AS medida,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS nombre
     FROM cotizacion_detalle d
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE d.cotizacion_id = ?
     ORDER BY d.id ASC`,
    [cotizacionId]
  );

  return {
    id: Number(h.id),
    fecha: h.fecha instanceof Date ? formatDateTimeMysqlBolivia(h.fecha) : String(h.fecha ?? ""),
    totalBs: Number(h.total_bs ?? 0),
    totalUsd: Number(h.total_usd ?? 0),
    tipoCambioSnapshot: Number(h.tipo_cambio_snapshot ?? 0),
    clienteNombre:
      h.cliente_nombre != null && String(h.cliente_nombre).trim() !== "" ? String(h.cliente_nombre) : null,
    clienteNit: h.cliente_nit != null && String(h.cliente_nit).trim() !== "" ? String(h.cliente_nit) : null,
    notas: h.notas != null && String(h.notas).trim() !== "" ? String(h.notas) : null,
    vendedorNombre: String(h.vendedor_nombre ?? "").trim() || String(h.vendedor_username ?? ""),
    lineas: (lineRows as RowDataPacket[]).map((r) => ({
      codigoPieza: String(r.codigo_pieza ?? "—"),
      medida: String(r.medida ?? "—"),
      nombre: String(r.nombre ?? "—"),
      cantidad: Number(r.cantidad ?? 0),
      precioUnitarioBs: Number(r.precio_unitario_bs ?? 0),
      totalLineaBs: Number(r.total_linea_bs ?? 0),
    })),
  };
}

export async function registrarImpresionCotizacionCajero(input: {
  cotizacionId: number;
  sucursalId: number;
  cajeroUsuarioId: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureCotizacionCajaColumns();
  const cotizacionId = Math.trunc(input.cotizacionId);
  if (!Number.isFinite(cotizacionId) || cotizacionId < 1) {
    return { ok: false, message: "Cotización inválida." };
  }

  const detalle = await getCotizacionPendienteImpresionDetalle(cotizacionId, input.sucursalId);
  if (!detalle) {
    return { ok: false, message: "Cotización no encontrada o ya fue impresa." };
  }

  const fechaImp = formatDateTimeMysqlBolivia(new Date());
  const [res] = await pool.execute(
    `UPDATE cotizaciones c
     INNER JOIN usuarios u ON u.id = c.usuario_id
     SET c.estado = 'impresa',
         c.cajero_impresion_usuario_id = ?,
         c.fecha_impresion = ?
     WHERE c.id = ? AND u.sucursal_id = ? AND c.estado = 'pendiente'`,
    [input.cajeroUsuarioId, fechaImp, cotizacionId, input.sucursalId]
  );
  const affected = (res as { affectedRows?: number }).affectedRows ?? 0;
  if (affected < 1) {
    return { ok: false, message: "No se pudo registrar la impresión." };
  }
  return { ok: true };
}
