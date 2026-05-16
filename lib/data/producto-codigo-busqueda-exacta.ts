/**
 * Limpia lectura de pistola o pegado: controles, zero-width, puntos como separador de miles (ej. 1.000 → 1000).
 * Alineado con el guardado de productos en `lib/data/productos.ts`.
 */
export function normalizarTextoLecturaCodigoBarras(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/\./g, "")
    .trim();
}

/**
 * Filtro estricto por código interno / QR: solo el valor ingresado (sin LIKE).
 * Si el texto es solo dígitos, también coincide por valor numérico (ej. 1000 = 001000).
 */
export function condicionCodigoQrExacta(
  raw: string,
  tableAlias: string
): { sql: string; params: (string | number)[] } | null {
  const s = normalizarTextoLecturaCodigoBarras(raw).replace(/%/g, "").slice(0, 80);
  if (!s) return null;

  /** Comparar sin espacios laterales en columnas (mismo criterio que al guardar en catálogo). */
  const c = `TRIM(IFNULL(${tableAlias}.codigo,''))`;
  const q = `TRIM(IFNULL(${tableAlias}.qr_payload,''))`;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return {
      sql: `(${c} = ? OR ${q} = ? OR (LENGTH(${c}) > 0 AND CAST(${c} AS UNSIGNED) = ?) OR (LENGTH(${q}) > 0 AND CAST(${q} AS UNSIGNED) = ?))`,
      params: [s, s, n, n],
    };
  }

  return {
    sql: `(LOWER(${c}) = LOWER(?) OR LOWER(${q}) = LOWER(?))`,
    params: [s, s],
  };
}
