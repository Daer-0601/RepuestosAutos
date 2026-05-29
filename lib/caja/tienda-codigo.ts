/** Código corto de tienda para reportes (ej. T3). */
export function codigoTienda(sucursalId: number, sucursalNombre: string): string {
  const nombre = sucursalNombre.trim();
  const m = nombre.match(/(?:tienda\s*)?(\d+)/i);
  if (m) return `T${m[1]}`;
  const m2 = nombre.match(/\bT(\d+)\b/i);
  if (m2) return `T${m2[1]}`;
  return `T${sucursalId}`;
}
