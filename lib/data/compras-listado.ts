import "server-only";

import { pool } from "@/lib/db";
import { sqlInt } from "@/lib/data/sql-utils";
import type { RowDataPacket } from "mysql2";

export type CompraListadoRow = {
  id: number;
  fecha: Date;
  numeroDocumento: string | null;
  concepto: string;
  proveedorNombre: string;
  sucursalNombre: string;
  usuarioNombre: string;
  tipoPago: string;
  cantidadLineas: number;
  cantidadUnidades: number;
  totalBs: number;
  totalUsd: number;
  estado: string;
};

export type CompraDetalleHeader = {
  id: number;
  fecha: Date;
  numeroDocumento: string | null;
  observaciones: string | null;
  proveedorNombre: string;
  sucursalNombre: string;
  usuarioNombre: string;
  tipoPago: string;
  estado: string;
  tipoCambioSnapshot: number;
  precioFleteTotalBs: number;
  subtotalBs: number;
  subtotalUsd: number;
  totalBs: number;
  totalUsd: number;
};

export type CompraDetalleLineaRow = {
  id: number;
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
  precioCompraUnitBs: number;
  precioCompraUnitUsd: number;
  montoFleteBs: number;
  subtotalLineaBs: number;
  subtotalLineaUsd: number;
  totalLineaBs: number;
  totalLineaUsd: number;
};

export async function listComprasAdmin(
  opts: {
    fechaDesde: string;
    fechaHasta: string;
    sucursalId?: number | null;
    limit?: number;
  }
): Promise<CompraListadoRow[]> {
  const d1 = opts.fechaDesde.trim();
  const d2 = opts.fechaHasta.trim();
  if (!d1 || !d2) return [];

  const sucursalId =
    opts.sucursalId != null && Number.isFinite(opts.sucursalId) && opts.sucursalId > 0
      ? opts.sucursalId
      : null;
  const lim = sqlInt(opts.limit ?? 500, 5000);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.fecha, c.numero_documento, c.observaciones, c.total_bs, c.total_usd, c.estado, c.tipo_pago,
            s.nombre AS sucursal_nombre,
            pr.nombre AS proveedor_nombre,
            COALESCE(NULLIF(TRIM(u.nombre_completo), ''), u.username, '—') AS usuario_nombre,
            (SELECT COUNT(*) FROM compra_detalle cd WHERE cd.compra_id = c.id) AS cantidad_lineas,
            (SELECT COALESCE(SUM(cd.cantidad), 0) FROM compra_detalle cd WHERE cd.compra_id = c.id) AS cantidad_unidades
     FROM compras c
     INNER JOIN sucursales s ON s.id = c.sucursal_id
     INNER JOIN proveedores pr ON pr.id = c.proveedor_id
     INNER JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.estado = 'confirmada'
       AND DATE(c.fecha) >= ? AND DATE(c.fecha) <= ?
       AND (? IS NULL OR c.sucursal_id = ?)
     ORDER BY c.fecha DESC, c.id DESC
     LIMIT ${lim}`,
    [d1, d2, sucursalId, sucursalId]
  );

  return (rows as RowDataPacket[]).map((r) => {
    const obs = r.observaciones != null ? String(r.observaciones).trim() : "";
    const prov = String(r.proveedor_nombre ?? "—").trim() || "—";
    return {
      id: Number(r.id),
      fecha: r.fecha instanceof Date ? r.fecha : new Date(String(r.fecha)),
      numeroDocumento: r.numero_documento != null && String(r.numero_documento).trim() !== ""
        ? String(r.numero_documento).trim()
        : null,
      concepto: obs || prov,
      proveedorNombre: prov,
      sucursalNombre: String(r.sucursal_nombre ?? "—"),
      usuarioNombre: String(r.usuario_nombre ?? "—"),
      tipoPago: String(r.tipo_pago ?? ""),
      cantidadLineas: Number(r.cantidad_lineas ?? 0),
      cantidadUnidades: Number(r.cantidad_unidades ?? 0),
      totalBs: Number(r.total_bs ?? 0),
      totalUsd: Number(r.total_usd ?? 0),
      estado: String(r.estado ?? ""),
    };
  });
}

export async function sumTotalesComprasAdminEnRango(
  fechaDesde: string,
  fechaHasta: string,
  sucursalId?: number | null
): Promise<{ totalBs: number; totalUsd: number; cantidad: number; cantidadUnidades: number }> {
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return { totalBs: 0, totalUsd: 0, cantidad: 0, cantidadUnidades: 0 };

  const sid =
    sucursalId != null && Number.isFinite(sucursalId) && sucursalId > 0 ? sucursalId : null;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS cantidad,
            COALESCE(SUM(c.total_bs), 0) AS total_bs,
            COALESCE(SUM(c.total_usd), 0) AS total_usd,
            COALESCE((
              SELECT SUM(cd.cantidad)
              FROM compra_detalle cd
              INNER JOIN compras cx ON cx.id = cd.compra_id
              WHERE cx.estado = 'confirmada'
                AND DATE(cx.fecha) >= ? AND DATE(cx.fecha) <= ?
                AND (? IS NULL OR cx.sucursal_id = ?)
            ), 0) AS cantidad_unidades
     FROM compras c
     WHERE c.estado = 'confirmada'
       AND DATE(c.fecha) >= ? AND DATE(c.fecha) <= ?
       AND (? IS NULL OR c.sucursal_id = ?)`,
    [d1, d2, sid, sid, d1, d2, sid, sid]
  );

  const r = rows[0] as RowDataPacket;
  return {
    cantidad: Number(r.cantidad ?? 0),
    totalBs: Number(r.total_bs ?? 0),
    totalUsd: Number(r.total_usd ?? 0),
    cantidadUnidades: Number(r.cantidad_unidades ?? 0),
  };
}

export async function getCompraDetalleAdmin(compraId: number): Promise<{
  header: CompraDetalleHeader;
  lineas: CompraDetalleLineaRow[];
} | null> {
  if (!Number.isFinite(compraId) || compraId < 1) return null;

  const [headerRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.fecha, c.numero_documento, c.observaciones, c.total_bs, c.total_usd, c.estado, c.tipo_pago,
            c.tipo_cambio_snapshot, c.precio_flete_total_bs, c.subtotal_bs, c.subtotal_usd,
            s.nombre AS sucursal_nombre,
            pr.nombre AS proveedor_nombre,
            COALESCE(NULLIF(TRIM(u.nombre_completo), ''), u.username, '—') AS usuario_nombre
     FROM compras c
     INNER JOIN sucursales s ON s.id = c.sucursal_id
     INNER JOIN proveedores pr ON pr.id = c.proveedor_id
     INNER JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.id = ? AND c.estado = 'confirmada'
     LIMIT 1`,
    [compraId]
  );

  if (headerRows.length === 0) return null;
  const h = headerRows[0] as RowDataPacket;

  const [lineaRows] = await pool.query<RowDataPacket[]>(
    `SELECT cd.id, cd.producto_id, cd.cantidad,
            cd.precio_compra_unitario_bs, cd.precio_compra_unitario_usd,
            cd.monto_flete_prorrateado_bs, cd.subtotal_linea_bs, cd.subtotal_linea_usd,
            cd.total_linea_bs, cd.total_linea_usd,
            COALESCE(NULLIF(TRIM(p.codigo), ''), '—') AS codigo,
            COALESCE(NULLIF(TRIM(p.codigo_pieza), ''), '—') AS codigo_pieza,
            COALESCE(NULLIF(TRIM(p.medida), ''), '—') AS medida,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS nombre,
            NULLIF(TRIM(p.repuesto), '') AS repuesto,
            NULLIF(TRIM(p.marca_auto), '') AS marca_auto,
            NULLIF(TRIM(p.procedencia), '') AS procedencia,
            NULLIF(TRIM(p.unidad), '') AS unidad
     FROM compra_detalle cd
     INNER JOIN productos p ON p.id = cd.producto_id
     WHERE cd.compra_id = ?
     ORDER BY cd.id ASC`,
    [compraId]
  );

  return {
    header: {
      id: Number(h.id),
      fecha: h.fecha instanceof Date ? h.fecha : new Date(String(h.fecha)),
      numeroDocumento:
        h.numero_documento != null && String(h.numero_documento).trim() !== ""
          ? String(h.numero_documento).trim()
          : null,
      observaciones:
        h.observaciones != null && String(h.observaciones).trim() !== ""
          ? String(h.observaciones).trim()
          : null,
      proveedorNombre: String(h.proveedor_nombre ?? "—"),
      sucursalNombre: String(h.sucursal_nombre ?? "—"),
      usuarioNombre: String(h.usuario_nombre ?? "—"),
      tipoPago: String(h.tipo_pago ?? ""),
      estado: String(h.estado ?? ""),
      tipoCambioSnapshot: Number(h.tipo_cambio_snapshot ?? 0),
      precioFleteTotalBs: Number(h.precio_flete_total_bs ?? 0),
      subtotalBs: Number(h.subtotal_bs ?? 0),
      subtotalUsd: Number(h.subtotal_usd ?? 0),
      totalBs: Number(h.total_bs ?? 0),
      totalUsd: Number(h.total_usd ?? 0),
    },
    lineas: (lineaRows as RowDataPacket[]).map((r) => ({
      id: Number(r.id),
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
      precioCompraUnitBs: Number(r.precio_compra_unitario_bs ?? 0),
      precioCompraUnitUsd: Number(r.precio_compra_unitario_usd ?? 0),
      montoFleteBs: Number(r.monto_flete_prorrateado_bs ?? 0),
      subtotalLineaBs: Number(r.subtotal_linea_bs ?? 0),
      subtotalLineaUsd: Number(r.subtotal_linea_usd ?? 0),
      totalLineaBs: Number(r.total_linea_bs ?? 0),
      totalLineaUsd: Number(r.total_linea_usd ?? 0),
    })),
  };
}
