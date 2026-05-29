"use client";

import { formatDateTimeMysqlBolivia, formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { CheckCircle2, Loader2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type VentaPendiente = {
  id: number;
  fecha: string;
  totalBs: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  vendedorNombre: string;
  cajeroAsignadoNombre: string | null;
  cantidadItems: number;
};

type VentaDetalle = {
  id: number;
  fecha: string;
  totalBs: number;
  clienteNombre: string | null;
  clienteNit: string | null;
  vendedorNombre: string;
  lineas: {
    codigo: string;
    nombre: string;
    medida: string | null;
    cantidad: number;
    precioUnitarioBs: number;
    totalLineaBs: number;
  }[];
};

function labelPago(tipo: "efectivo" | "qr" | "tarjeta"): string {
  if (tipo === "efectivo") return "Efectivo";
  if (tipo === "qr") return "QR";
  return "Tarjeta";
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function buildNotaVentaHtml(input: {
  detalle: VentaDetalle;
  tipoPago: "efectivo" | "qr" | "tarjeta";
  sucursalNombre: string;
  cajeroUsername: string;
}): string {
  const fechaImp = escHtml(new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo));
  const filas = input.detalle.lineas
    .map(
      (ln) => `<tr>
      <td class="mono">${escHtml(ln.codigo)}</td>
      <td>${escHtml(ln.nombre)}${ln.medida ? ` <span class="muted">(${escHtml(ln.medida)})</span>` : ""}</td>
      <td class="num mono">${ln.cantidad}</td>
      <td class="num mono">${ln.precioUnitarioBs.toFixed(2)}</td>
      <td class="num mono">${ln.totalLineaBs.toFixed(2)}</td>
    </tr>`
    )
    .join("");

  const clienteBlock =
    input.detalle.clienteNombre || input.detalle.clienteNit
      ? `<div class="block">
          ${input.detalle.clienteNombre ? `<p>Cliente: ${escHtml(input.detalle.clienteNombre)}</p>` : ""}
          ${input.detalle.clienteNit ? `<p class="mono">NIT: ${escHtml(input.detalle.clienteNit)}</p>` : ""}
        </div>`
      : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Nota de venta</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.35; color: #0f172a; margin: 10mm 12mm; }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .sub { font-size: 10px; color: #475569; }
    .block { margin: 8px 0; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1; font-size: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
    th, td { border: 1px solid #94a3b8; padding: 4px 6px; vertical-align: top; }
    th { background: #f1f5f9; text-align: left; }
    .num { text-align: right; }
    .mono { font-family: ui-monospace, monospace; }
    .muted { color: #64748b; }
    .total { margin-top: 12px; display: flex; justify-content: space-between; border-top: 2px solid #0f172a; padding-top: 8px; font-weight: 700; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Nota de venta</h1>
  <p class="sub mono">Tipo nota: proforma_1</p>
  <p class="sub"><strong>${escHtml(input.sucursalNombre)}</strong></p>
  <p class="sub mono">${fechaImp}</p>
  <p class="sub">Vendedor: ${escHtml(input.detalle.vendedorNombre)} · Cajero: ${escHtml(input.cajeroUsername)}</p>
  ${clienteBlock}
  <p class="sub"><strong>Forma de pago:</strong> ${escHtml(labelPago(input.tipoPago))}</p>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Descripción</th>
        <th class="num">Cant.</th>
        <th class="num">P. unit. Bs</th>
        <th class="num">Subt. Bs</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="total">
    <span>TOTAL</span>
    <span class="mono">${input.detalle.totalBs.toFixed(2)} Bs</span>
  </div>
</body>
</html>`;
}

export function CobrosVendedorPanel({
  sucursalNombre,
  cajeroUsername,
}: {
  sucursalNombre: string;
  cajeroUsername: string;
}) {
  const [filtrarPorDia, setFiltrarPorDia] = useState(false);
  const [fechaDia, setFechaDia] = useState(() => formatDateTimeMysqlBolivia(new Date()).slice(0, 10));
  const [rows, setRows] = useState<VentaPendiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [tipoPago, setTipoPago] = useState<"efectivo" | "qr" | "tarjeta">("efectivo");
  const [cobrando, setCobrando] = useState(false);
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
      const res = await fetch(`/api/cajero/ventas-pendientes?${q.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as { rows?: VentaPendiente[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo cargar la lista.");
        if (!silent) setRows([]);
        return;
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch {
      setError("Error de red.");
      if (!silent) setRows([]);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [filtrarPorDia, fechaDia]);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  /** Actualización automática para ver envíos del vendedor sin recargar la página. */
  useEffect(() => {
    if (detalleId != null) return;
    const pollMs = 3000;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void cargarLista({ silent: true });
      }
    }, pollMs);
    return () => window.clearInterval(id);
  }, [cargarLista, detalleId]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void cargarLista({ silent: true });
      }
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [cargarLista]);

  const abrirDetalle = useCallback(async (ventaId: number) => {
    setDetalleId(ventaId);
    setDetalle(null);
    setDetalleLoading(true);
    setMsg(null);
    setTipoPago("efectivo");
    try {
      const res = await fetch(`/api/cajero/ventas-pendientes?ventaId=${ventaId}`, { cache: "no-store" });
      const data = (await res.json()) as { detalle?: VentaDetalle; error?: string };
      if (!res.ok || !data.detalle) {
        setMsg({ type: "err", text: data.error ?? "No se pudo cargar el detalle." });
        setDetalleId(null);
        return;
      }
      setDetalle(data.detalle);
    } catch {
      setMsg({ type: "err", text: "Error de red al cargar detalle." });
      setDetalleId(null);
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  async function confirmarCobro() {
    if (!detalle) return;
    setCobrando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cajero/ventas-pendientes/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventaId: detalle.id, tipoPago }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg({ type: "err", text: data.error ?? "No se pudo registrar el cobro." });
        return;
      }
      const snapshot = detalle;
      const pago = tipoPago;
      imprimirHtml(
        buildNotaVentaHtml({
          detalle: snapshot,
          tipoPago: pago,
          sucursalNombre,
          cajeroUsername,
        }),
        (err) => setMsg({ type: "err", text: err })
      );
      setMsg({ type: "ok", text: `Venta #${snapshot.id} cobrada (${labelPago(pago)}).` });
      setDetalleId(null);
      setDetalle(null);
      void cargarLista();
    } catch {
      setMsg({ type: "err", text: "Error de red al cobrar." });
    } finally {
      setCobrando(false);
    }
  }

  const totalPendiente = useMemo(
    () => rows.reduce((s, r) => s + r.totalBs, 0),
    [rows]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={filtrarPorDia}
              onChange={(e) => setFiltrarPorDia(e.target.checked)}
              className="rounded border-white/20 bg-slate-900 text-emerald-500"
            />
            Solo ventas de un día
          </label>
          {filtrarPorDia ? (
            <div>
              <label htmlFor="cobros-fecha-dia" className="block text-[10px] font-semibold uppercase text-slate-500">
                Fecha
              </label>
              <input
                id="cobros-fecha-dia"
                type="date"
                value={fechaDia}
                onChange={(e) => setFechaDia(e.target.value)}
                className="mt-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">Mostrando todas las ventas pendientes de cobro en tu sucursal.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void cargarLista()}
          disabled={loading || refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {msg ? (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            msg.type === "ok"
              ? "border-emerald-500/35 bg-emerald-950/30 text-emerald-100"
              : "border-rose-500/35 bg-rose-950/30 text-rose-100"
          }`}
          role="status"
        >
          {msg.text}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <p className="border-b border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-500">
          {loading ? (
            "Cargando…"
          ) : (
            <>
              {refreshing ? (
                <span className="mr-2 inline-flex items-center gap-1 text-emerald-400/90">
                  <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                  Actualizando
                </span>
              ) : null}
              {rows.length} venta{rows.length === 1 ? "" : "s"} pendiente{rows.length === 1 ? "" : "s"}
              {filtrarPorDia ? (
                <>
                  {" "}
                  del <span className="font-mono text-slate-300">{fechaDia}</span>
                </>
              ) : (
                " en tu sucursal"
              )}
              {rows.length > 0 ? (
                <span className="ml-2 font-mono text-emerald-200/90">· {totalPendiente.toFixed(2)} Bs</span>
              ) : null}
            </>
          )}
        </p>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
            <span className="text-sm">Cargando ventas…</span>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            {filtrarPorDia
              ? "No hay ventas pendientes de cobro para este día."
              : "No hay ventas pendientes de cobro en tu sucursal."}
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Vendedor</th>
                <th className="px-4 py-3 font-medium">Cajero</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium text-right">Ítems</th>
                <th className="px-4 py-3 font-medium text-right">Total Bs</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.fecha.replace(" ", "T") + "-04:00").toLocaleString("es-BO", formatoMostrarFechaHoraBo)}
                  </td>
                  <td className="px-4 py-3">{r.vendedorNombre}</td>
                  <td className="px-4 py-3 text-slate-400">{r.cajeroAsignadoNombre ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.clienteNombre ?? "—"}
                    {r.clienteNit ? (
                      <span className="mt-0.5 block font-mono text-[11px] text-slate-500">NIT {r.clienteNit}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.cantidadItems}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-200">
                    {r.totalBs.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void abrirDetalle(r.id)}
                      className="inline-flex rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-100 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
                    >
                      Cobrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detalleId != null ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cobro-venta-titulo"
        >
          <div className="flex max-h-[min(94vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-emerald-950/20 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 id="cobro-venta-titulo" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  Cobrar venta #{detalleId}
                </h2>
                {detalle ? (
                  <div className="mt-2 space-y-1 text-sm text-slate-300 sm:text-base">
                    <p>
                      <span className="text-slate-500">Vendedor:</span> {detalle.vendedorNombre}
                    </p>
                    {detalle.clienteNombre ? (
                      <p>
                        <span className="text-slate-500">Cliente:</span> {detalle.clienteNombre}
                        {detalle.clienteNit ? (
                          <span className="ml-2 font-mono text-sm text-slate-400">NIT {detalle.clienteNit}</span>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-xl p-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
                onClick={() => {
                  setDetalleId(null);
                  setDetalle(null);
                }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              {detalleLoading || !detalle ? (
                <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  <span className="text-base">Cargando detalle…</span>
                </div>
              ) : (
                <>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    {detalle.lineas.length} producto{detalle.lineas.length === 1 ? "" : "s"}
                  </p>
                  <ul className="space-y-3">
                    {detalle.lineas.map((ln, i) => (
                      <li
                        key={`${ln.codigo}-${i}`}
                        className="rounded-xl border border-white/10 bg-slate-900/50 p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-sm font-medium text-emerald-300/90 sm:text-base">{ln.codigo}</p>
                            <p className="mt-1.5 text-base font-medium leading-snug text-white sm:text-lg">{ln.nombre}</p>
                            {ln.medida ? (
                              <p className="mt-1 text-sm leading-relaxed text-slate-400 sm:text-base">{ln.medida}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-row items-end justify-between gap-6 border-t border-white/10 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0 sm:text-right">
                            <div className="text-sm text-slate-400 sm:text-base">
                              <span className="tabular-nums text-slate-200">{ln.cantidad}</span>
                              <span className="mx-1.5 text-slate-600">×</span>
                              <span className="font-mono tabular-nums text-slate-300">
                                {ln.precioUnitarioBs.toFixed(2)} Bs
                              </span>
                            </div>
                            <p className="font-mono text-lg font-semibold tabular-nums text-slate-100 sm:text-xl">
                              {ln.totalLineaBs.toFixed(2)} Bs
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 to-slate-950/50 px-5 py-4 sm:px-6 sm:py-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Total a cobrar</p>
                    <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-50 sm:text-4xl">
                      {detalle.totalBs.toFixed(2)}{" "}
                      <span className="text-lg font-normal text-slate-400 sm:text-xl">Bs</span>
                    </p>
                  </div>
                </>
              )}
            </div>

            {detalle ? (
              <div className="flex flex-col gap-4 border-t border-white/10 bg-slate-900/40 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <label
                    htmlFor="cobro-tipo-pago"
                    className="text-sm font-semibold uppercase tracking-wide text-slate-400"
                  >
                    Forma de pago
                  </label>
                  <select
                    id="cobro-tipo-pago"
                    className="min-w-[11rem] rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-base text-white outline-none focus:border-emerald-500/40"
                    value={tipoPago}
                    onChange={(e) => setTipoPago(e.target.value as typeof tipoPago)}
                  >
                    <option value="efectivo">Efectivo</option>
                    <option value="qr">QR</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={cobrando}
                  onClick={() => void confirmarCobro()}
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-6 py-3.5 text-base font-semibold text-slate-950 shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
                >
                  {cobrando ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Confirmar cobro
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
