import "server-only";

import { pool } from "@/lib/db";
import { MYSQL_SESSION_OFFSET } from "@/lib/fecha-bolivia";
import type { PoolConnection } from "mysql2/promise";

/** Ejecuta consultas con sesión MySQL en offset Bolivia (−04:00). */
export async function withBoliviaMysqlSession<T>(
  fn: (conn: PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.query(`SET time_zone = '${MYSQL_SESSION_OFFSET}'`);
    return await fn(conn);
  } finally {
    conn.release();
  }
}
