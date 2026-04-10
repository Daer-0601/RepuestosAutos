import "server-only";

import { pool } from "@/lib/db";
import { sqlInt } from "@/lib/data/sql-utils";
import type { RowDataPacket } from "mysql2";

export type VentasResumen = {
  cantidad: number;
  total_bs: string | null;
  total_usd: string | null;
};

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

export type ComprasResumen = {
  cantidad: number;
  total_bs: string | null;
};

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

export type VentaPorSucursalRow = {
  sucursal: string;
  ventas: number;
  total_bs: string | null;
};

export async function ventasPorSucursalUltimosDias(
  dias: number
): Promise<VentaPorSucursalRow[]> {
  const d = sqlInt(dias, 3650);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.nombre AS sucursal,
            COUNT(v.id) AS ventas,
            COALESCE(SUM(v.total_bs), 0) AS total_bs
     FROM ventas v
     INNER JOIN sucursales s ON s.id = v.sucursal_id
     WHERE v.estado = 'confirmada'
       AND v.fecha >= DATE_SUB(NOW(), INTERVAL ${d} DAY)
     GROUP BY s.id, s.nombre
     ORDER BY total_bs DESC`
  );
  return rows as VentaPorSucursalRow[];
}
