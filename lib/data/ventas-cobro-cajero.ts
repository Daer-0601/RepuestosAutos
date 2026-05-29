import "server-only";

import { pool } from "@/lib/db";
import { formatDateTimeMysqlBolivia } from "@/lib/fecha-bolivia";
import type { TipoPagoVenta } from "@/lib/data/ventas-vendedor";
import type { RowDataPacket } from "mysql2";

let ventasCobroColumnsReady = false;

async function ensureVentasCobroCajaColumns(): Promise<void> {
  if (ventasCobroColumnsReady) return;
  const alters = [
    `ALTER TABLE ventas ADD COLUMN cajero_destino_usuario_id INT UNSIGNED NULL AFTER usuario_id`,
    `ALTER TABLE ventas ADD COLUMN cajero_cobro_usuario_id INT UNSIGNED NULL AFTER cajero_destino_usuario_id`,
    `ALTER TABLE ventas ADD COLUMN fecha_cobro DATETIME NULL AFTER fecha`,
  ];
  for (const sql of alters) {
    try {
      await pool.execute(sql);
    } catch (err: unknown) {
      const e = err as { errno?: number };
      if (e.errno !== 1060) throw err;
    }
  }
  ventasCobroColumnsReady = true;
}

export async function assertCajeroDestinoValido(
  sucursalId: number,
  cajeroUsuarioId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!Number.isFinite(cajeroUsuarioId) || cajeroUsuarioId < 1) {
    return { ok: false, message: "Elegí un cajero de tu sucursal." };
  }
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id FROM usuarios
     WHERE id = ? AND rol_id = 2 AND sucursal_id = ? AND activo = 1
     LIMIT 1`,
    [Math.trunc(cajeroUsuarioId), sucursalId]
  );
  if (rows.length === 0) {
    return { ok: false, message: "El cajero elegido no es válido o no pertenece a tu sucursal." };
  }
  return { ok: true };
}

export type VentaPendienteCobroRow = {
  id: number;
  fecha: string;
  totalBs: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  vendedorNombre: string;
  vendedorUsername: string;
  cantidadItems: number;
};

export async function listVentasPendientesCobroCajero(
  sucursalId: number,
  cajeroUsuarioId: number,
  opts?: { fechaDesde?: string | null; fechaHasta?: string | null }
): Promise<VentaPendienteCobroRow[]> {
  await ensureVentasCobroCajaColumns();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  if (!Number.isFinite(cajeroUsuarioId) || cajeroUsuarioId < 1) return [];

  const params: (string | number)[] = [sucursalId, Math.trunc(cajeroUsuarioId)];
  let dateClause = "";
  const d1 = opts?.fechaDesde?.trim();
  const d2 = opts?.fechaHasta?.trim();
  if (d1 && /^\d{4}-\d{2}-\d{2}$/.test(d1) && d2 && /^\d{4}-\d{2}-\d{2}$/.test(d2)) {
    dateClause = "AND DATE(v.fecha) >= ? AND DATE(v.fecha) <= ?";
    params.push(d1, d2);
  } else if (d1 && /^\d{4}-\d{2}-\d{2}$/.test(d1)) {
    dateClause = "AND DATE(v.fecha) = ?";
    params.push(d1);
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT v.id, v.fecha, v.total_bs,
            COALESCE(NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(v.cliente_nombre_libre), '')) AS cliente_nombre,
            NULLIF(TRIM(v.cliente_nit), '') AS cliente_nit,
            u.nombre_completo AS vendedor_nombre,
            u.username AS vendedor_username,
            (SELECT COUNT(*) FROM venta_detalle d WHERE d.venta_id = v.id) AS n_items
     FROM ventas v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.sucursal_id = ?
       AND v.estado = 'confirmada'
       AND v.estado_cobro = 'pendiente'
       AND v.cajero_destino_usuario_id = ?
       ${dateClause}
     ORDER BY v.fecha ASC, v.id ASC`,
    params
  );

  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    fecha: r.fecha instanceof Date ? formatDateTimeMysqlBolivia(r.fecha) : String(r.fecha ?? ""),
    totalBs: Number(r.total_bs ?? 0),
    clienteNombre: r.cliente_nombre != null && String(r.cliente_nombre).trim() !== "" ? String(r.cliente_nombre) : null,
    clienteNit: r.cliente_nit != null && String(r.cliente_nit).trim() !== "" ? String(r.cliente_nit) : null,
    vendedorNombre: String(r.vendedor_nombre ?? "").trim() || String(r.vendedor_username ?? ""),
    vendedorUsername: String(r.vendedor_username ?? ""),
    cantidadItems: Number(r.n_items ?? 0),
  }));
}

export type VentaDetalleCobroLinea = {
  productoId: number;
  codigo: string;
  nombre: string;
  medida: string | null;
  cantidad: number;
  precioUnitarioBs: number;
  totalLineaBs: number;
};

export type VentaDetalleCobro = {
  id: number;
  fecha: string;
  totalBs: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  vendedorNombre: string;
  lineas: VentaDetalleCobroLinea[];
};

export async function getVentaPendienteCobroDetalle(
  ventaId: number,
  sucursalId: number,
  cajeroUsuarioId: number
): Promise<VentaDetalleCobro | null> {
  await ensureVentasCobroCajaColumns();
  if (!Number.isFinite(ventaId) || ventaId < 1) return null;

  const [vrows] = await pool.execute<RowDataPacket[]>(
    `SELECT v.id, v.fecha, v.total_bs,
            COALESCE(NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(v.cliente_nombre_libre), '')) AS cliente_nombre,
            NULLIF(TRIM(v.cliente_nit), '') AS cliente_nit,
            u.nombre_completo AS vendedor_nombre
     FROM ventas v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.id = ?
       AND v.sucursal_id = ?
       AND v.estado = 'confirmada'
       AND v.estado_cobro = 'pendiente'
       AND v.cajero_destino_usuario_id = ?
     LIMIT 1`,
    [ventaId, sucursalId, Math.trunc(cajeroUsuarioId)]
  );
  const v = vrows[0] as RowDataPacket | undefined;
  if (!v) return null;

  const [lrows] = await pool.execute<RowDataPacket[]>(
    `SELECT d.producto_id, d.cantidad, d.precio_unitario_bs, d.total_linea_bs,
            COALESCE(NULLIF(TRIM(p.codigo), ''), '—') AS codigo,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS nombre,
            NULLIF(TRIM(p.medida), '') AS medida
     FROM venta_detalle d
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE d.venta_id = ?
     ORDER BY d.id ASC`,
    [ventaId]
  );

  return {
    id: Number(v.id),
    fecha: v.fecha instanceof Date ? formatDateTimeMysqlBolivia(v.fecha) : String(v.fecha ?? ""),
    totalBs: Number(v.total_bs ?? 0),
    clienteNombre: v.cliente_nombre != null && String(v.cliente_nombre).trim() !== "" ? String(v.cliente_nombre) : null,
    clienteNit: v.cliente_nit != null && String(v.cliente_nit).trim() !== "" ? String(v.cliente_nit) : null,
    vendedorNombre: String(v.vendedor_nombre ?? "").trim() || "—",
    lineas: (lrows as RowDataPacket[]).map((r) => ({
      productoId: Number(r.producto_id),
      codigo: String(r.codigo ?? "—"),
      nombre: String(r.nombre ?? "—"),
      medida: r.medida != null && String(r.medida).trim() !== "" ? String(r.medida) : null,
      cantidad: Number(r.cantidad ?? 0),
      precioUnitarioBs: Number(r.precio_unitario_bs ?? 0),
      totalLineaBs: Number(r.total_linea_bs ?? 0),
    })),
  };
}

const TIPOS_PAGO_CAJA: TipoPagoVenta[] = ["efectivo", "qr", "tarjeta"];

export function isTipoPagoCaja(s: string): s is TipoPagoVenta {
  return (TIPOS_PAGO_CAJA as string[]).includes(s);
}

export type RegistrarCobroVentaResult =
  | { ok: true; ventaId: number }
  | { ok: false; message: string };

export async function registrarCobroVentaCajero(input: {
  ventaId: number;
  sucursalId: number;
  cajeroUsuarioId: number;
  tipoPago: TipoPagoVenta;
}): Promise<RegistrarCobroVentaResult> {
  await ensureVentasCobroCajaColumns();
  if (!isTipoPagoCaja(input.tipoPago)) {
    return { ok: false, message: "Forma de pago inválida." };
  }

  const fechaCobro = formatDateTimeMysqlBolivia(new Date());
  const [res] = await pool.execute<import("mysql2").ResultSetHeader>(
    `UPDATE ventas
     SET tipo_pago = ?, estado_cobro = 'cobrado',
         cajero_cobro_usuario_id = ?, fecha_cobro = ?
     WHERE id = ?
       AND sucursal_id = ?
       AND estado = 'confirmada'
       AND estado_cobro = 'pendiente'
       AND cajero_destino_usuario_id = ?`,
    [
      input.tipoPago,
      Math.trunc(input.cajeroUsuarioId),
      fechaCobro,
      Math.trunc(input.ventaId),
      input.sucursalId,
      Math.trunc(input.cajeroUsuarioId),
    ]
  );

  if (res.affectedRows !== 1) {
    return { ok: false, message: "La venta no está pendiente de cobro o no te corresponde." };
  }
  return { ok: true, ventaId: input.ventaId };
}

export { ensureVentasCobroCajaColumns };
