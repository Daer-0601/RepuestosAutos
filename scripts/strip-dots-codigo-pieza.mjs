/**
 * Quita puntos de todos los codigo_pieza en productos.
 * Uso: node --env-file=.env.local scripts/strip-dots-codigo-pieza.mjs
 */
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
  const [res] = await pool.execute(
    `UPDATE productos
     SET codigo_pieza = NULLIF(TRIM(REPLACE(codigo_pieza, '.', '')), '')
     WHERE codigo_pieza IS NOT NULL AND codigo_pieza LIKE '%.%'`
  );
  console.log("OK. Filas actualizadas:", res.affectedRows);
} catch (err) {
  console.error("Error:", err.code ?? err.message, err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
