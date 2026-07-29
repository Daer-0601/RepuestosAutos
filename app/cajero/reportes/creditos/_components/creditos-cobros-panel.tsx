"use client";

import { formatIsoDateOnlyBo, formatDateTimeMysqlBolivia, formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import {
  buildReporteCreditosCobrosHtml,
  openReporteCreditosCobrosPrint,
} from "@/lib/reportes/reporte-creditos-cobros-html";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type CobroRow = {
  pagoId: number;
  creditoId: number;
  ventaId: number;
  numeroDocumento: string | null;
  clienteNombre: string;
  vendedorNombre: string;
  montoBs: number;
  tipoPago: "efectivo" | "qr" | "tarjeta";
  fecha: string;
  cajeroNombre: string;
};

function todayIso(): string {
  return formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
}

function labelTipoPago(tp: CobroRow["tipoPago"]): string {
  if (tp === "qr") return "QR";
  if (tp === "tarjeta") return "Tarjeta";
  return "Efectivo";
}

function labelFechaHora(iso: string): string {
  const t = iso.trim();
  if (!t) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T12:00:00`) : new Date(t.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString("es-BO", formatoMostrarFechaHoraBo);
}

export function CreditosCobrosPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const hoy = todayIso();
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CobroRow[]>([]);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [docPrintErr, setDocPrintErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        desde: fechaDesde.trim(),
        hasta: fechaHasta.trim(),
        _t: String(Date.now()),
      });
      const res = await fetch(`/api/cajero/creditos/cobros?${q}`, { cache: "no-store" });
      const data = (await res.json()) as {
        cobros?: CobroRow[];
        sucursalNombre?: string;
        fechaDesde?: string;
        fechaHasta?: string;
        error?: string;
      };
      if (!res.ok) {
        setRows([]);
        setErr(data.error ?? "No se pudieron cargar los cobros.");
        return;
      }
      setSucursalNombre(data.sucursalNombre?.trim() ?? "");
      setRows(Array.isArray(data.cobros) ? data.cobros : []);
    } catch {
      setRows([]);
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    void cargar();
  }, [cargar, refreshKey]);

  const totales = useMemo(() => {
    let total = 0;
    let ef = 0;
    let qr = 0;
    let tar = 0;
    for (const r of rows) {
      total = Math.round((total + r.montoBs) * 100) / 100;
      if (r.tipoPago === "efectivo") ef = Math.round((ef + r.montoBs) * 100) / 100;
      else if (r.tipoPago === "qr") qr = Math.round((qr + r.montoBs) * 100) / 100;
      else tar = Math.round((tar + r.montoBs) * 100) / 100;
    }
    return { total, ef, qr, tar };
  }, [rows]);

  function imprimirReporte() {
    if (typeof document === "undefined") return;
    setDocPrintErr(null);
    setPrinting(true);
    try {
      const origin = globalThis.window?.location?.origin ?? "";
      const html = buildReporteCreditosCobrosHtml({
        origin,
        sucursalNombre,
        fechaDesde,
        fechaHasta,
        filas: rows.map((r) => ({
          clienteNombre: r.clienteNombre,
          vendedorNombre: r.vendedorNombre,
          fecha: r.fecha,
          tipoPago: r.tipoPago,
          montoBs: r.montoBs,
          cajeroNombre: r.cajeroNombre,
        })),
        fechaImpresion: new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo),
      });
      const r = openReporteCreditosCobrosPrint(html);
      if (!r.ok) setDocPrintErr(r.message);
    } catch {
      setDocPrintErr("No se pudo generar el reporte.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Historial de cobros de crédito por <strong className="font-medium text-slate-300">fecha de pago</strong>.
        Cada cobro también aparece como ingreso en{" "}
        <strong className="font-medium text-slate-300">Ingresos / egresos</strong> del mismo día.
      </p>

      {err ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{err}</p>
      ) : null}
      {docPrintErr ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100" role="alert">
          {docPrintErr}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            className="mt-1 block rounded border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            className="mt-1 block rounded border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setFechaDesde(hoy);
            setFechaHasta(hoy);
          }}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-400 hover:bg-white/5"
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
        <button
          type="button"
          onClick={imprimirReporte}
          disabled={loading || printing}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          Imprimir reporte
        </button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay cobros de crédito entre {formatIsoDateOnlyBo(fechaDesde)} y {formatIsoDateOnlyBo(fechaHasta)}.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fecha cobro</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2 text-right">Monto Bs</th>
                  <th className="px-3 py-2">Cajero</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pagoId} className="border-b border-white/5 text-slate-200">
                    <td className="px-3 py-2 text-xs text-slate-300">{labelFechaHora(r.fecha)}</td>
                    <td className="px-3 py-2">{r.clienteNombre}</td>
                    <td className="px-3 py-2 text-slate-400">{r.vendedorNombre}</td>
                    <td className="px-3 py-2">{labelTipoPago(r.tipoPago)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{r.montoBs.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-400">{r.cajeroNombre}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-slate-500">Total cobrado</span>
              <p className="font-mono text-lg font-semibold text-teal-200">{totales.total.toFixed(2)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">Efectivo</span>
              <p className="font-mono text-lg text-emerald-200">{totales.ef.toFixed(2)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">QR</span>
              <p className="font-mono text-lg text-sky-200">{totales.qr.toFixed(2)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">Tarjeta</span>
              <p className="font-mono text-lg text-violet-200">{totales.tar.toFixed(2)} Bs</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
