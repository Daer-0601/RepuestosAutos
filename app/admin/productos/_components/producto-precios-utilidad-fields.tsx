"use client";

import {
  calcPrecioVentaDesdeUtilidad,
  calcUtilidadDesdePrecioVenta,
  fmtPrecio,
  parseNumOrNull,
  round2,
  round4,
} from "@/lib/precio-utilidad";
import { useMemo, useState } from "react";

type Props = {
  fieldClass: string;
  initialPrecioVentaBs: string;
  initialPrecioVentaUsd: string;
  initialPorcentajeUtilidad: string;
  initialPuntoTope: string;
  /** Última compra confirmada (unitario Bs). */
  precioCompraBs: string | null;
  precioCompraUsd: string | null;
  tipoCambio: number | null;
};

function resolvePrecioCompraBs(
  precioCompraBs: string | null,
  precioCompraUsd: string | null,
  tipoCambio: number | null,
  ventaBs: string,
  utilidad: string
): number | null {
  let pBs = parseNumOrNull(precioCompraBs ?? "");
  if (pBs == null) {
    const pUsd = parseNumOrNull(precioCompraUsd ?? "");
    if (pUsd != null && tipoCambio != null && tipoCambio > 0) {
      pBs = round2(pUsd * tipoCambio);
    }
  }
  if (pBs == null) {
    const vBs = parseNumOrNull(ventaBs);
    const u = parseNumOrNull(utilidad);
    if (vBs != null && u != null) {
      pBs = round2(vBs / (1 + u / 100));
    }
  }
  return pBs;
}

export function ProductoPreciosUtilidadFields({
  fieldClass,
  initialPrecioVentaBs,
  initialPrecioVentaUsd,
  initialPorcentajeUtilidad,
  initialPuntoTope,
  precioCompraBs,
  precioCompraUsd,
  tipoCambio,
}: Props) {
  const [precioVentaBs, setPrecioVentaBs] = useState(initialPrecioVentaBs);
  const [precioVentaUsd, setPrecioVentaUsd] = useState(initialPrecioVentaUsd);
  const [porcentajeUtilidad, setPorcentajeUtilidad] = useState(initialPorcentajeUtilidad);
  const [puntoTope, setPuntoTope] = useState(initialPuntoTope);

  const costoBs = useMemo(
    () =>
      resolvePrecioCompraBs(
        precioCompraBs,
        precioCompraUsd,
        tipoCambio,
        initialPrecioVentaBs,
        initialPorcentajeUtilidad
      ),
    [precioCompraBs, precioCompraUsd, tipoCambio, initialPrecioVentaBs, initialPorcentajeUtilidad]
  );

  const tc = tipoCambio != null && tipoCambio > 0 ? tipoCambio : null;

  function onUtilidadChange(raw: string) {
    setPorcentajeUtilidad(raw);
    const u = parseNumOrNull(raw);
    if (costoBs == null || costoBs <= 0 || u == null || tc == null) return;
    const { precioVentaBs: vBs, precioVentaUsd: vUsd } = calcPrecioVentaDesdeUtilidad(costoBs, u, tc);
    setPrecioVentaBs(vBs);
    setPrecioVentaUsd(vUsd);
  }

  function onPrecioVentaBsChange(raw: string) {
    setPrecioVentaBs(raw);
    const vBs = parseNumOrNull(raw);
    if (vBs == null || tc == null) return;
    setPrecioVentaUsd(fmtPrecio(round4(vBs / tc), 4));
    if (costoBs != null && costoBs > 0) {
      setPorcentajeUtilidad(fmtPrecio(calcUtilidadDesdePrecioVenta(costoBs, vBs), 2));
    }
  }

  function onPrecioVentaUsdChange(raw: string) {
    setPrecioVentaUsd(raw);
    const vUsd = parseNumOrNull(raw);
    if (vUsd == null || tc == null) return;
    const vBs = round2(vUsd * tc);
    setPrecioVentaBs(fmtPrecio(vBs, 2));
    if (costoBs != null && costoBs > 0) {
      setPorcentajeUtilidad(fmtPrecio(calcUtilidadDesdePrecioVenta(costoBs, vBs), 2));
    }
  }

  const costoHint =
    costoBs != null
      ? precioCompraBs ?? precioCompraUsd
        ? `Costo última compra: ${fmtPrecio(costoBs, 2)} Bs`
        : `Costo estimado: ${fmtPrecio(costoBs, 2)} Bs (desde precios actuales)`
      : "Sin costo de compra: ingrese precios manualmente o registre una compra.";

  return (
    <>
      {tc != null ? (
        <p className="text-xs text-slate-500">
          Tipo de cambio actual: {fmtPrecio(tc, 2)} Bs/USD · {costoHint}
        </p>
      ) : (
        <p className="text-xs text-amber-200/90">Sin tipo de cambio registrado; no se pueden recalcular precios.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="precio_venta_lista_bs"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Precio lista Bs
          </label>
          <input
            id="precio_venta_lista_bs"
            name="precio_venta_lista_bs"
            value={precioVentaBs}
            onChange={(e) => onPrecioVentaBsChange(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label
            htmlFor="precio_venta_lista_usd"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Precio lista USD
          </label>
          <input
            id="precio_venta_lista_usd"
            name="precio_venta_lista_usd"
            value={precioVentaUsd}
            onChange={(e) => onPrecioVentaUsdChange(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="porcentaje_utilidad"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            % utilidad
          </label>
          <input
            id="porcentaje_utilidad"
            name="porcentaje_utilidad"
            value={porcentajeUtilidad}
            onChange={(e) => onUtilidadChange(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="punto_tope" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Punto tope
          </label>
          <input
            id="punto_tope"
            name="punto_tope"
            value={puntoTope}
            onChange={(e) => setPuntoTope(e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>
    </>
  );
}
