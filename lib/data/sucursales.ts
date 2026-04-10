import "server-only";

import { pool } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type SucursalRow = {
  id: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  estado: "activo" | "inactivo";
};

export async function listSucursales(): Promise<SucursalRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, direccion, telefono, estado
     FROM sucursales
     ORDER BY nombre ASC`
  );
  return rows as SucursalRow[];
}

export async function getSucursal(id: number): Promise<SucursalRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, direccion, telefono, estado FROM sucursales WHERE id = ? LIMIT 1`,
    [id]
  );
  const r = rows[0] as SucursalRow | undefined;
  return r ?? null;
}

export async function insertSucursal(input: {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  estado: "activo" | "inactivo";
}): Promise<number> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO sucursales (nombre, direccion, telefono, estado)
     VALUES (?, ?, ?, ?)`,
    [input.nombre, input.direccion, input.telefono, input.estado]
  );
  return res.insertId;
}

export async function updateSucursal(
  id: number,
  input: {
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    estado: "activo" | "inactivo";
  }
): Promise<void> {
  await pool.execute(
    `UPDATE sucursales SET nombre = ?, direccion = ?, telefono = ?, estado = ? WHERE id = ?`,
    [input.nombre, input.direccion, input.telefono, input.estado, id]
  );
}
