import "server-only";

import { ROLE_HOME_PATHS } from "@/lib/auth/role-routes";
import bcrypt from "bcryptjs";
import type { RowDataPacket } from "mysql2";
import { pool } from "@/lib/db";

export { ROLE_HOME_PATHS } from "@/lib/auth/role-routes";

type UsuarioRow = RowDataPacket & {
  id: number;
  username: string;
  password_hash: string;
  rol_id: number;
  activo: number;
};

export type AuthFailureReason =
  | "invalid_credentials"
  | "inactive"
  | "unknown_role"
  | "db_error";

export type AuthResult =
  | {
      ok: true;
      user: { id: number; username: string; rol_id: number };
    }
  | { ok: false; reason: AuthFailureReason };

export async function authenticateUsuario(
  username: string,
  password: string
): Promise<AuthResult> {
  try {
    const [rows] = await pool.execute<UsuarioRow[]>(
      `SELECT id, username, password_hash, rol_id, activo
       FROM usuarios
       WHERE username = ?
       LIMIT 1`,
      [username]
    );

    const row = rows[0];
    if (!row) {
      return { ok: false, reason: "invalid_credentials" };
    }

    if (!row.activo) {
      return { ok: false, reason: "inactive" };
    }

    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return { ok: false, reason: "invalid_credentials" };
    }

    const home = ROLE_HOME_PATHS[row.rol_id];
    if (!home) {
      return { ok: false, reason: "unknown_role" };
    }

    return {
      ok: true,
      user: {
        id: row.id,
        username: row.username,
        rol_id: row.rol_id,
      },
    };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
