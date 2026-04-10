/** Entero seguro para LIMIT / OFFSET en SQL (evita LIMIT ? en prepared statements que fallan en algunos servidores). */
export function sqlInt(n: number, max: number): number {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x) || x < 1) {
    return 1;
  }
  return Math.min(x, max);
}
