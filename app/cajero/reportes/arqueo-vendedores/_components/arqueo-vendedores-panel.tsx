"use client";

import { formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import {
  buildReporteArqueoResumenHtml,
  openReporteArqueoResumenPrint,
} from "@/lib/reportes/reporte-arqueo-resumen-html";
import {
  buildReporteSalidasDiariasHtml,
  labelPeriodoSalidas,
  openReporteSalidasDiariasPrint,
  type SalidasDiariasPrintLinea,
} from "@/lib/reportes/reporte-salidas-diarias-html";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ArqueoFila = {
  usuarioId: number;
  nombreCompleto: string;
  username: string;
  cantidadVentas: number;
  totalBs: number;
  totalUsd: number;
  bsEfectivo: number;
  bsQr: number;
  bsTarjeta: number;
  bsCredito: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

type SalidasApiLinea = SalidasDiariasPrintLinea;

function totalesDesdeFilas(filas: ArqueoFila[]) {
  let ventas = 0;
  let bs = 0;
  let usd = 0;
  let ef = 0;
  let qr = 0;
  let tar = 0;
  let cred = 0;
  for (const f of filas) {
    ventas += f.cantidadVentas;
    bs = round2(bs + f.totalBs);
    usd = round4(usd + f.totalUsd);
    ef = round2(ef + f.bsEfectivo);
    qr = round2(qr + f.bsQr);
    tar = round2(tar + f.bsTarjeta);
    cred = round2(cred + f.bsCredito);
  }
  return { ventas, bs, usd, ef, qr, tar, cred };
}

function mapLineasPrint(lineas: SalidasApiLinea[]): SalidasDiariasPrintLinea[] {
  return lineas.map((ln) => ({
    fecha: ln.fecha,
    vendedorNombre: ln.vendedorNombre,
    codigoInterno: ln.codigoInterno,
    codigoPieza: ln.codigoPieza,
    medida: ln.medida,
    descripcion: ln.descripcion,
    cantidad: ln.cantidad,
    totalLineaBs: ln.totalLineaBs,
    totalLineaUsd: ln.totalLineaUsd,
  }));
}

export function ArqueoVendedoresPanel({
  fechaDesde,
  fechaHasta,
}: {
  fechaDesde: string;
  fechaHasta: string;
}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [docPrintErr, setDocPrintErr] = useState<string | null>(null);
  const [printingUsuarioId, setPrintingUsuarioId] = useState<number | null>(null);
  const [printingResumen, setPrintingResumen] = useState(false);
  const [printingSalidasGeneral, setPrintingSalidasGeneral] = useState(false);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [filas, setFilas] = useState<ArqueoFila[]>([]);
  const cargarSeqRef = useRef(0);

  const cargar = useCallback(async () => {
    const seq = ++cargarSeqRef.current;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        desde: fechaDesde.trim(),
        hasta: fechaHasta.trim(),
        _t: String(Date.now()),
      });
      const res = await fetch(`/api/cajero/arqueo-vendedores?${q}`, { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        sucursalNombre?: string;
        filas?: ArqueoFila[];
      };
      if (seq !== cargarSeqRef.current) return;
      if (!res.ok) {
        setFilas([]);
        setErr(data.error ?? "No se pudo cargar el arqueo.");
        return;
      }
      setSucursalNombre(data.sucursalNombre?.trim() ?? "");
      setFilas(Array.isArray(data.filas) ? data.filas : []);
    } catch {
      if (seq !== cargarSeqRef.current) return;
      setFilas([]);
      setErr("Error de red.");
    } finally {
      if (seq === cargarSeqRef.current) setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totales = useMemo(() => totalesDesdeFilas(filas), [filas]);

  const imprimirResumenGeneralCaja = useCallback(async () => {
    if (typeof document === "undefined") return;
    setDocPrintErr(null);
    setPrintingResumen(true);
    try {
      const q = new URLSearchParams({
        desde: fechaDesde.trim(),
        hasta: fechaHasta.trim(),
        _t: String(Date.now()),
      });
      const res = await fetch(`/api/cajero/arqueo-vendedores?${q}`, { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        sucursalNombre?: string;
        filas?: ArqueoFila[];
      };
      if (!res.ok) {
        setDocPrintErr(data.error ?? "No se pudo cargar el resumen para imprimir.");
        return;
      }
      const filasPrint = Array.isArray(data.filas) ? data.filas : [];
      const fechaImp = new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo);
      const origin = globalThis.window?.location?.origin ?? "";
      const html = buildReporteArqueoResumenHtml({
        origin,
        sucursalNombre: data.sucursalNombre?.trim() ?? sucursalNombre,
        periodoLabel: labelPeriodoSalidas(fechaDesde, fechaHasta),
        filas: filasPrint,
        totales: totalesDesdeFilas(filasPrint),
        fechaImpresion: fechaImp,
      });
      const r = openReporteArqueoResumenPrint(html);
      if (!r.ok) setDocPrintErr(r.message);
    } catch {
      setDocPrintErr("No se pudo generar el resumen para imprimir.");
    } finally {
      setPrintingResumen(false);
    }
  }, [sucursalNombre, fechaDesde, fechaHasta]);

  const imprimirSalidasHtml = useCallback(
    (
      payload: {
        sucursalNombre: string;
        fechaDesde: string;
        fechaHasta: string;
        lineas: SalidasApiLinea[];
        totales: { totalBs: number; totalUsd: number };
        vendedorLinea?: string;
      }
    ) => {
      const origin = globalThis.window?.location?.origin ?? "";
      const html = buildReporteSalidasDiariasHtml({
        origin,
        sucursalNombre: payload.sucursalNombre,
        periodoLabel: labelPeriodoSalidas(payload.fechaDesde, payload.fechaHasta),
        vendedorLinea: payload.vendedorLinea,
        lineas: mapLineasPrint(payload.lineas),
        totales: payload.totales,
        fechaImpresion: new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo),
      });
      const r = openReporteSalidasDiariasPrint(html);
      if (!r.ok) setDocPrintErr(r.message);
    },
    []
  );

  const imprimirSalidasGeneral = useCallback(async () => {
    if (typeof document === "undefined") return;
    setDocPrintErr(null);
    setPrintingSalidasGeneral(true);
    try {
      const q = new URLSearchParams({
        desde: fechaDesde.trim(),
        hasta: fechaHasta.trim(),
        _t: String(Date.now()),
      });
      const res = await fetch(`/api/cajero/arqueo-vendedores/salidas-sucursal?${q}`, { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        sucursalNombre?: string;
        fechaDesde?: string;
        fechaHasta?: string;
        lineas?: SalidasApiLinea[];
        totales?: { totalBs: number; totalUsd: number };
      };
      if (!res.ok) {
        setDocPrintErr(data.error ?? "No se pudo generar el reporte de salidas.");
        return;
      }
      imprimirSalidasHtml({
        sucursalNombre: data.sucursalNombre?.trim() ?? sucursalNombre,
        fechaDesde: data.fechaDesde ?? fechaDesde,
        fechaHasta: data.fechaHasta ?? fechaHasta,
        lineas: Array.isArray(data.lineas) ? data.lineas : [],
        totales: data.totales ?? { totalBs: 0, totalUsd: 0 },
      });
    } catch {
      setDocPrintErr("Error de red al generar el reporte de salidas.");
    } finally {
      setPrintingSalidasGeneral(false);
    }
  }, [fechaDesde, fechaHasta, imprimirSalidasHtml, sucursalNombre]);

  const imprimirSalidasDiarias = useCallback(
    async (usuarioId: number, nombreVendedor: string) => {
      if (typeof document === "undefined") return;
      setDocPrintErr(null);
      setPrintingUsuarioId(usuarioId);
      try {
        const q = new URLSearchParams({
          usuarioId: String(usuarioId),
          desde: fechaDesde.trim(),
          hasta: fechaHasta.trim(),
          _t: String(Date.now()),
        });
        const res = await fetch(`/api/cajero/arqueo-vendedores/salidas-documento?${q}`, { cache: "no-store" });
        const data = (await res.json()) as {
          error?: string;
          sucursalNombre?: string;
          vendedor?: { nombreCompleto: string; username: string };
          fechaDesde?: string;
          fechaHasta?: string;
          lineas?: SalidasApiLinea[];
          totales?: { totalBs: number; totalUsd: number };
        };
        if (!res.ok) {
          setDocPrintErr(data.error ?? "No se pudo generar el documento.");
          return;
        }
        const vend = data.vendedor ?? { nombreCompleto: nombreVendedor, username: "" };
        const vendLine = `Vendedor: ${vend.nombreCompleto}${vend.username ? ` (${vend.username})` : ""}`;
        imprimirSalidasHtml({
          sucursalNombre: data.sucursalNombre?.trim() ?? sucursalNombre,
          fechaDesde: data.fechaDesde ?? fechaDesde,
          fechaHasta: data.fechaHasta ?? fechaHasta,
          lineas: Array.isArray(data.lineas) ? data.lineas : [],
          totales: data.totales ?? { totalBs: 0, totalUsd: 0 },
          vendedorLinea: vendLine,
        });
      } catch {
        setDocPrintErr("Error de red al generar el documento.");
      } finally {
        setPrintingUsuarioId(null);
      }
    },
    [fechaDesde, fechaHasta, imprimirSalidasHtml, sucursalNombre]
  );

  return (
    <div className="space-y-6">
      {err ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100" role="alert">
          {err}
        </p>
      ) : null}
      {docPrintErr ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100" role="alert">
          {docPrintErr}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          Actualizar datos
        </button>
        <button
          type="button"
          onClick={() => void imprimirSalidasGeneral()}
          disabled={loading || printingSalidasGeneral}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/50 px-4 py-2.5 text-sm font-semibold text-sky-100 shadow hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-50"
          title="Reporte de salidas diarias de toda la sucursal (detalle de ítems, como cierre de caja)"
        >
          {printingSalidasGeneral ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Printer className="h-4 w-4" aria-hidden />
          )}
          Imprimir salidas general
        </button>
        <button
          type="button"
          onClick={() => void imprimirResumenGeneralCaja()}
          disabled={loading || printingResumen}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50"
          title="Resumen por vendedor: totales Bs, USD, efectivo, QR, tarjeta y crédito"
        >
          {printingResumen ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
          Imprimir resumen (dinero)
        </button>
        <p className="text-xs text-slate-500">
          Rango activo:{" "}
          <span className="font-mono text-slate-300">{fechaDesde}</span>
          {" — "}
          <span className="font-mono text-slate-300">{fechaHasta}</span>
          <span className="hidden sm:inline"> · Cambiá las fechas arriba y pulsá «Filtrar».</span>
        </p>
      </div>

      {sucursalNombre ? (
        <p className="text-sm text-slate-400">
          Sucursal: <span className="font-medium text-slate-200">{sucursalNombre}</span>. Incluye todos los vendedores
          activos asignados a esta sucursal; las columnas de montos suman ventas <span className="text-slate-300">confirmadas</span> en
          el rango. <span className="text-slate-300">Salidas general</span> imprime el detalle de ítems de toda la sucursal (formato reporte de salidas);
          <span className="text-slate-300"> Resumen (dinero)</span> los totales por vendedor y forma de pago;{" "}
          <span className="text-slate-300">Salidas</span> en cada fila, el mismo reporte solo de ese vendedor.
        </p>
      ) : null}

      {loading && filas.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          Cargando…
        </div>
      ) : filas.length === 0 ? (
        <p className="text-sm text-slate-500">No hay vendedores activos en esta sucursal.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="border-b border-white/10 bg-slate-950/50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Vendedor</th>
                <th className="px-3 py-2.5">Usuario</th>
                <th className="px-3 py-2.5 text-right">Ventas</th>
                <th className="px-3 py-2.5 text-right">Total Bs</th>
                <th className="px-3 py-2.5 text-right">Total USD</th>
                <th className="px-3 py-2.5 text-right">Efectivo Bs</th>
                <th className="px-3 py-2.5 text-right">QR Bs</th>
                <th className="px-3 py-2.5 text-right">Tarjeta Bs</th>
                <th className="px-3 py-2.5 text-right">Crédito Bs</th>
                <th className="px-3 py-2.5 text-center">Salidas</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.usuarioId} className="border-b border-white/5 text-slate-200 last:border-0">
                  <td className="px-3 py-2.5 font-medium">{f.nombreCompleto}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-400">{f.username}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{f.cantidadVentas}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-200/90">{round2(f.totalBs).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-400">{round4(f.totalUsd).toFixed(4)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{round2(f.bsEfectivo).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{round2(f.bsQr).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{round2(f.bsTarjeta).toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{round2(f.bsCredito).toFixed(2)}</td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void imprimirSalidasDiarias(f.usuarioId, f.nombreCompleto)}
                      disabled={printingUsuarioId === f.usuarioId}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-600/20 px-2 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-600/35 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Imprimir reporte de salidas del período (arqueo)"
                    >
                      {printingUsuarioId === f.usuarioId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
                      ) : (
                        <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      Salidas
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-emerald-500/25 bg-emerald-950/20 text-[11px] font-semibold uppercase tracking-wide text-emerald-100/90">
              <tr>
                <td className="px-3 py-3" colSpan={2}>
                  Total sucursal (rango)
                </td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.ventas}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.bs.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.usd.toFixed(4)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.ef.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.qr.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.tar.toFixed(2)}</td>
                <td className="px-3 py-3 text-right font-mono tabular-nums normal-case">{totales.cred.toFixed(2)}</td>
                <td className="px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
