"use client";

import { appendVendedoresIdsQuery } from "@/lib/arqueo/vendedores-query";
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
    esCredito: ln.esCredito,
    formaPagoLabel: ln.formaPagoLabel,
  }));
}

function arqueoQueryBase(desde: string, hasta: string): URLSearchParams {
  return new URLSearchParams({
    desde: desde.trim(),
    hasta: hasta.trim(),
    _t: String(Date.now()),
  });
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const cargarSeqRef = useRef(0);

  const idsSeleccionados = useMemo(
    () => (selectedIds.size > 0 ? [...selectedIds] : null),
    [selectedIds]
  );

  const totales = useMemo(() => totalesDesdeFilas(filas), [filas]);

  const todosSeleccionados =
    filas.length > 0 && filas.every((f) => selectedIds.has(f.usuarioId));
  const algunoSeleccionado = selectedIds.size > 0;

  const cargar = useCallback(async () => {
    const seq = ++cargarSeqRef.current;
    setLoading(true);
    setErr(null);
    try {
      const q = arqueoQueryBase(fechaDesde, fechaHasta);
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
      const rows = Array.isArray(data.filas) ? data.filas : [];
      setFilas(rows);
      setSelectedIds(new Set());
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

  function toggleVendedor(usuarioId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(usuarioId)) next.delete(usuarioId);
      else next.add(usuarioId);
      return next;
    });
  }

  function toggleTodos() {
    if (todosSeleccionados) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filas.map((f) => f.usuarioId)));
  }

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

  const verSalidas = useCallback(
    async (usuarioIds: number[] | null) => {
      if (typeof document === "undefined") return;
      setDocPrintErr(null);
      setPrintingSalidasGeneral(true);
      try {
        const q = arqueoQueryBase(fechaDesde, fechaHasta);
        appendVendedoresIdsQuery(q, usuarioIds);
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
        const nombres =
          usuarioIds && usuarioIds.length > 0
            ? filas
                .filter((f) => usuarioIds.includes(f.usuarioId))
                .map((f) => f.nombreCompleto)
                .join(", ")
            : "";
        const vendedorLinea = nombres.trim() !== "" ? `Vendedores: ${nombres}` : undefined;
        imprimirSalidasHtml({
          sucursalNombre: data.sucursalNombre?.trim() ?? sucursalNombre,
          fechaDesde: data.fechaDesde ?? fechaDesde,
          fechaHasta: data.fechaHasta ?? fechaHasta,
          lineas: Array.isArray(data.lineas) ? data.lineas : [],
          totales: data.totales ?? { totalBs: 0, totalUsd: 0 },
          vendedorLinea,
        });
      } catch {
        setDocPrintErr("Error de red al generar el reporte de salidas.");
      } finally {
        setPrintingSalidasGeneral(false);
      }
    },
    [fechaDesde, fechaHasta, filas, imprimirSalidasHtml, sucursalNombre]
  );

  const imprimirResumenGeneralCaja = useCallback(async () => {
    if (typeof document === "undefined") return;
    setDocPrintErr(null);
    setPrintingResumen(true);
    try {
      const q = arqueoQueryBase(fechaDesde, fechaHasta);
      appendVendedoresIdsQuery(q, idsSeleccionados);
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
  }, [sucursalNombre, fechaDesde, fechaHasta, idsSeleccionados]);

  const imprimirSalidasDiarias = useCallback(
    async (usuarioId: number, nombreVendedor: string) => {
      if (typeof document === "undefined") return;
      setDocPrintErr(null);
      setPrintingUsuarioId(usuarioId);
      try {
        const q = arqueoQueryBase(fechaDesde, fechaHasta);
        q.set("usuarioId", String(usuarioId));
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
          onClick={() => void verSalidas(null)}
          disabled={loading || printingSalidasGeneral || filas.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/40 bg-sky-950/50 px-4 py-2.5 text-sm font-semibold text-sky-100 shadow hover:bg-sky-900/60 disabled:cursor-not-allowed disabled:opacity-50"
          title="Salidas de toda la sucursal"
        >
          {printingSalidasGeneral && !algunoSeleccionado ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Printer className="h-4 w-4" aria-hidden />
          )}
          Imprimir salidas general
        </button>
        {algunoSeleccionado ? (
          <button
            type="button"
            onClick={() => void verSalidas(idsSeleccionados)}
            disabled={loading || printingSalidasGeneral}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            title="Reporte de salidas de los vendedores seleccionados"
          >
            {printingSalidasGeneral ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Printer className="h-4 w-4" aria-hidden />
            )}
            Ver salidas ({selectedIds.size})
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void imprimirResumenGeneralCaja()}
          disabled={loading || printingResumen || filas.length === 0}
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
          <span className="hidden sm:inline">
            {" "}
            · Cambiá las fechas arriba y pulsá «Filtrar». Las salidas no incluyen créditos pendientes de cobro.
          </span>
        </p>
      </div>

      {filas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2.5">
          <span className="text-xs font-medium text-slate-400">Selección:</span>
          <button
            type="button"
            onClick={toggleTodos}
            disabled={loading}
            className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            {todosSeleccionados ? "Quitar todos" : "Seleccionar todos"}
          </button>
          {algunoSeleccionado ? (
            <button
              type="button"
              onClick={() => void verSalidas(idsSeleccionados)}
              disabled={loading || printingSalidasGeneral}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {printingSalidasGeneral ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Printer className="h-3.5 w-3.5" aria-hidden />
              )}
              Ver salidas ({selectedIds.size})
            </button>
          ) : (
            <span className="text-xs text-slate-500">Marcá vendedores para ver sus salidas juntas.</span>
          )}
        </div>
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
                <th className="w-10 px-2 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={todosSeleccionados}
                    onChange={toggleTodos}
                    disabled={loading}
                    className="rounded border-white/25"
                    title="Seleccionar todos"
                    aria-label="Seleccionar todos los vendedores"
                  />
                </th>
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
                  <td className="px-2 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(f.usuarioId)}
                      onChange={() => toggleVendedor(f.usuarioId)}
                      disabled={loading}
                      className="rounded border-white/25"
                      aria-label={`Seleccionar ${f.nombreCompleto}`}
                    />
                  </td>
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
                <td className="px-3 py-3" colSpan={3}>
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
