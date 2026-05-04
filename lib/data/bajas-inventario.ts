import "server-only";

import { pool } from "@/lib/db";
import { getProducto } from "@/lib/data/productos";
import { getSucursal } from "@/lib/data/sucursales";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

export type BajaInventarioLineaInput = {
  productoId: number;
  cantidad: number;
};

export type RegistrarBajaInventarioInput = {
  usuarioId: number;
  sucursalId: number;
  nota: string | null;
  lineas: BajaInventarioLineaInput[];
};

export type RegistrarBajaInventarioResult =
  | { ok: true; referenciaId: number }
  | { ok: false; message: string };

type LoteRow = {
  id: number;
  stock_restante: number;
};

/**
 * Descuenta unidades de los lotes más antiguos (FIFO) sin crear destino ni venta.
 */
async function consumirLotesBajaFifo(
  conn: PoolConnection,
  productoId: number,
  sucursalId: number,
  cantidad: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [lotes] = await conn.execute<RowDataPacket[]>(
    `SELECT id, stock_restante
     FROM lotes
     WHERE producto_id = ?
       AND sucursal_id = ?
       AND agotado = 0
       AND stock_restante > 0
     ORDER BY fecha_ingreso ASC, id ASC
     FOR UPDATE`,
    [productoId, sucursalId]
  );

  const lotesData = (lotes as LoteRow[]).map((l) => ({
    id: Number(l.id),
    stock_restante: Number(l.stock_restante),
  }));

  const disp = lotesData.reduce((s, l) => s + l.stock_restante, 0);
  if (disp < cantidad) {
    return { ok: false, message: `No hay lotes con stock suficiente para el producto #${productoId} (FIFO).` };
  }

  let rest = cantidad;
  for (const lot of lotesData) {
    if (rest <= 0) break;
    const take = Math.min(rest, lot.stock_restante);
    if (take <= 0) continue;

    const [cur] = await conn.execute<RowDataPacket[]>(
      `SELECT stock_restante FROM lotes WHERE id = ? FOR UPDATE`,
      [lot.id]
    );
    const curStock = Number((cur[0] as { stock_restante?: number } | undefined)?.stock_restante ?? 0);
    if (curStock < take) {
      return { ok: false, message: "El stock del lote cambió durante la operación. Intentá de nuevo." };
    }
    const nuevo = curStock - take;
    await conn.execute(`UPDATE lotes SET stock_restante = ?, agotado = ? WHERE id = ?`, [
      nuevo,
      nuevo <= 0 ? 1 : 0,
      lot.id,
    ]);
    rest -= take;
  }

  if (rest > 0) {
    return { ok: false, message: `No se pudo completar la baja FIFO para el producto #${productoId}.` };
  }
  return { ok: true };
}

export async function registrarBajaInventario(
  input: RegistrarBajaInventarioInput
): Promise<RegistrarBajaInventarioResult> {
  const sid = Number(input.sucursalId);
  if (!Number.isFinite(sid) || sid < 1) {
    return { ok: false, message: "Sucursal inválida." };
  }
  if (!Array.isArray(input.lineas) || input.lineas.length === 0) {
    return { ok: false, message: "Agregá al menos un producto." };
  }

  const suc = await getSucursal(sid);
  if (!suc || suc.estado !== "activo") {
    return { ok: false, message: "Sucursal inválida o inactiva." };
  }

  const agregadas = new Map<number, number>();
  for (const line of input.lineas) {
    const pid = Math.trunc(Number(line.productoId));
    const cant = Math.trunc(Number(line.cantidad));
    if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(cant) || cant < 1) {
      return { ok: false, message: "Línea de baja inválida." };
    }
    agregadas.set(pid, (agregadas.get(pid) ?? 0) + cant);
  }

  const referenciaId = Math.trunc(Date.now() / 1000);
  const notaBase = input.nota?.trim() || "Baja de inventario";
  const notaCompleta = `${notaBase} · ref ${referenciaId}`;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const [productoId, cantidad] of agregadas) {
      const p = await getProducto(productoId);
      if (!p || p.estado !== "activo") {
        await conn.rollback();
        return { ok: false, message: `Producto #${productoId} no existe o está inactivo.` };
      }

      const [invRows] = await conn.execute<RowDataPacket[]>(
        `SELECT stock FROM inventario WHERE producto_id = ? AND sucursal_id = ? FOR UPDATE`,
        [productoId, sid]
      );
      const stockInv = Number((invRows[0] as { stock?: number } | undefined)?.stock ?? 0);
      if (stockInv < cantidad) {
        await conn.rollback();
        return { ok: false, message: `Stock insuficiente para ${p.codigo} (disponible: ${stockInv}).` };
      }

      const lotOk = await consumirLotesBajaFifo(conn, productoId, sid, cantidad);
      if (!lotOk.ok) {
        await conn.rollback();
        return lotOk;
      }

      await conn.execute(
        `INSERT INTO inventario (producto_id, sucursal_id, stock, actualizado_en)
         VALUES (?, ?, 0, NOW())
         ON DUPLICATE KEY UPDATE actualizado_en = NOW()`,
        [productoId, sid]
      );
      await conn.execute(
        `UPDATE inventario SET stock = stock - ?, actualizado_en = NOW()
         WHERE producto_id = ? AND sucursal_id = ?`,
        [cantidad, productoId, sid]
      );

      await conn.execute(
        `INSERT INTO movimientos_inventario (
           producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
         ) VALUES (?, ?, 'salida', ?, 'baja', ?, ?, ?, NOW())`,
        [productoId, sid, cantidad, referenciaId, input.usuarioId, notaCompleta]
      );
    }

    await conn.commit();
    return { ok: true, referenciaId };
  } catch (e) {
    await conn.rollback();
    console.error("registrarBajaInventario", e);
    return { ok: false, message: "No se pudo registrar la baja (error de base de datos)." };
  } finally {
    conn.release();
  }
}
