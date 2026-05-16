/** Entero seguro para LIMIT en SQL (mínimo 1). Para OFFSET usar `sqlOffset`. */
export function sqlInt(n: number, max: number): number {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x) || x < 1) {
    return 1;
  }
  return Math.min(x, max);
}

/** OFFSET SQL: admite 0. No usar `sqlInt` (su mínimo es 1 y rompe la primera página). */
export function sqlOffset(n: number, max: number): number {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x) || x < 0) {
    return 0;
  }
  return Math.min(x, max);
}
