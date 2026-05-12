/**
 * Precio de lista y punto tope definen un intervalo [mín, máx] (el menor y el mayor de ambos),
 * sin asumir cuál es piso o techo en catálogo.
 */
export function rangoPrecioListaTopeBs(
  listaBs: number | null | undefined,
  puntoTope: number | null | undefined
): { lo: number; hi: number } | null {
  const lista =
    listaBs != null && Number.isFinite(listaBs) && listaBs > 0 ? Math.round(listaBs * 100) / 100 : null;
  const tope =
    puntoTope != null && Number.isFinite(puntoTope) && puntoTope > 0
      ? Math.round(puntoTope * 100) / 100
      : null;
  if (lista == null || tope == null) return null;
  return { lo: Math.min(lista, tope), hi: Math.max(lista, tope) };
}
