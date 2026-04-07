import "server-only";
import mysql from "mysql2/promise";
import { getMysqlSslOptions } from "./mysql-ssl";

const globalForDb = globalThis as unknown as {
  mysqlPool: mysql.Pool | undefined;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }
  return value;
}

function createPool(): mysql.Pool {
  const ssl = getMysqlSslOptions();

  return mysql.createPool({
    host: requiredEnv("DATABASE_HOST"),
    port: Number(process.env.DATABASE_PORT ?? "3306"),
    user: requiredEnv("DATABASE_USER"),
    password: requiredEnv("DATABASE_PASSWORD"),
    database: requiredEnv("DATABASE_NAME"),
    waitForConnections: true,
    connectionLimit: Number(process.env.DATABASE_POOL_LIMIT ?? "10"),
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? "10000"),
    ...(ssl ? { ssl } : {}),
  });
}

export const pool = globalForDb.mysqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.mysqlPool = pool;
}

export async function pingDb(): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    return true;
  } finally {
    conn.release();
  }
}
