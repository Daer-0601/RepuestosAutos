/**
 * Filtro estricto por código interno / QR: solo el valor ingresado (sin LIKE).
 * Si el texto es solo dígitos, también coincide por valor numérico (ej. 1000 = 001000).
 */
export function condicionCodigoQrExacta(
  raw: string,
  tableAlias: string
): { sql: string; params: (string | number)[] } | null {
  const s = raw.trim().replace(/%/g, "").slice(0, 80);
  if (!s) return null;

  const c = `${tableAlias}.codigo`;
  const q = `IFNULL(${tableAlias}.qr_payload,'')`;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return {
      sql: `(${c} = ? OR ${q} = ? OR CAST(${c} AS UNSIGNED) = ? OR CAST(${q} AS UNSIGNED) = ?)`,
      params: [s, s, n, n],
    };
  }

  return {
    sql: `(${c} = ? OR ${q} = ?)`,
    params: [s, s],
  };
}
