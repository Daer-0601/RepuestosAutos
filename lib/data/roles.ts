import "server-only";

import { pool } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export type RolRow = { id: number; nombre: string };

/** Etiqueta en español para selects y tablas (los `nombre` en BD pueden estar en inglés). */
export function etiquetaRolEspanol(rol: { id: number; nombre: string }): string {
  const porId: Record<number, string> = {
    1: "Administrador",
    2: "Cajero",
    3: "Vendedor",
  };
  const t = porId[rol.id];
  if (t) return t;
  const n = rol.nombre.trim().toLowerCase();
  if (n === "admin" || n === "administrator") return "Administrador";
  if (n === "cajero" || n === "cashier") return "Cajero";
  if (n === "vendedor" || n === "seller" || n === "sales") return "Vendedor";
  return rol.nombre;
}

export async function listRoles(): Promise<RolRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT id, nombre FROM roles ORDER BY id ASC`
  );
  return rows as RolRow[];
}
