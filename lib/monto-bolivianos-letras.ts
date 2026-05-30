/** Convierte monto Bs a texto legal breve (hasta millones). */
export function montoBolivianosEnLetras(monto: number): string {
  const n = Math.round(Number(monto) * 100) / 100;
  if (!Number.isFinite(n) || n < 0) return "cero con 00/100";
  const entero = Math.floor(n);
  const cent = Math.round((n - entero) * 100);
  const centStr = String(cent).padStart(2, "0");
  if (entero === 0) return `cero con ${centStr}/100`;
  return `${numeroEnLetras(entero)} con ${centStr}/100`;
}

const UNIDADES = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
];
const DECENAS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
];

function numeroEnLetras(n: number): string {
  if (n < 20) return UNIDADES[n] ?? String(n);
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (n < 30) {
      if (n === 20) return "veinte";
      if (n === 21) return "veintiuno";
      return `veinti${UNIDADES[u]}`;
    }
    return u === 0 ? DECENAS[d]! : `${DECENAS[d]} y ${UNIDADES[u]}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const r = n % 100;
    const cien =
      c === 1 ? (r === 0 ? "cien" : "ciento") : c === 5 && r === 0 ? "quinientos" : `${UNIDADES[c]}cientos`;
    return r === 0 ? cien : `${cien} ${numeroEnLetras(r)}`;
  }
  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000);
    const r = n % 1000;
    const mil = miles === 1 ? "mil" : `${numeroEnLetras(miles)} mil`;
    return r === 0 ? mil : `${mil} ${numeroEnLetras(r)}`;
  }
  const mill = Math.floor(n / 1_000_000);
  const r = n % 1_000_000;
  const millTxt = mill === 1 ? "un millón" : `${numeroEnLetras(mill)} millones`;
  return r === 0 ? millTxt : `${millTxt} ${numeroEnLetras(r)}`;
}
