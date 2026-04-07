/**
 * Actualiza password_hash (bcrypt) para todos los registros de `usuarios`.
 * Uso: node --env-file=.env.local scripts/set-all-user-passwords.mjs [contraseña]
 * Default contraseña: 123456
 */
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { getMysqlSslOptions } from "./mysql-ssl.mjs";

const plain = process.argv[2] ?? "123456";
const hash = bcrypt.hashSync(plain, 12);

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
    "UPDATE usuarios SET password_hash = ? WHERE 1 = 1",
    [hash]
  );
  console.log("OK. Filas actualizadas:", res.affectedRows);
  const [rows] = await pool.execute(
    "SELECT id, username, rol_id FROM usuarios ORDER BY id"
  );
  console.log("Usuarios:", rows);
} catch (err) {
  console.error("Error:", err.code ?? err.message, err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
