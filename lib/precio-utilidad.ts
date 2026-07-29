export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

export function parseNumOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function fmtPrecio(n: number, dec: 2 | 4): string {
  return dec === 2 ? round2(n).toFixed(2) : round4(n).toFixed(4);
}

/** Costo con flete = precio compra USD × (1 + %flete / 100). Ej.: 20 + 50% → 30 USD. */
export function costoConFleteUsd(precioCompraUsd: number, porcentajeFlete: number): number {
  const f = Number.isFinite(porcentajeFlete) ? porcentajeFlete : 0;
  return round4(precioCompraUsd * (1 + f / 100));
}

/**
 * Precio venta = compra USD × (1 + %util/100 + %flete/100).
 * Utilidad y flete se aplican sobre el precio de compra (sin mezclar: util no va sobre costo c/flete).
 */
export function precioVentaDesdeCompraUsd(
  precioCompraUsd: number,
  porcentajeUtilidad: number,
  tipoCambio: number,
  porcentajeFlete = 0
): { precioVentaUsd: string; precioVentaBs: string } {
  const u = Number.isFinite(porcentajeUtilidad) ? porcentajeUtilidad : 0;
  const f = Number.isFinite(porcentajeFlete) ? porcentajeFlete : 0;
  const ventaUsd = round4(precioCompraUsd * (1 + u / 100 + f / 100));
  const ventaBs = tipoCambio > 0 ? round2(ventaUsd * tipoCambio) : 0;
  return {
    precioVentaUsd: fmtPrecio(ventaUsd, 4),
    precioVentaBs: fmtPrecio(ventaBs, 2),
  };
}

/** @deprecated Usar precioVentaDesdeCompraUsd con % flete. */
export function precioVentaDesdeCostoUsd(
  costoUsd: number,
  porcentajeUtilidad: number,
  tipoCambio: number
): { precioVentaUsd: string; precioVentaBs: string } {
  return precioVentaDesdeCompraUsd(costoUsd, porcentajeUtilidad, tipoCambio, 0);
}

/** % utilidad inverso: venta = compra × (1 + util/100 + flete/100). */
export function utilidadDesdePreciosUsd(
  precioCompraUsd: number,
  precioVentaUsd: number,
  porcentajeFlete = 0
): number {
  if (precioCompraUsd <= 0) return 0;
  const f = Number.isFinite(porcentajeFlete) ? porcentajeFlete : 0;
  return round2((precioVentaUsd / precioCompraUsd - 1 - f / 100) * 100);
}

/** Precio venta lista = costo unitario × (1 + %util / 100). */
export function calcPrecioVentaDesdeUtilidad(
  precioCompraBs: number,
  porcentajeUtilidad: number,
  tipoCambio: number
): { precioVentaBs: string; precioVentaUsd: string } {
  const ventaBs = round2(precioCompraBs * (1 + porcentajeUtilidad / 100));
  const ventaUsd = tipoCambio > 0 ? round4(ventaBs / tipoCambio) : 0;
  return {
    precioVentaBs: fmtPrecio(ventaBs, 2),
    precioVentaUsd: fmtPrecio(ventaUsd, 4),
  };
}

/** % utilidad inverso a partir de costo y precio venta lista. */
export function calcUtilidadDesdePrecioVenta(precioCompraBs: number, precioVentaBs: number): number {
  return round2((precioVentaBs / precioCompraBs - 1) * 100);
}
