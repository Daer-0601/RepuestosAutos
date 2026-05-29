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
