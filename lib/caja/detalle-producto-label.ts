/** Código QR / pieza + nombre para columna detalle en caja. */
export function labelDetalleProductoCodigoNombre(codigo: string, nombre: string): string {
  const cod = codigo.trim();
  const nom = nombre.trim();
  const codOk = cod && cod !== "—";
  const nomOk = nom && nom !== "—";
  if (codOk && nomOk) return `${cod} · ${nom}`;
  if (codOk) return cod;
  return nomOk ? nom : "—";
}

/** Cantidad vendida para mostrar en reportes (entero o decimal breve). */
export function fmtCantidadVendida(cantidad: number): string {
  const c = Number(cantidad);
  if (!Number.isFinite(c) || c <= 0) return "";
  if (Number.isInteger(c) || Math.abs(c - Math.trunc(c)) < 1e-6) {
    return String(Math.trunc(c));
  }
  return c.toLocaleString("es-BO", { maximumFractionDigits: 2 });
}

/** Detalle de producto con cantidad vendida (p. ej. ingresos/egresos). */
export function labelDetalleProductoConCantidad(
  codigo: string,
  nombre: string,
  cantidad: number
): string {
  const base = labelDetalleProductoCodigoNombre(codigo, nombre);
  const cant = fmtCantidadVendida(cantidad);
  return cant ? `${base} · Cant. ${cant}` : base;
}
