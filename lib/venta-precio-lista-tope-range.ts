/**
 * Piso de venta en Bs: punto tope (no vender por debajo). El precio de lista es referencia;
 * se puede cobrar por encima sin tope superior en catálogo.
 */
export function precioVentaBsPiso(
  puntoTope: number | null | undefined
): number | null {
  const tope =
    puntoTope != null && Number.isFinite(puntoTope) && puntoTope > 0
      ? Math.round(puntoTope * 100) / 100
      : null;
  return tope;
}

export function validarPrecioVentaBs(
  precioBs: number,
  puntoTope: number | null | undefined
): { ok: true } | { ok: false; message: string } {
  const piso = precioVentaBsPiso(puntoTope);
  if (piso != null && precioBs < piso) {
    return {
      ok: false,
      message: `Monto no permitido: es inferior al tope (${piso.toFixed(2)} Bs).`,
    };
  }
  return { ok: true };
}

/**
 * Precio de lista y punto tope definen un intervalo [mín, máx] (el menor y el mayor de ambos),
 * sin asumir cuál es piso o techo en catálogo. Usado en cotizaciones.
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
