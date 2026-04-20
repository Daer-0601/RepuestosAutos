import "server-only";

import { pool } from "@/lib/db";
import { getSucursal } from "@/lib/data/sucursales";
import { sqlInt } from "@/lib/data/sql-utils";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

export type ProductoStockSucursalRow = {
  producto_id: number;
  codigo: string;
  nombre: string;
  stock: number;
};

export async function searchProductosConStockEnSucursal(
  sucursalId: number,
  query: string,
  limit = 20
): Promise<ProductoStockSucursalRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const q = query.trim().slice(0, 120).replace(/%/g, "");
  const lim = sqlInt(limit, 100);
  const qNoDots = q.replace(/\./g, "");
  const rows =
    q.length === 0
      ? (
          await pool.execute<RowDataPacket[]>(
            `SELECT p.id AS producto_id, p.codigo, p.nombre, i.stock
             FROM inventario i
             INNER JOIN productos p ON p.id = i.producto_id
             WHERE i.sucursal_id = ?
               AND i.stock > 0
               AND p.estado = 'activo'
             ORDER BY i.stock DESC, p.nombre ASC
             LIMIT ${lim}`,
            [sucursalId]
          )
        )[0]
      : (
          await pool.execute<RowDataPacket[]>(
            `SELECT p.id AS producto_id, p.codigo, p.nombre, i.stock
             FROM inventario i
             INNER JOIN productos p ON p.id = i.producto_id
             WHERE i.sucursal_id = ?
               AND i.stock > 0
               AND p.estado = 'activo'
               AND (
                 p.codigo = ?
                 OR REPLACE(p.codigo, '.', '') = ?
                 OR p.codigo LIKE ?
                 OR p.nombre LIKE ?
                 OR IFNULL(p.descripcion, '') LIKE ?
               )
             ORDER BY
               (p.codigo = ?) DESC,
               (REPLACE(p.codigo, '.', '') = ?) DESC,
               i.stock DESC,
               p.nombre ASC
             LIMIT ${lim}`,
            [sucursalId, q, qNoDots, `%${q}%`, `%${q}%`, `%${q}%`, q, qNoDots]
          )
        )[0];
  return rows.map((r) => ({
    producto_id: Number(r.producto_id),
    codigo: String(r.codigo ?? ""),
    nombre: String(r.nombre ?? ""),
    stock: Number(r.stock ?? 0),
  }));
}

export type TraspasoLineaInput = {
  productoId: number;
  cantidad: number;
};

export type RegistrarTraspasoInput = {
  usuarioId: number;
  sucursalOrigenId: number;
  sucursalDestinoId: number;
  nota: string | null;
  lineas: TraspasoLineaInput[];
};

export type RegistrarTraspasoResult =
  | { ok: true; referenciaId: number }
  | { ok: false; message: string };

type LoteConStock = {
  id: number;
  compra_detalle_id: number | null;
  stock_restante: number;
  costo_unitario_bs: number;
  costo_unitario_usd: number;
};

async function transferirLotesPorProducto(
  conn: PoolConnection,
  productoId: number,
  sucursalOrigenId: number,
  sucursalDestinoId: number,
  cantidad: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [lotes] = await conn.execute<RowDataPacket[]>(
    `SELECT id, compra_detalle_id, stock_restante, costo_unitario_bs, costo_unitario_usd
     FROM lotes
     WHERE producto_id = ?
       AND sucursal_id = ?
       AND agotado = 0
       AND stock_restante > 0
     ORDER BY fecha_ingreso ASC, id ASC
     FOR UPDATE`,
    [productoId, sucursalOrigenId]
  );

  const lotesData = (lotes as LoteConStock[]).map((l) => ({
    id: Number(l.id),
    compra_detalle_id: l.compra_detalle_id == null ? null : Number(l.compra_detalle_id),
    stock_restante: Number(l.stock_restante),
    costo_unitario_bs: Number(l.costo_unitario_bs),
    costo_unitario_usd: Number(l.costo_unitario_usd),
  }));

  const disponible = lotesData.reduce((s, l) => s + l.stock_restante, 0);
  if (disponible < cantidad) {
    return { ok: false, message: "Stock insuficiente en lotes de origen." };
  }

  let porMover = cantidad;
  for (const lot of lotesData) {
    if (porMover <= 0) break;
    const take = Math.min(porMover, lot.stock_restante);
    const nuevoStock = lot.stock_restante - take;

    await conn.execute(
      `UPDATE lotes
       SET stock_restante = ?, agotado = ?
       WHERE id = ?`,
      [nuevoStock, nuevoStock <= 0 ? 1 : 0, lot.id]
    );

    await conn.execute(
      `INSERT INTO lotes (
         producto_id, compra_detalle_id, sucursal_id,
         cantidad_inicial, stock_restante, costo_unitario_bs, costo_unitario_usd, fecha_ingreso, agotado
       ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0)`,
      [
        productoId,
        lot.compra_detalle_id,
        sucursalDestinoId,
        take,
        take,
        lot.costo_unitario_bs,
        lot.costo_unitario_usd,
      ]
    );

    porMover -= take;
  }

  return { ok: true };
}

export async function registrarTraspaso(input: RegistrarTraspasoInput): Promise<RegistrarTraspasoResult> {
  const sidOrig = Number(input.sucursalOrigenId);
  const sidDest = Number(input.sucursalDestinoId);
  if (!Number.isFinite(sidOrig) || sidOrig < 1 || !Number.isFinite(sidDest) || sidDest < 1) {
    return { ok: false, message: "Sucursal origen/destino inválida." };
  }
  if (sidOrig === sidDest) {
    return { ok: false, message: "La sucursal origen y destino deben ser distintas." };
  }
  if (!Array.isArray(input.lineas) || input.lineas.length === 0) {
    return { ok: false, message: "Agregá al menos un producto al traspaso." };
  }

  const origen = await getSucursal(sidOrig);
  const destino = await getSucursal(sidDest);
  if (!origen || origen.estado !== "activo") {
    return { ok: false, message: "Sucursal origen inválida o inactiva." };
  }
  if (!destino || destino.estado !== "activo") {
    return { ok: false, message: "Sucursal destino inválida o inactiva." };
  }

  const agregadas = new Map<number, number>();
  for (const line of input.lineas) {
    const pid = Number(line.productoId);
    const cant = Math.trunc(Number(line.cantidad));
    if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(cant) || cant < 1) {
      return { ok: false, message: "Línea de traspaso inválida." };
    }
    agregadas.set(pid, (agregadas.get(pid) ?? 0) + cant);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const referenciaId = Math.trunc(Date.now() / 1000);
    const notaBase = input.nota?.trim() || `Traspaso ${origen.nombre} -> ${destino.nombre}`;

    for (const [productoId, cantidad] of agregadas) {
      const [stockRows] = await conn.execute<RowDataPacket[]>(
        `SELECT stock
         FROM inventario
         WHERE producto_id = ? AND sucursal_id = ?
         FOR UPDATE`,
        [productoId, sidOrig]
      );
      const stockOrigen = Number((stockRows[0] as { stock?: number } | undefined)?.stock ?? 0);
      if (stockOrigen < cantidad) {
        await conn.rollback();
        return { ok: false, message: `Stock insuficiente para producto #${productoId} en origen.` };
      }

      const moved = await transferirLotesPorProducto(conn, productoId, sidOrig, sidDest, cantidad);
      if (!moved.ok) {
        await conn.rollback();
        return { ok: false, message: `No se pudo mover lotes del producto #${productoId}.` };
      }

      await conn.execute(
        `INSERT INTO inventario (producto_id, sucursal_id, stock, actualizado_en)
         VALUES (?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE actualizado_en = NOW()`,
        [productoId, sidOrig]
      );
      await conn.execute(
        `INSERT INTO inventario (producto_id, sucursal_id, stock, actualizado_en)
         VALUES (?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE actualizado_en = NOW()`,
        [productoId, sidDest]
      );
      await conn.execute(
        `UPDATE inventario SET stock = stock - ?, actualizado_en = NOW()
         WHERE producto_id = ? AND sucursal_id = ?`,
        [cantidad, productoId, sidOrig]
      );
      await conn.execute(
        `UPDATE inventario SET stock = stock + ?, actualizado_en = NOW()
         WHERE producto_id = ? AND sucursal_id = ?`,
        [cantidad, productoId, sidDest]
      );

      await conn.execute(
        `INSERT INTO movimientos_inventario (
           producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
         ) VALUES (?, ?, 'salida', ?, 'traspaso', ?, ?, ?, NOW())`,
        [productoId, sidOrig, cantidad, referenciaId, input.usuarioId, notaBase]
      );
      await conn.execute(
        `INSERT INTO movimientos_inventario (
           producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
         ) VALUES (?, ?, 'entrada', ?, 'traspaso', ?, ?, ?, NOW())`,
        [productoId, sidDest, cantidad, referenciaId, input.usuarioId, notaBase]
      );
    }

    await conn.commit();
    return { ok: true, referenciaId };
  } catch (e) {
    await conn.rollback();
    console.error("registrarTraspaso", e);
    return { ok: false, message: "No se pudo registrar el traspaso (error de base de datos)." };
  } finally {
    conn.release();
  }
}
