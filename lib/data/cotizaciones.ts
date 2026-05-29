import "server-only";

import { pool } from "@/lib/db";
import { ensureCotizacionCajaColumns } from "@/lib/data/cotizaciones-cajero";
import { getProducto } from "@/lib/data/productos";
import { sqlInt } from "@/lib/data/sql-utils";
import { rangoPrecioListaTopeBs } from "@/lib/venta-precio-lista-tope-range";
import type { PoolConnection } from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

/*
  MySQL (una sola vez):

  CREATE TABLE cotizaciones (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    cliente_nombre VARCHAR(255) NULL,
    cliente_nit VARCHAR(64) NULL,
    notas TEXT NULL,
    tipo_cambio_id INT NOT NULL,
    tipo_cambio_snapshot DECIMAL(18,6) NOT NULL,
    total_bs DECIMAL(18,2) NOT NULL,
    total_usd DECIMAL(18,6) NOT NULL,
    estado VARCHAR(24) NOT NULL DEFAULT 'abierta',
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cotizaciones_fecha (fecha),
    KEY idx_cotizaciones_usuario (usuario_id),
    CONSTRAINT fk_cotizaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

  CREATE TABLE cotizacion_detalle (
    id INT NOT NULL AUTO_INCREMENT,
    cotizacion_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario_bs DECIMAL(18,4) NOT NULL,
    precio_unitario_usd DECIMAL(18,6) NOT NULL,
    total_linea_bs DECIMAL(18,2) NOT NULL,
    total_linea_usd DECIMAL(18,6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_cotizacion_detalle_cot (cotizacion_id),
    KEY idx_cotizacion_detalle_prod (producto_id),
    CONSTRAINT fk_cot_det_cot FOREIGN KEY (cotizacion_id) REFERENCES cotizaciones (id) ON DELETE CASCADE,
    CONSTRAINT fk_cot_det_prod FOREIGN KEY (producto_id) REFERENCES productos (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
*/

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function strNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type CotizacionLineaInput = {
  productoId: number;
  cantidad: number;
  precioUnitarioBs: number;
};

export type CrearCotizacionInput = {
  usuarioId: number;
  cajeroDestinoUsuarioId: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  notas: string | null;
  tipoCambioId: number;
  tipoCambioSnapshot: number;
  lineas: CotizacionLineaInput[];
};

export type CrearCotizacionResult =
  | { ok: true; cotizacionId: number }
  | { ok: false; message: string };

export type CotizacionListadoRow = {
  id: number;
  fecha: string;
  total_bs: string;
  total_usd: string;
  cliente_nombre: string | null;
  lineas: number;
};

export async function listCotizacionesPorSucursal(sucursalId: number, limit = 50): Promise<CotizacionListadoRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  await ensureCotizacionCajaColumns();
  const lim = sqlInt(limit, 200);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.id, c.fecha, c.total_bs, c.total_usd, c.cliente_nombre,
            (SELECT COUNT(*) FROM cotizacion_detalle d WHERE d.cotizacion_id = c.id) AS lineas
     FROM cotizaciones c
     INNER JOIN usuarios u ON u.id = c.usuario_id
     WHERE u.sucursal_id = ?
     ORDER BY c.id DESC
     LIMIT ${lim}`,
    [sucursalId]
  );
  return rows as CotizacionListadoRow[];
}

export async function crearCotizacionAdmin(input: CrearCotizacionInput): Promise<CrearCotizacionResult> {
  const tc = input.tipoCambioSnapshot;
  if (!Number.isFinite(tc) || tc <= 0) {
    return { ok: false, message: "Tipo de cambio inválido." };
  }
  if (!input.lineas.length) {
    return { ok: false, message: "Agregá al menos una línea a la cotización." };
  }

  const seen = new Set<number>();
  const preparadas: {
    productoId: number;
    cantidad: number;
    precioUnitBs: number;
    precioUnitUsd: number;
    totalLineaBs: number;
    totalLineaUsd: number;
  }[] = [];

  for (const ln of input.lineas) {
    const pid = Math.trunc(Number(ln.productoId));
    const cant = Math.trunc(Number(ln.cantidad));
    if (!Number.isFinite(pid) || pid < 1) {
      return { ok: false, message: "Ítem con producto inválido." };
    }
    if (!Number.isFinite(cant) || cant < 1) {
      return { ok: false, message: "La cantidad debe ser al menos 1 en cada línea." };
    }
    if (seen.has(pid)) {
      return { ok: false, message: "El mismo producto aparece más de una vez. Unificá en una sola línea." };
    }
    seen.add(pid);

    const p = await getProducto(pid);
    if (!p || p.estado !== "activo") {
      return { ok: false, message: `Producto #${pid} no existe o no está activo.` };
    }

    const precioBs = round2(Number(ln.precioUnitarioBs));
    if (!Number.isFinite(precioBs) || precioBs <= 0) {
      return { ok: false, message: `Precio inválido para ${p.codigo}.` };
    }

    const listaPrecio = strNum(p.precio_venta_lista_bs);
    const tope = strNum(p.punto_tope);
    const rango = rangoPrecioListaTopeBs(listaPrecio, tope);
    if (rango) {
      if (precioBs < rango.lo || precioBs > rango.hi) {
        return {
          ok: false,
          message: `El precio de ${p.codigo} debe estar entre ${rango.lo.toFixed(2)} y ${rango.hi.toFixed(2)} Bs (lista y tope).`,
        };
      }
    } else if (tope !== null && precioBs > tope) {
      return { ok: false, message: `El precio de ${p.codigo} supera el tope (${tope.toFixed(2)} Bs).` };
    }

    const precioUsd = round4(precioBs / tc);
    const totalLineaBs = round2(cant * precioBs);
    const totalLineaUsd = round4(cant * precioUsd);

    preparadas.push({
      productoId: pid,
      cantidad: cant,
      precioUnitBs: precioBs,
      precioUnitUsd: precioUsd,
      totalLineaBs,
      totalLineaUsd,
    });
  }

  let totalBs = 0;
  let totalUsd = 0;
  for (const pl of preparadas) {
    totalBs = round2(totalBs + pl.totalLineaBs);
    totalUsd = round4(totalUsd + pl.totalLineaUsd);
  }

  await ensureCotizacionCajaColumns();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const resInsert = await insertCotizacionHeader(conn, {
      usuarioId: input.usuarioId,
      cajeroDestinoUsuarioId: input.cajeroDestinoUsuarioId,
      clienteNombre: input.clienteNombre?.trim() || null,
      clienteNit: input.clienteNit?.trim() || null,
      notas: input.notas?.trim() || null,
      tipoCambioId: input.tipoCambioId,
      tipoCambioSnapshot: tc,
      totalBs,
      totalUsd,
    });
    if (!resInsert.ok) {
      await conn.rollback();
      return resInsert;
    }
    const cotizacionId = resInsert.cotizacionId;

    for (const pl of preparadas) {
      await conn.execute(
        `INSERT INTO cotizacion_detalle (
          cotizacion_id, producto_id, cantidad,
          precio_unitario_bs, precio_unitario_usd, total_linea_bs, total_linea_usd
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cotizacionId,
          pl.productoId,
          pl.cantidad,
          pl.precioUnitBs,
          pl.precioUnitUsd,
          pl.totalLineaBs,
          pl.totalLineaUsd,
        ]
      );
    }

    await conn.commit();
    return { ok: true, cotizacionId };
  } catch (e) {
    await conn.rollback();
    console.error("crearCotizacionAdmin", e);
    return {
      ok: false,
      message: "Error al guardar la cotización. ¿Ejecutaste el SQL de tablas `cotizaciones` / `cotizacion_detalle`?",
    };
  } finally {
    conn.release();
  }
}

async function insertCotizacionHeader(
  conn: PoolConnection,
  input: {
    usuarioId: number;
    cajeroDestinoUsuarioId: number;
    clienteNombre: string | null;
    clienteNit: string | null;
    notas: string | null;
    tipoCambioId: number;
    tipoCambioSnapshot: number;
    totalBs: number;
    totalUsd: number;
  }
): Promise<{ ok: true; cotizacionId: number } | { ok: false; message: string }> {
  try {
    const [res] = await conn.execute<ResultSetHeader>(
      `INSERT INTO cotizaciones (
        usuario_id, cajero_destino_usuario_id, cliente_nombre, cliente_nit, notas,
        tipo_cambio_id, tipo_cambio_snapshot, total_bs, total_usd, estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        input.usuarioId,
        input.cajeroDestinoUsuarioId,
        input.clienteNombre,
        input.clienteNit,
        input.notas,
        input.tipoCambioId,
        input.tipoCambioSnapshot,
        input.totalBs,
        input.totalUsd,
      ]
    );
    return { ok: true, cotizacionId: res.insertId };
  } catch (e) {
    console.error("insertCotizacionHeader", e);
    return { ok: false, message: "No se pudo insertar el encabezado de cotización." };
  }
}
