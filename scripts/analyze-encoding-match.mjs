import fs from "node:fs";
import mysql from "mysql2/promise";
import { getMysqlSslOptions } from "./mysql-ssl.mjs";

const ssl = getMysqlSslOptions();
const pool = mysql.createPool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ...(ssl ? { ssl } : {}),
});

const csv = fs.readFileSync("repuestos osk.csv").toString("latin1").split(/\r?\n/).slice(1);
const byCodigo = new Map();
const byPieza = new Map();
for (const line of csv) {
  const cols = line.split(";");
  if (cols.length < 10) continue;
  byCodigo.set(cols[0].trim(), true);
  const pieza = cols[1].trim();
  if (pieza) byPieza.set(pieza, true);
}

const REPLACEMENT = "\uFFFD";
const cond = [
  "nombre",
  "especificacion",
  "repuesto",
  "procedencia",
  "medida",
  "codigo_pieza",
  "marca_auto",
]
  .map((c) => `${c} LIKE '%${REPLACEMENT}%'`)
  .join(" OR ");

const [allBroken] = await pool.query(
  `SELECT id, codigo, codigo_pieza FROM productos WHERE ${cond}`
);

let matchCodigo = 0;
let matchPieza = 0;
let matchId = 0;
let none = 0;

for (const r of allBroken) {
  if (byCodigo.has(String(r.codigo).trim())) matchCodigo++;
  else if (r.codigo_pieza && byPieza.has(String(r.codigo_pieza).trim())) matchPieza++;
  else if (byCodigo.has(String(r.id).trim())) matchId++;
  else none++;
}

console.log("Total broken:", allBroken.length);
console.log("Match by codigo:", matchCodigo);
console.log("Match by pieza:", matchPieza);
console.log("Match by id:", matchId);
console.log("No match:", none);

await pool.end();
