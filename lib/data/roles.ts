import "server-only";

import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export type RolRow = { id: number; nombre: string };

export async function listRoles(): Promise<RolRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre FROM roles ORDER BY id ASC`
  );
  return rows as RolRow[];
}
