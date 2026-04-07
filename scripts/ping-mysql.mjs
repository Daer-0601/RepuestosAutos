import mysql from "mysql2/promise";
import { getMysqlSslOptions } from "./mysql-ssl.mjs";

const ssl = getMysqlSslOptions();

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectTimeout: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 20000),
  ...(ssl ? { ssl } : {}),
});

try {
  const [rows] = await pool.query(
    "SELECT 1 AS ok, DATABASE() AS base_datos, VERSION() AS version_mysql"
  );
  console.log("Conexión OK:", rows[0]);

  const [tables] = await pool.query(
    "SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  console.log("Tablas en esta base:", tables[0]);
} catch (err) {
  console.error("Error:", err.code ?? err.message, err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
