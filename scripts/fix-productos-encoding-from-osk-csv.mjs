/**
 * Restaura textos con carácter de reemplazo (�) en productos desde «repuestos osk.csv» (Latin-1).
 * Uso: node --env-file=.env.local scripts/fix-productos-encoding-from-osk-csv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { getMysqlSslOptions } from "./mysql-ssl.mjs";

const CSV_PATH = path.join(process.cwd(), "repuestos osk.csv");
const REPLACEMENT = "\uFFFD";

function normalizarCodigoBarra(raw) {
  return raw.trim().replace(/\./g, "");
}

function nullIfEmpty(value) {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

function parseOskCsvRows(contentLatin1) {
  const lines = contentLatin1.split(/\r?\n/).filter((line) => line.trim());
  const rows = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    if (cols.length < 10) continue;

    const codigo = normalizarCodigoBarra(cols[0]);
    if (!codigo) continue;

    rows.set(codigo, {
      codigo_pieza: nullIfEmpty(cols[1]),
      especificacion: nullIfEmpty(cols[2]),
      nombre: nullIfEmpty(cols[3]),
      repuesto: nullIfEmpty(cols[4]),
      procedencia: nullIfEmpty(cols[5]),
      marca_auto: nullIfEmpty(cols[6]),
      unidad: nullIfEmpty(cols[7]),
      medida: nullIfEmpty(cols[8]),
    });
  }

  return rows;
}

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

const textCols = [
  "nombre",
  "especificacion",
  "repuesto",
  "procedencia",
  "medida",
  "descripcion",
  "codigo_pieza",
  "marca_auto",
  "unidad",
];
const brokenCondition = textCols.map((col) => `${col} LIKE '%${REPLACEMENT}%'`).join(" OR ");

try {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`No se encontró ${CSV_PATH}`);
  }

  const csvRows = parseOskCsvRows(fs.readFileSync(CSV_PATH).toString("latin1"));
  console.log("Filas en CSV:", csvRows.size);

  const [brokenRows] = await pool.query(
    `SELECT id, codigo, codigo_pieza, nombre, especificacion, repuesto, procedencia, medida, descripcion, marca_auto, unidad
     FROM productos
     WHERE ${brokenCondition}
     ORDER BY CAST(codigo AS UNSIGNED)`
  );

  console.log("Productos con �:", brokenRows.length);

  let updated = 0;
  let missingInCsv = 0;

  for (const producto of brokenRows) {
    const source = csvRows.get(normalizarCodigoBarra(String(producto.codigo)));
    if (!source) {
      missingInCsv += 1;
      console.warn(`Sin fila CSV para codigo=${producto.codigo} id=${producto.id}`);
      continue;
    }

    await pool.execute(
      `UPDATE productos SET
         codigo_pieza = ?, especificacion = ?, nombre = ?, repuesto = ?, procedencia = ?,
         marca_auto = ?, unidad = ?, medida = ?
       WHERE id = ?`,
      [
        source.codigo_pieza,
        source.especificacion,
        source.nombre,
        source.repuesto,
        source.procedencia,
        source.marca_auto,
        source.unidad,
        source.medida,
        producto.id,
      ]
    );
    updated += 1;
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS c FROM productos WHERE ${brokenCondition}`
  );

  console.log("Actualizados:", updated);
  console.log("Sin CSV:", missingInCsv);
  console.log("Restantes con �:", countRows[0].c);
} catch (err) {
  console.error("Error:", err.code ?? err.message, err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
