import fs from "node:fs";
import path from "node:path";
import type { SslOptions } from "mysql2";

/**
 * Opciones TLS para mysql2 cuando DATABASE_SSL=true.
 * - `DATABASE_SSL_CA_PEM`: contenido PEM del CA (ideal en Vercel, sin archivo en disco).
 * - `DATABASE_SSL_CA`: ruta a un PEM (relativa al cwd o absoluta).
 */
export function getMysqlSslOptions(): SslOptions | undefined {
  if (process.env.DATABASE_SSL !== "true") {
    return undefined;
  }

  const rejectUnauthorized =
    process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
  const caPem = process.env.DATABASE_SSL_CA_PEM?.trim();
  if (caPem) {
    return {
      ca: caPem,
      rejectUnauthorized,
    };
  }

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
