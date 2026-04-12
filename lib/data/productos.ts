import "server-only";

import { pool } from "@/lib/db";
import { sqlInt } from "@/lib/data/sql-utils";
import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type ProductoListRow = {
  id: number;
  codigo: string;
  nombre: string;
  estado: "activo" | "inactivo";
  precio_venta_lista_bs: string | null;
  marca_auto: string | null;
};

export async function listProductos(limit = 300): Promise<ProductoListRow[]> {
  const lim = sqlInt(limit, 2000);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, codigo, nombre, estado, precio_venta_lista_bs, marca_auto
     FROM productos
     ORDER BY id DESC
     LIMIT ${lim}`
  );
  return rows as ProductoListRow[];
}

export type ProductoBusquedaIngresoRow = {
  id: number;
  codigo: string;
  codigo_pieza: string | null;
  nombre: string;
  qr_payload: string;
  medida: string | null;
  especificacion: string | null;
  descripcion: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  porcentaje_utilidad: string | null;
  punto_tope: string | null;
};

export type ModoBusquedaProductoIngreso = "barra" | "pieza";

/**
 * - barra: solo código de barra / interno y nombre (no mezcla con código pieza).
 * - pieza: solo codigo_pieza OEM/referencia.
 */
export async function searchProductosParaIngreso(
  query: string,
  modo: ModoBusquedaProductoIngreso,
  limit = 40
): Promise<ProductoBusquedaIngresoRow[]> {
  const q = query.trim().slice(0, 120).replace(/%/g, "");
  if (q.length < 1) {
    return [];
  }
  const lim = sqlInt(limit, 100);
  const like = `%${q}%`;

  if (modo === "pieza") {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, codigo, codigo_pieza, nombre, qr_payload, medida, especificacion, descripcion,
              precio_venta_lista_bs, precio_venta_lista_usd, porcentaje_utilidad, punto_tope
       FROM productos
       WHERE estado = 'activo'
         AND codigo_pieza IS NOT NULL
         AND TRIM(codigo_pieza) <> ''
         AND codigo_pieza LIKE ?
       ORDER BY (codigo_pieza = ?) DESC, LENGTH(codigo_pieza) ASC, codigo ASC
       LIMIT ${lim}`,
      [like, q]
    );
    return rows as ProductoBusquedaIngresoRow[];
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, codigo, codigo_pieza, nombre, qr_payload, medida, especificacion, descripcion,
            precio_venta_lista_bs, precio_venta_lista_usd, porcentaje_utilidad, punto_tope
     FROM productos
     WHERE estado = 'activo'
       AND (codigo LIKE ? OR nombre LIKE ?)
     ORDER BY (codigo = ?) DESC, LENGTH(codigo) ASC, nombre ASC, codigo ASC
     LIMIT ${lim}`,
    [like, like, q]
  );
  return rows as ProductoBusquedaIngresoRow[];
}

export type ProductoFullRow = {
  id: number;
  codigo: string;
  qr_payload: string;
  codigo_pieza: string | null;
  nombre: string;
  especificacion: string | null;
  repuesto: string | null;
  procedencia: string | null;
  medida: string | null;
  descripcion: string | null;
  unidad: string | null;
  marca_auto: string | null;
  precio_venta_lista_bs: string | null;
  precio_venta_lista_usd: string | null;
  porcentaje_utilidad: string | null;
  punto_tope: string | null;
  estado: "activo" | "inactivo";
};

export async function getProducto(id: number): Promise<ProductoFullRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, codigo, qr_payload, codigo_pieza, nombre, especificacion, repuesto, procedencia,
            medida, descripcion, unidad, marca_auto, precio_venta_lista_bs, precio_venta_lista_usd,
            porcentaje_utilidad, punto_tope, estado
     FROM productos WHERE id = ? LIMIT 1`,
    [id]
  );
  const r = rows[0] as ProductoFullRow | undefined;
  return r ?? null;
}

export async function countProductoCodigo(codigo: string, excludeId?: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    excludeId
      ? `SELECT COUNT(*) AS c FROM productos WHERE codigo = ? AND id <> ?`
      : `SELECT COUNT(*) AS c FROM productos WHERE codigo = ?`,
    excludeId ? [codigo, excludeId] : [codigo]
  );
  return Number((rows[0] as { c: number }).c);
}

export async function countProductoQrPayload(
  qr_payload: string,
  excludeId?: number
): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    excludeId
      ? `SELECT COUNT(*) AS c FROM productos WHERE qr_payload = ? AND id <> ?`
      : `SELECT COUNT(*) AS c FROM productos WHERE qr_payload = ?`,
    excludeId ? [qr_payload, excludeId] : [qr_payload]
  );
  return Number((rows[0] as { c: number }).c);
}

export type ProductoInsertInput = {
  codigo: string;
  qr_payload: string;
  codigo_pieza: string | null;
  nombre: string;
  especificacion: string | null;
  repuesto: string | null;
  procedencia: string | null;
  medida: string | null;
  descripcion: string | null;
  unidad: string | null;
  marca_auto: string | null;
  precio_venta_lista_bs: number | null;
  precio_venta_lista_usd: number | null;
  porcentaje_utilidad: number | null;
  punto_tope: number | null;
  estado: "activo" | "inactivo";
};

const LOCK_NEXT_PRODUCTO_CODIGO = "repuestos_next_producto_codigo_seq";

export async function insertProductoWithConnection(
  conn: PoolConnection,
  input: ProductoInsertInput
): Promise<number> {
  const [res] = await conn.execute<ResultSetHeader>(
    `INSERT INTO productos (
      codigo, qr_payload, codigo_pieza, nombre, especificacion, repuesto, procedencia, medida,
      descripcion, unidad, marca_auto, precio_venta_lista_bs, precio_venta_lista_usd,
      porcentaje_utilidad, punto_tope, estado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.codigo,
      input.qr_payload,
      input.codigo_pieza,
      input.nombre,
      input.especificacion,
      input.repuesto,
      input.procedencia,
      input.medida,
      input.descripcion,
      input.unidad,
      input.marca_auto,
      input.precio_venta_lista_bs,
      input.precio_venta_lista_usd,
      input.porcentaje_utilidad,
      input.punto_tope,
      input.estado,
    ]
  );
  return res.insertId;
}

/**
 * Asigna código y QR en secuencia (siguiente id previsto, 6 dígitos) bajo bloqueo de sesión MySQL.
 */
export async function insertProductoConCodigoSecuencial(
  input: Omit<ProductoInsertInput, "codigo" | "qr_payload">
): Promise<{ id: number; codigo: string; qr_payload: string }> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [lockRows] = await conn.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?, 20) AS l",
      [LOCK_NEXT_PRODUCTO_CODIGO]
    );
    if (Number((lockRows[0] as { l: number }).l) !== 1) {
      await conn.rollback();
      throw new Error("No se pudo reservar el código de producto (lock).");
    }
    try {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT COALESCE(
           (SELECT t.AUTO_INCREMENT FROM information_schema.TABLES t
            WHERE t.TABLE_SCHEMA = DATABASE() AND t.TABLE_NAME = 'productos' LIMIT 1),
           (SELECT COALESCE(MAX(p.id), 0) + 1 FROM productos p)
         ) AS n`
      );
      const n = Number((rows[0] as { n: number | bigint | null }).n);
      const codigo = String(n).padStart(6, "0");
      const qr_payload = codigo;
      const id = await insertProductoWithConnection(conn, {
        ...input,
        codigo,
        qr_payload,
      });
      await conn.commit();
      return { id, codigo, qr_payload };
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [LOCK_NEXT_PRODUCTO_CODIGO]);
    }
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function insertProducto(input: ProductoInsertInput): Promise<number> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = await insertProductoWithConnection(conn, input);
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export type ProductoUpdateInput = {
  codigo: string;
  qr_payload: string;
  codigo_pieza: string | null;
  nombre: string;
  especificacion: string | null;
  repuesto: string | null;
  procedencia: string | null;
  medida: string | null;
  descripcion: string | null;
  unidad: string | null;
  marca_auto: string | null;
  precio_venta_lista_bs: number | null;
  precio_venta_lista_usd: number | null;
  porcentaje_utilidad: number | null;
  punto_tope: number | null;
  estado: "activo" | "inactivo";
};

export async function updateProducto(id: number, input: ProductoUpdateInput): Promise<void> {
  await pool.execute(
    `UPDATE productos SET
      codigo = ?, qr_payload = ?, codigo_pieza = ?, nombre = ?, especificacion = ?, repuesto = ?,
      procedencia = ?, medida = ?, descripcion = ?, unidad = ?, marca_auto = ?,
      precio_venta_lista_bs = ?, precio_venta_lista_usd = ?, porcentaje_utilidad = ?, punto_tope = ?, estado = ?
     WHERE id = ?`,
    [
      input.codigo,
      input.qr_payload,
      input.codigo_pieza,
      input.nombre,
      input.especificacion,
      input.repuesto,
      input.procedencia,
      input.medida,
      input.descripcion,
      input.unidad,
      input.marca_auto,
      input.precio_venta_lista_bs,
      input.precio_venta_lista_usd,
      input.porcentaje_utilidad,
      input.punto_tope,
      input.estado,
      id,
    ]
  );
}

export async function updateProductoWithConnection(
  conn: PoolConnection,
  id: number,
  input: ProductoUpdateInput
): Promise<void> {
  await conn.execute(
    `UPDATE productos SET
      codigo = ?, qr_payload = ?, codigo_pieza = ?, nombre = ?, especificacion = ?, repuesto = ?,
      procedencia = ?, medida = ?, descripcion = ?, unidad = ?, marca_auto = ?,
      precio_venta_lista_bs = ?, precio_venta_lista_usd = ?, porcentaje_utilidad = ?, punto_tope = ?, estado = ?
     WHERE id = ?`,
    [
      input.codigo,
      input.qr_payload,
      input.codigo_pieza,
      input.nombre,
      input.especificacion,
      input.repuesto,
      input.procedencia,
      input.medida,
      input.descripcion,
      input.unidad,
      input.marca_auto,
      input.precio_venta_lista_bs,
      input.precio_venta_lista_usd,
      input.porcentaje_utilidad,
      input.punto_tope,
      input.estado,
      id,
    ]
  );
}

export async function listProductoImagenes(productoId: number): Promise<string[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT url_imagen FROM producto_imagenes WHERE producto_id = ? ORDER BY orden ASC, id ASC`,
    [productoId]
  );
  return (rows as { url_imagen: string }[]).map((r) => r.url_imagen);
}

export async function replaceProductoImagenes(
  productoId: number,
  urls: string[]
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await replaceProductoImagenesWithConnection(conn, productoId, urls);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function replaceProductoImagenesWithConnection(
  conn: PoolConnection,
  productoId: number,
  urls: string[]
): Promise<void> {
  await conn.execute(`DELETE FROM producto_imagenes WHERE producto_id = ?`, [productoId]);
  let orden = 0;
  for (const url of urls) {
    const u = url.trim();
    if (!u) continue;
    await conn.execute(
      `INSERT INTO producto_imagenes (producto_id, url_imagen, orden) VALUES (?, ?, ?)`,
      [productoId, u, orden]
    );
    orden += 1;
  }
}
