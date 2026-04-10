import "server-only";

import { pool } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type ProveedorRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  activo: number;
};

export async function listProveedoresActivos(): Promise<ProveedorRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, telefono, direccion, activo
     FROM proveedores
     WHERE activo = 1
     ORDER BY nombre ASC`
  );
  return rows as ProveedorRow[];
}

export async function insertProveedor(input: {
  nombre: string;
  telefono: string | null;
  direccion: string | null;
}): Promise<number> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO proveedores (nombre, telefono, direccion, activo) VALUES (?, ?, ?, 1)`,
    [input.nombre.trim(), input.telefono?.trim() || null, input.direccion?.trim() || null]
  );
  return res.insertId;
}

export async function getProveedorActivo(id: number): Promise<ProveedorRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, telefono, direccion, activo FROM proveedores WHERE id = ? AND activo = 1 LIMIT 1`,
    [id]
  );
  const r = rows[0] as ProveedorRow | undefined;
  return r ?? null;
}
