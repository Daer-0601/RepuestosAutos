import fs from "node:fs";
import path from "node:path";

export function getMysqlSslOptions() {
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
