import "server-only";

import { pool } from "@/lib/db";
import { sqlInt } from "@/lib/data/sql-utils";
import type { RowDataPacket } from "mysql2";

/** Semana = desde el lunes de la semana actual; mes y año = calendario vigente. */
export type PeriodoReporte = "semana" | "mes" | "anio";

export function parsePeriodoReporte(raw: string | undefined | null): PeriodoReporte {
  if (raw === "semana" || raw === "mes" || raw === "anio") return raw;
  return "mes";
}

function sqlCondicionVentasFecha(periodo: PeriodoReporte, alias = "v"): string {
  const f = `${alias}.fecha`;
  switch (periodo) {
    case "semana":
      return `${f} >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND ${f} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`;
    case "mes":
      return `YEAR(${f}) = YEAR(CURDATE()) AND MONTH(${f}) = MONTH(CURDATE())`;
    case "anio":
      return `YEAR(${f}) = YEAR(CURDATE())`;
    default:
      return `YEAR(${f}) = YEAR(CURDATE()) AND MONTH(${f}) = MONTH(CURDATE())`;
  }
}

function sqlCondicionComprasFecha(periodo: PeriodoReporte, alias = "c"): string {
  const f = `${alias}.fecha`;
  switch (periodo) {
    case "semana":
      return `${f} >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AND ${f} < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`;
    case "mes":
      return `YEAR(${f}) = YEAR(CURDATE()) AND MONTH(${f}) = MONTH(CURDATE())`;
    case "anio":
      return `YEAR(${f}) = YEAR(CURDATE())`;
    default:
      return `YEAR(${f}) = YEAR(CURDATE()) AND MONTH(${f}) = MONTH(CURDATE())`;
  }
}

function etiquetaPeriodo(periodo: PeriodoReporte): string {
  switch (periodo) {
    case "semana":
      return "Semana actual (desde el lunes)";
    case "mes":
      return "Mes actual";
    case "anio":
      return "Año actual";
    default:
      return "";
  }
}

export { etiquetaPeriodo };

export type VentasResumen = {
  cantidad: number;
  total_bs: string | null;
  total_usd: string | null;
};

export async function resumenVentasPorPeriodo(
  periodo: PeriodoReporte,
  sucursalId: number | null
): Promise<VentasResumen> {
  const cond = sqlCondicionVentasFecha(periodo);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(v.total_bs), 0) AS total_bs,
            COALESCE(SUM(v.total_usd), 0) AS total_usd
     FROM ventas v
     WHERE v.estado = 'confirmada'
       AND (${cond})
       AND (? IS NULL OR v.sucursal_id = ?)`,
    [sucursalId, sucursalId]
  );
  const r = rows[0] as { cantidad: number; total_bs: string | null; total_usd: string | null };
  return {
    cantidad: Number(r.cantidad),
    total_bs: r.total_bs,
    total_usd: r.total_usd,
  };
}

export type ComprasResumen = {
  cantidad: number;
  total_bs: string | null;
};

export async function resumenComprasPorPeriodo(
  periodo: PeriodoReporte,
  sucursalId: number | null
): Promise<ComprasResumen> {
  const cond = sqlCondicionComprasFecha(periodo);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(c.total_bs), 0) AS total_bs
     FROM compras c
     WHERE c.estado = 'confirmada'
       AND (${cond})
       AND (? IS NULL OR c.sucursal_id = ?)`,
    [sucursalId, sucursalId]
  );
  const r = rows[0] as { cantidad: number; total_bs: string | null };
  return { cantidad: Number(r.cantidad), total_bs: r.total_bs };
}

export type VentaPorSucursalRow = {
  sucursal: string;
  ventas: number;
  total_bs: string | null;
  total_usd: string | null;
};

export async function ventasPorSucursalPorPeriodo(
  periodo: PeriodoReporte,
  sucursalId: number | null
): Promise<VentaPorSucursalRow[]> {
  const cond = sqlCondicionVentasFecha(periodo);
  const lim = sqlInt(200, 500);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.nombre AS sucursal,
            COUNT(v.id) AS ventas,
            COALESCE(SUM(v.total_bs), 0) AS total_bs,
            COALESCE(SUM(v.total_usd), 0) AS total_usd
     FROM ventas v
     INNER JOIN sucursales s ON s.id = v.sucursal_id
     WHERE v.estado = 'confirmada'
       AND (${cond})
       AND (? IS NULL OR v.sucursal_id = ?)
     GROUP BY s.id, s.nombre
     ORDER BY total_bs DESC
     LIMIT ${lim}`,
    [sucursalId, sucursalId]
  );
  return rows as VentaPorSucursalRow[];
}

export type CompraPorSucursalRow = {
  sucursal: string;
  compras: number;
  total_bs: string | null;
};

export async function comprasPorSucursalPorPeriodo(
  periodo: PeriodoReporte,
  sucursalId: number | null
): Promise<CompraPorSucursalRow[]> {
  const cond = sqlCondicionComprasFecha(periodo);
  const lim = sqlInt(200, 500);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.nombre AS sucursal,
            COUNT(c.id) AS compras,
            COALESCE(SUM(c.total_bs), 0) AS total_bs
     FROM compras c
     INNER JOIN sucursales s ON s.id = c.sucursal_id
     WHERE c.estado = 'confirmada'
       AND (${cond})
       AND (? IS NULL OR c.sucursal_id = ?)
     GROUP BY s.id, s.nombre
     ORDER BY total_bs DESC
     LIMIT ${lim}`,
    [sucursalId, sucursalId]
  );
  return rows as CompraPorSucursalRow[];
}

export type TopVendedorRow = {
  nombre_completo: string;
  username: string;
  ventas: number;
  total_bs: string | null;
  total_usd: string | null;
};

/**
 * Ranking por total Bs. Requiere `ventas.usuario_id` (misma idea que `compras.usuario_id`).
 */
export async function topVendedoresPorPeriodo(
  periodo: PeriodoReporte,
  sucursalId: number | null,
  limit = 15
): Promise<TopVendedorRow[]> {
  const cond = sqlCondicionVentasFecha(periodo);
  const lim = sqlInt(limit, 100);
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT u.nombre_completo, u.username,
              COUNT(v.id) AS ventas,
              COALESCE(SUM(v.total_bs), 0) AS total_bs,
              COALESCE(SUM(v.total_usd), 0) AS total_usd
       FROM ventas v
       INNER JOIN usuarios u ON u.id = v.usuario_id
       WHERE v.estado = 'confirmada'
         AND (${cond})
         AND (? IS NULL OR v.sucursal_id = ?)
       GROUP BY u.id, u.nombre_completo, u.username
       ORDER BY total_bs DESC
       LIMIT ${lim}`,
      [sucursalId, sucursalId]
    );
    return rows as TopVendedorRow[];
  } catch (e) {
    console.error("topVendedoresPorPeriodo", e);
    return [];
  }
}

export type TopProductoRow = {
  codigo: string;
  nombre: string;
  unidades: number;
  total_bs: string | null;
};

/**
 * Por unidades vendidas. `venta_detalle` expone `total_linea_bs` (no hay `subtotal_linea_bs`).
 */
export async function topProductosPorPeriodo(
  periodo: PeriodoReporte,
  sucursalId: number | null,
  limit = 15
): Promise<TopProductoRow[]> {
  const cond = sqlCondicionVentasFecha(periodo);
  const lim = sqlInt(limit, 100);
  try {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT p.codigo, p.nombre,
              SUM(d.cantidad) AS unidades,
              COALESCE(SUM(d.total_linea_bs), 0) AS total_bs
       FROM venta_detalle d
       INNER JOIN ventas v ON v.id = d.venta_id
       INNER JOIN productos p ON p.id = d.producto_id
       WHERE v.estado = 'confirmada'
         AND (${cond})
         AND (? IS NULL OR v.sucursal_id = ?)
       GROUP BY p.id, p.codigo, p.nombre
       ORDER BY unidades DESC, total_bs DESC
       LIMIT ${lim}`,
      [sucursalId, sucursalId]
    );
    return rows as TopProductoRow[];
  } catch (e) {
    console.error("topProductosPorPeriodo", e);
    return [];
  }
}

export type StockBajoRow = {
  sucursal: string;
  producto: string;
  codigo: string;
  stock: number;
};

export async function listStockBajo(limiteStock: number, limitRows = 50): Promise<StockBajoRow[]> {
  const lr = sqlInt(limitRows, 500);
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT s.nombre AS sucursal, p.nombre AS producto, p.codigo, i.stock
     FROM inventario i
     INNER JOIN sucursales s ON s.id = i.sucursal_id
     INNER JOIN productos p ON p.id = i.producto_id
     WHERE i.stock <= ? AND p.estado = 'activo' AND s.estado = 'activo'
     ORDER BY i.stock ASC, s.nombre, p.nombre
     LIMIT ${lr}`,
    [limiteStock]
  );
  return rows as StockBajoRow[];
}

/** @deprecated Usar `resumenVentasPorPeriodo` con período deseado. */
export async function resumenVentasUltimosDias(dias: number): Promise<VentasResumen> {
  const d = sqlInt(dias, 3650);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(total_bs), 0) AS total_bs,
            COALESCE(SUM(total_usd), 0) AS total_usd
     FROM ventas
     WHERE estado = 'confirmada'
       AND fecha >= DATE_SUB(NOW(), INTERVAL ${d} DAY)`
  );
  const r = rows[0] as {
    cantidad: number;
    total_bs: string | null;
    total_usd: string | null;
  };
  return {
    cantidad: Number(r.cantidad),
    total_bs: r.total_bs,
    total_usd: r.total_usd,
  };
}

/** @deprecated Usar `resumenComprasPorPeriodo`. */
export async function resumenComprasUltimosDias(dias: number): Promise<ComprasResumen> {
  const d = sqlInt(dias, 3650);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(total_bs), 0) AS total_bs
     FROM compras
     WHERE estado = 'confirmada'
       AND fecha >= DATE_SUB(NOW(), INTERVAL ${d} DAY)`
  );
  const r = rows[0] as { cantidad: number; total_bs: string | null };
  return { cantidad: Number(r.cantidad), total_bs: r.total_bs };
}

/** @deprecated Usar `ventasPorSucursalPorPeriodo`. */
export async function ventasPorSucursalUltimosDias(dias: number): Promise<VentaPorSucursalRow[]> {
  const d = sqlInt(dias, 3650);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.nombre AS sucursal,
            COUNT(v.id) AS ventas,
            COALESCE(SUM(v.total_bs), 0) AS total_bs,
            COALESCE(SUM(v.total_usd), 0) AS total_usd
     FROM ventas v
     INNER JOIN sucursales s ON s.id = v.sucursal_id
     WHERE v.estado = 'confirmada'
       AND v.fecha >= DATE_SUB(NOW(), INTERVAL ${d} DAY)
     GROUP BY s.id, s.nombre
     ORDER BY total_bs DESC`
  );
  return rows as VentaPorSucursalRow[];
}
