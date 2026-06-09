/**
 * Busca productos con carácter de reemplazo UTF-8 (�).
 * Uso: node --env-file=.env.local scripts/find-broken-encoding.mjs
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

const cols = [
  "nombre",
  "especificacion",
  "repuesto",
  "procedencia",
  "medida",
  "descripcion",
  "codigo_pieza",
  "marca_auto",
];
const conditions = cols.map((c) => `${c} LIKE '%\uFFFD%'`).join(" OR ");

try {
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM productos WHERE ${conditions}`
  );
  console.log("Total con �:", countRows[0].c);

  const [rows] = await pool.query(
    `SELECT id, codigo, codigo_pieza, nombre, especificacion, repuesto, procedencia, medida, descripcion, marca_auto
     FROM productos WHERE ${conditions} ORDER BY CAST(codigo AS UNSIGNED) LIMIT 30`
  );
  for (const r of rows) {
    console.log(JSON.stringify(r));
  }
} catch (err) {
  console.error("Error:", err.code ?? err.message, err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
