import "server-only";

import { pool } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export type UsuarioListRow = {
  id: number;
  nombre_completo: string;
  username: string;
  rol_id: number;
  rol_nombre: string;
  sucursal_id: number | null;
  sucursal_nombre: string | null;
  activo: number;
};

export async function listUsuarios(): Promise<UsuarioListRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.nombre_completo, u.username, u.rol_id, r.nombre AS rol_nombre,
            u.sucursal_id, s.nombre AS sucursal_nombre, u.activo
     FROM usuarios u
     INNER JOIN roles r ON r.id = u.rol_id
     LEFT JOIN sucursales s ON s.id = u.sucursal_id
     ORDER BY u.id ASC`
  );
  return rows as UsuarioListRow[];
}

export type UsuarioEditRow = {
  id: number;
  nombre_completo: string;
  username: string;
  rol_id: number;
  sucursal_id: number | null;
  activo: number;
};

export async function getUsuario(id: number): Promise<UsuarioEditRow | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre_completo, username, rol_id, sucursal_id, activo
     FROM usuarios WHERE id = ? LIMIT 1`,
    [id]
  );
  const r = rows[0] as UsuarioEditRow | undefined;
  return r ?? null;
}

export async function countUsername(username: string, excludeId?: number): Promise<number> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    excludeId
      ? `SELECT COUNT(*) AS c FROM usuarios WHERE username = ? AND id <> ?`
      : `SELECT COUNT(*) AS c FROM usuarios WHERE username = ?`,
    excludeId ? [username, excludeId] : [username]
  );
  return Number((rows[0] as { c: number }).c);
}

export async function insertUsuario(input: {
  nombre_completo: string;
  username: string;
  password_hash: string;
  rol_id: number;
  sucursal_id: number | null;
  activo: boolean;
}): Promise<number> {
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO usuarios (nombre_completo, username, password_hash, rol_id, sucursal_id, activo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.nombre_completo,
      input.username,
      input.password_hash,
      input.rol_id,
      input.sucursal_id,
      input.activo ? 1 : 0,
    ]
  );
  return res.insertId;
}

export async function updateUsuario(
  id: number,
  input: {
    nombre_completo: string;
    username: string;
    password_hash?: string;
    rol_id: number;
    sucursal_id: number | null;
    activo: boolean;
  }
): Promise<void> {
  if (input.password_hash) {
    await pool.execute(
      `UPDATE usuarios SET nombre_completo = ?, username = ?, password_hash = ?, rol_id = ?, sucursal_id = ?, activo = ?
       WHERE id = ?`,
      [
        input.nombre_completo,
        input.username,
        input.password_hash,
        input.rol_id,
        input.sucursal_id,
        input.activo ? 1 : 0,
        id,
      ]
    );
  } else {
    await pool.execute(
      `UPDATE usuarios SET nombre_completo = ?, username = ?, rol_id = ?, sucursal_id = ?, activo = ?
       WHERE id = ?`,
      [
        input.nombre_completo,
        input.username,
        input.rol_id,
        input.sucursal_id,
        input.activo ? 1 : 0,
        id,
      ]
    );
  }
}
