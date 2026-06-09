"use client";

import { buildCotizacionImprimirHtml } from "@/lib/cotizacion/build-cotizacion-imprimir-html";
import { formatDateTimeMysqlBolivia } from "@/lib/fecha-bolivia";
import { Loader2, Printer, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type CotizacionPendiente = {
  id: number;
  fecha: string;
  totalBs: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  vendedorNombre: string;
  cajeroAsignadoNombre: string | null;
  cantidadItems: number;
};

type CotizacionDetalle = {
  id: number;
  fecha: string;
  totalBs: number;
  totalUsd: number;
  tipoCambioSnapshot: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  notas: string | null;
  vendedorNombre: string;
  lineas: {
    codigoPieza: string;
    medida: string;
    nombre: string;
    cantidad: number;
    precioUnitarioBs: number;
    totalLineaBs: number;
  }[];
};

function imprimirHtml(docHtml: string, onErr: (msg: string) => void) {
  if (typeof document === "undefined") return;
  const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const w = globalThis.window?.open(objectUrl, "_blank");
  if (!w) {
    URL.revokeObjectURL(objectUrl);
    onErr("No se pudo abrir la ventana de impresión (¿bloqueador de ventanas?).");
    return;
  }
  const teardown = () => {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
    try {
      w.close();
    } catch {
      /* ignore */
    }
  };
  w.addEventListener("afterprint", () => globalThis.setTimeout(teardown, 200), { once: true });
  const doPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      onErr("No se pudo abrir el cuadro de impresión.");
      teardown();
    }
  };
  if (w.document.readyState === "complete") {
    globalThis.setTimeout(doPrint, 120);
  } else {
    w.addEventListener("load", () => globalThis.setTimeout(doPrint, 120), { once: true });
  }
}

export function CotizacionesCajeroPanel({
  sucursalNombre,
  cajeroUsername,
}: {
  sucursalNombre: string;
  cajeroUsername: string;
}) {
  const [filtrarPorDia, setFiltrarPorDia] = useState(false);
  const [fechaDia, setFechaDia] = useState(() => formatDateTimeMysqlBolivia(new Date()).slice(0, 10));
  const [rows, setRows] = useState<CotizacionPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<CotizacionDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const cargarLista = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filtrarPorDia) {
        q.set("filtrar", "1");
        q.set("desde", fechaDia);
        q.set("hasta", fechaDia);
      }
      const res = await fetch(`/api/cajero/cotizaciones-pendientes?${q.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { rows?: CotizacionPendiente[]; error?: string };
      if (!res.ok) {
        setRows([]);
        setError(data.error ?? "No se pudo cargar la lista.");
        return;
      }
      setRows(data.rows ?? []);
    } catch {
      setRows([]);
      setError("Error de red al cargar cotizaciones.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtrarPorDia, fechaDia]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    const id = globalThis.setInterval(() => void cargarLista({ silent: true }), 5000);
    return () => globalThis.clearInterval(id);
  }, [cargarLista]);

  const abrirDetalle = useCallback(async (id: number) => {
    setDetalleId(id);
    setDetalle(null);
    setDetalleLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/cajero/cotizaciones-pendientes?cotizacionId=${id}`, { cache: "no-store" });
      const data = (await res.json()) as { detalle?: CotizacionDetalle; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo cargar el detalle." });
        setDetalleId(null);
        return;
      }
      setDetalle(data.detalle ?? null);
    } catch {
      setMsg({ type: "err", text: "Error de red al cargar el detalle." });
      setDetalleId(null);
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  const cerrarDetalle = () => {
    setDetalleId(null);
    setDetalle(null);
  };

  const imprimirYRegistrar = async () => {
    if (!detalle) return;
    setImprimiendo(true);
    setMsg(null);
    try {
      const doc = buildCotizacionImprimirHtml({
        sucursalNombre,
        vendedorNombre: detalle.vendedorNombre,
        cajeroUsername,
        cotizacionId: detalle.id,
        clienteNombre: detalle.clienteNombre,
        clienteNit: detalle.clienteNit,
        tipoCambioBsUsd: detalle.tipoCambioSnapshot > 0 ? detalle.tipoCambioSnapshot : null,
        totalBs: detalle.totalBs,
        totalUsd: detalle.totalUsd,
        lineas: detalle.lineas.map((ln) => ({
          codigoPieza: ln.codigoPieza,
          medida: ln.medida,
          nombre: ln.nombre,
          cantidad: ln.cantidad,
          precioUnitarioBs: ln.precioUnitarioBs,
          totalLineaBs: ln.totalLineaBs,
        })),
      });
      const res = await fetch("/api/cajero/cotizaciones-pendientes/imprimir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotizacionId: detalle.id }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo registrar la impresión." });
        return;
      }

      imprimirHtml(doc, (text) => setMsg({ type: "err", text }));
      setMsg({ type: "ok", text: `Cotización #${detalle.id} impresa y registrada.` });
      cerrarDetalle();
      void cargarLista({ silent: true });
    } catch {
      setMsg({ type: "err", text: "Error de red al imprimir." });
    } finally {
      setImprimiendo(false);
    }
  };

  return (
    <div className="space-y-5">
      {msg ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-100"
              : "border-rose-500/35 bg-rose-950/30 text-rose-100"
          }`}
          role="status"
        >
          {msg.text}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filtrarPorDia}
              onChange={(e) => setFiltrarPorDia(e.target.checked)}
              className="rounded border-white/20"
            />
            Solo cotizaciones de un día
          </label>
          {filtrarPorDia ? (
            <input
              type="date"
              value={fechaDia}
              onChange={(e) => setFechaDia(e.target.value)}
              className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white"
            />
          ) : (
            <p className="text-xs text-slate-500">Se listan todas las pendientes de impresión de la sucursal.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void cargarLista()}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          Actualizar
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
          <span className="text-sm">Cargando cotizaciones…</span>
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-500">
          No hay cotizaciones pendientes de impresión.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => void abrirDetalle(r.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
              >
                <div>
                  <p className="font-semibold text-white">
                    Cotización #{r.id}
                    {r.clienteNombre ? (
                      <span className="ml-2 font-normal text-slate-400">· {r.clienteNombre}</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {r.fecha.slice(0, 16)} · Vendedor: {r.vendedorNombre}
                    {r.cajeroAsignadoNombre ? ` · Asignada a ${r.cajeroAsignadoNombre}` : null} · {r.cantidadItems}{" "}
                    ítem(s)
                  </p>
                </div>
                <span className="font-mono text-lg font-semibold tabular-nums text-emerald-200">
                  {r.totalBs.toFixed(2)} Bs
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detalleId != null ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-base font-semibold text-white">
                Cotización #{detalleId}
                {detalle?.clienteNombre ? (
                  <span className="ml-2 font-normal text-slate-400">{detalle.clienteNombre}</span>
                ) : null}
              </h3>
              <button
                type="button"
                onClick={cerrarDetalle}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {detalleLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                </div>
              ) : detalle ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">
                    Vendedor: {detalle.vendedorNombre} · Tipo cambio: {detalle.tipoCambioSnapshot.toFixed(4)} Bs/USD
                  </p>
                  <ul className="space-y-3">
                    {detalle.lineas.map((ln, i) => (
                      <li
                        key={`${ln.codigoPieza}-${i}`}
                        className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm"
                      >
                        <p className="font-medium text-slate-100">{ln.nombre}</p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          {ln.codigoPieza} · {ln.medida}
                        </p>
                        <p className="mt-2 font-mono text-slate-300">
                          {ln.cantidad} × {ln.precioUnitarioBs.toFixed(2)} Bs ={" "}
                          <span className="text-emerald-200">{ln.totalLineaBs.toFixed(2)} Bs</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-right font-mono text-xl font-semibold text-white">
                    Total: {detalle.totalBs.toFixed(2)} Bs
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No se pudo cargar el detalle.</p>
              )}
            </div>
            <div className="border-t border-white/10 p-4">
              <button
                type="button"
                disabled={!detalle || imprimiendo}
                onClick={() => void imprimirYRegistrar()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {imprimiendo ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Printer className="h-4 w-4" aria-hidden />
                )}
                Imprimir cotización
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
