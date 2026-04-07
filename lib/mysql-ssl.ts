import fs from "node:fs";
import path from "node:path";
import type { SslOptions } from "mysql2";

/**
 * Opciones TLS para mysql2 cuando DATABASE_SSL=true.
 * Si DATABASE_SSL_CA apunta a un PEM (ruta relativa al cwd o absoluta), se usa como CA.
 */
export function getMysqlSslOptions(): SslOptions | undefined {
  if (process.env.DATABASE_SSL !== "true") {
    return undefined;
  }

  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
  const caFile = process.env.DATABASE_SSL_CA;

  if (caFile) {
    const resolved = path.isAbsolute(caFile)
      ? caFile
      : path.join(process.cwd(), caFile);
    if (!fs.existsSync(resolved)) {
      throw new Error(`DATABASE_SSL_CA no encontrado: ${resolved}`);
    }
    return {
      ca: fs.readFileSync(resolved),
      rejectUnauthorized,
    };
  }

  return { rejectUnauthorized };
}
