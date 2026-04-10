import "server-only";

import { pool } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type ClienteRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  activo: number;
};

export async function listClientes(): Promise<ClienteRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, telefono, direccion, activo
     FROM clientes
     ORDER BY nombre ASC`
  );
  return rows as ClienteRow[];
}

export async function getCliente(id: number): Promise<ClienteRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre, telefono, direccion, activo FROM clientes WHERE id = ? LIMIT 1`,
    [id]
  );
  const r = rows[0] as ClienteRow | undefined;
  return r ?? null;
}

export async function insertCliente(input: {
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  activo: boolean;
}): Promise<number> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO clientes (nombre, telefono, direccion, activo)
     VALUES (?, ?, ?, ?)`,
    [input.nombre, input.telefono, input.direccion, input.activo ? 1 : 0]
  );
  return res.insertId;
}

export async function updateCliente(
  id: number,
  input: {
    nombre: string;
    telefono: string | null;
    direccion: string | null;
    activo: boolean;
  }
): Promise<void> {
  await pool.execute(
    `UPDATE clientes SET nombre = ?, telefono = ?, direccion = ?, activo = ? WHERE id = ?`,
    [input.nombre, input.telefono, input.direccion, input.activo ? 1 : 0, id]
  );
}
