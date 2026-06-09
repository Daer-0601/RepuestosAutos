import "server-only";

import { condicionCodigoQrExacta } from "@/lib/data/producto-codigo-busqueda-exacta";
import { formatDateTimeMysqlBolivia } from "@/lib/fecha-bolivia";
import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

export type ProductoResueltoCaja = {
  id: number;
  codigo: string;
  nombre: string;
};

export async function resolverProductoActivoPorCodigo(
  executor: PoolConnection | { execute: PoolConnection["execute"] },
  rawCodigo: string
): Promise<ProductoResueltoCaja | null> {
  const frag = condicionCodigoQrExacta(rawCodigo, "p");
  if (!frag) return null;

  const [rows] = await executor.execute<RowDataPacket[]>(
    `SELECT p.id, p.codigo, p.nombre
     FROM productos p
     WHERE p.estado = 'activo' AND (${frag.sql})
     LIMIT 2`,
    [...frag.params]
  );
  if (rows.length !== 1) return null;
  const r = rows[0] as RowDataPacket;
  return {
    id: Number(r.id),
    codigo: String(r.codigo ?? "").trim(),
    nombre: String(r.nombre ?? "").trim(),
  };
}

async function ultimoCostoUnitario(
  conn: PoolConnection,
  productoId: number,
  sucursalId: number
): Promise<{ costoUnitBs: number; costoUnitUsd: number }> {
  const [ventaRows] = await conn.execute<RowDataPacket[]>(
    `SELECT d.costo_unitario_bs, d.costo_unitario_usd
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     WHERE d.producto_id = ? AND v.sucursal_id = ? AND v.estado = 'confirmada'
     ORDER BY v.fecha DESC, d.id DESC
     LIMIT 1`,
    [productoId, sucursalId]
  );
  const vr = ventaRows[0] as RowDataPacket | undefined;
  if (vr) {
    const bs = Number(vr.costo_unitario_bs ?? 0);
    const usd = Number(vr.costo_unitario_usd ?? 0);
    if (Number.isFinite(bs) && bs > 0) {
      return { costoUnitBs: round2(bs), costoUnitUsd: round4(usd) };
    }
  }

  const [loteRows] = await conn.execute<RowDataPacket[]>(
    `SELECT costo_unitario_bs, costo_unitario_usd
     FROM lotes
     WHERE producto_id = ? AND sucursal_id = ?
     ORDER BY fecha_ingreso DESC, id DESC
     LIMIT 1`,
    [productoId, sucursalId]
  );
  const lr = loteRows[0] as RowDataPacket | undefined;
  if (lr) {
    return {
      costoUnitBs: round2(Number(lr.costo_unitario_bs ?? 0)),
      costoUnitUsd: round4(Number(lr.costo_unitario_usd ?? 0)),
    };
  }

  return { costoUnitBs: 0, costoUnitUsd: 0 };
}

export async function verificarStockDisponible(
  conn: PoolConnection,
  productoId: number,
  sucursalId: number,
  cantidad: number,
  etiqueta: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cant = Math.max(1, Math.trunc(cantidad));

  const [invRows] = await conn.execute<RowDataPacket[]>(
    `SELECT stock FROM inventario WHERE producto_id = ? AND sucursal_id = ? FOR UPDATE`,
    [productoId, sucursalId]
  );
  const stockInv = Number((invRows[0] as { stock?: number } | undefined)?.stock ?? 0);
  if (stockInv < cant) {
    return { ok: false, message: `Stock insuficiente para ${etiqueta} (disponible: ${stockInv}).` };
  }

  const [lotes] = await conn.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(stock_restante), 0) AS disp
     FROM lotes
     WHERE producto_id = ?
       AND sucursal_id = ?
       AND agotado = 0
       AND stock_restante > 0
     FOR UPDATE`,
    [productoId, sucursalId]
  );
  const disp = Number((lotes[0] as { disp?: number } | undefined)?.disp ?? 0);
  if (disp < cant) {
    return { ok: false, message: `No hay lotes con stock suficiente para ${etiqueta}.` };
  }

  return { ok: true };
}

export async function ingresarStockCaja(
  conn: PoolConnection,
  input: {
    productoId: number;
    sucursalId: number;
    cantidad: number;
    referenciaTipo: string;
    referenciaId: number;
    usuarioId: number;
    nota: string;
    fecha?: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cant = Math.max(1, Math.trunc(input.cantidad));
  const fecha = input.fecha ?? formatDateTimeMysqlBolivia(new Date());
  const { costoUnitBs, costoUnitUsd } = await ultimoCostoUnitario(
    conn,
    input.productoId,
    input.sucursalId
  );

  await conn.execute(
    `INSERT INTO lotes (
       producto_id, compra_detalle_id, sucursal_id,
       cantidad_inicial, stock_restante, costo_unitario_bs, costo_unitario_usd, fecha_ingreso, agotado
     ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0)`,
    [input.productoId, input.sucursalId, cant, cant, costoUnitBs, costoUnitUsd, fecha]
  );

  await conn.execute(
    `INSERT INTO inventario (producto_id, sucursal_id, stock, actualizado_en)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock), actualizado_en = VALUES(actualizado_en)`,
    [input.productoId, input.sucursalId, cant, fecha]
  );

  await conn.execute(
    `INSERT INTO movimientos_inventario (
       producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
     ) VALUES (?, ?, 'entrada', ?, ?, ?, ?, ?, ?)`,
    [
      input.productoId,
      input.sucursalId,
      cant,
      input.referenciaTipo,
      input.referenciaId,
      input.usuarioId,
      input.nota,
      fecha,
    ]
  );

  return { ok: true };
}

export async function consumirStockCaja(
  conn: PoolConnection,
  input: {
    productoId: number;
    sucursalId: number;
    cantidad: number;
    referenciaTipo: string;
    referenciaId: number;
    usuarioId: number;
    nota: string;
    fecha?: string;
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const cant = Math.max(1, Math.trunc(input.cantidad));
  const fecha = input.fecha ?? formatDateTimeMysqlBolivia(new Date());

  const chk = await verificarStockDisponible(
    conn,
    input.productoId,
    input.sucursalId,
    cant,
    `#${input.productoId}`
  );
  if (!chk.ok) return chk;

  const [lotes] = await conn.execute<RowDataPacket[]>(
    `SELECT id, stock_restante
     FROM lotes
     WHERE producto_id = ?
       AND sucursal_id = ?
       AND agotado = 0
       AND stock_restante > 0
     ORDER BY fecha_ingreso ASC, id ASC
     FOR UPDATE`,
    [input.productoId, input.sucursalId]
  );

  let rest = cant;
  for (const row of lotes as RowDataPacket[]) {
    if (rest <= 0) break;
    const loteId = Number(row.id);
    const stockRest = Number(row.stock_restante ?? 0);
    const take = Math.min(rest, stockRest);
    if (take <= 0) continue;
    const nuevo = stockRest - take;
    await conn.execute(`UPDATE lotes SET stock_restante = ?, agotado = ? WHERE id = ?`, [
      nuevo,
      nuevo <= 0 ? 1 : 0,
      loteId,
    ]);
    rest -= take;
  }

  if (rest > 0) {
    return { ok: false, message: "No se pudo consumir el stock por lotes (FIFO)." };
  }

  await conn.execute(
    `UPDATE inventario SET stock = stock - ?, actualizado_en = ?
     WHERE producto_id = ? AND sucursal_id = ?`,
    [cant, fecha, input.productoId, input.sucursalId]
  );

  await conn.execute(
    `INSERT INTO movimientos_inventario (
       producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
     ) VALUES (?, ?, 'salida', ?, ?, ?, ?, ?, ?)`,
    [
      input.productoId,
      input.sucursalId,
      cant,
      input.referenciaTipo,
      input.referenciaId,
      input.usuarioId,
      input.nota,
      fecha,
    ]
  );

  return { ok: true };
}
