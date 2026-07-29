"use client";

import {
  ClienteCreditosCajeroBuscador,
  type ClienteCreditosCajeroSeleccionado,
} from "@/app/cajero/reportes/creditos/_components/cliente-creditos-cajero-buscador";
import { CreditosCobrosPanel } from "@/app/cajero/reportes/creditos/_components/creditos-cobros-panel";
import { formatIsoDateOnlyBo, formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import {
  buildReporteCreditosPendientesHtml,
  openReporteCreditosPendientesPrint,
} from "@/lib/reportes/reporte-creditos-pendientes-html";
import { openNotaEntregaPrint } from "@/lib/reportes/nota-entrega-html";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type CreditoRow = {
  creditoId: number;
  ventaId: number;
  numeroDocumento: string | null;
  clienteNombre: string;
  vendedorNombre: string;
  fechaLimite: string;
  montoTotalBs: number;
  saldoPendienteBs: number;
  estado: "pendiente" | "vencido" | "pagado";
  diasVencido: number;
};

export function CreditosCajeroPanel() {
  const [tab, setTab] = useState<"pendientes" | "cobros">("pendientes");
  const [cobrosRefreshKey, setCobrosRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [clienteFiltro, setClienteFiltro] = useState<ClienteCreditosCajeroSeleccionado | null>(null);
  const [rows, setRows] = useState<CreditoRow[]>([]);
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [docPrintErr, setDocPrintErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [reimprimiendoVentaId, setReimprimiendoVentaId] = useState<number | null>(null);
  const [pagoRow, setPagoRow] = useState<CreditoRow | null>(null);
  const [tipoPago, setTipoPago] = useState<"efectivo" | "qr" | "tarjeta">("efectivo");
  const [pagando, setPagando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ _t: String(Date.now()) });
      if (soloVencidos) q.set("vencidos", "1");
      if (clienteFiltro?.id) q.set("clienteId", String(clienteFiltro.id));
      const res = await fetch(`/api/cajero/creditos?${q}`, { cache: "no-store" });
      const data = (await res.json()) as {
        creditos?: CreditoRow[];
        sucursalNombre?: string;
        error?: string;
      };
      if (!res.ok) {
        setRows([]);
        setErr(data.error ?? "No se pudieron cargar los créditos.");
        return;
      }
      setSucursalNombre(data.sucursalNombre?.trim() ?? "");
      setRows(Array.isArray(data.creditos) ? data.creditos : []);
    } catch {
      setRows([]);
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [soloVencidos, clienteFiltro?.id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function registrarPago() {
    if (pagoRow == null) return;
    setPagando(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cajero/creditos/pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditoId: pagoRow.creditoId,
          tipoPago,
        }),
      });
      const data = (await res.json()) as { error?: string; montoBs?: number };
      if (!res.ok) {
        setMsg(data.error ?? "No se pudo registrar el pago.");
        return;
      }
      const monto = Number(data.montoBs ?? pagoRow.saldoPendienteBs);
      setMsg(
        `Crédito cobrado (${monto.toFixed(2)} Bs). El cliente puede volver a comprar a crédito si no tiene otros vencidos.`
      );
      setPagoRow(null);
      setCobrosRefreshKey((k) => k + 1);
      setTab("cobros");
      void cargar();
    } catch {
      setMsg("Error de red al registrar el pago.");
    } finally {
      setPagando(false);
    }
  }

  async function reimprimirNotaEntrega(ventaId: number) {
    setDocPrintErr(null);
    setMsg(null);
    setReimprimiendoVentaId(ventaId);
    try {
      const res = await fetch(`/api/cajero/creditos/nota-entrega?ventaId=${ventaId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        nota?: Parameters<typeof openNotaEntregaPrint>[0];
        error?: string;
      };
      if (!res.ok || !data.nota) {
        setDocPrintErr(data.error ?? "No se pudo cargar la nota de entrega.");
        return;
      }
      const pr = openNotaEntregaPrint(data.nota);
      if (!pr.ok) setDocPrintErr(pr.message);
    } catch {
      setDocPrintErr("Error de red al reimprimir la nota.");
    } finally {
      setReimprimiendoVentaId(null);
    }
  }

  function labelFiltroReporte(): string {
    const partes: string[] = [];
    if (clienteFiltro) partes.push(`Cliente: ${clienteFiltro.nombre}`);
    if (soloVencidos) partes.push("Solo vencidos");
    return partes.length > 0 ? partes.join(" · ") : "Todos los pendientes de cobro";
  }

  function imprimirReporte() {
    if (typeof document === "undefined") return;
    setDocPrintErr(null);
    setPrinting(true);
    try {
      const origin = globalThis.window?.location?.origin ?? "";
      const html = buildReporteCreditosPendientesHtml({
        origin,
        sucursalNombre,
        filtroLabel: labelFiltroReporte(),
        filas: rows.map((r) => ({
          clienteNombre: r.clienteNombre,
          vendedorNombre: r.vendedorNombre,
          fechaLimite: r.fechaLimite,
          saldoPendienteBs: r.saldoPendienteBs,
          estado: r.estado,
          diasVencido: r.diasVencido,
        })),
        fechaImpresion: new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo),
      });
      const r = openReporteCreditosPendientesPrint(html);
      if (!r.ok) setDocPrintErr(r.message);
    } catch {
      setDocPrintErr("No se pudo generar el reporte.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setTab("pendientes")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "pendientes"
              ? "bg-teal-600 text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          Pendientes de cobro
        </button>
        <button
          type="button"
          onClick={() => setTab("cobros")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            tab === "cobros"
              ? "bg-teal-600 text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
          }`}
        >
          Cobros realizados
        </button>
      </div>

      {err ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{err}</p>
      ) : null}
      {msg ? (
        <p className="rounded-xl border border-emerald-500/35 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </p>
      ) : null}

      {tab === "cobros" ? <CreditosCobrosPanel refreshKey={cobrosRefreshKey} /> : null}

      {tab === "pendientes" ? (
        <>
      <p className="text-sm text-slate-400">
        Cobrá aquí los créditos ya entregados. Cada venta a crédito se paga en{" "}
        <strong className="font-medium text-slate-300">un solo pago</strong> por el total, dentro de{" "}
        <strong className="font-medium text-slate-300">un mes</strong>. Si vence sin pagar, el cliente queda
        bloqueado hasta que el administrador lo reactive. El cobro queda como ingreso en{" "}
        <strong className="font-medium text-slate-300">Ingresos / egresos</strong> del día. Los pendientes
        se imprimen aquí (no en el arqueo general).
      </p>

      {docPrintErr ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100" role="alert">
          {docPrintErr}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <ClienteCreditosCajeroBuscador value={clienteFiltro} onChange={setClienteFiltro} disabled={loading} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={soloVencidos}
            onChange={(e) => setSoloVencidos(e.target.checked)}
            className="rounded border-white/20"
          />
          Solo vencidos
        </label>
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
          Imprimir pendientes
        </button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {clienteFiltro
            ? `No hay créditos pendientes para ${clienteFiltro.nombre}${soloVencidos ? " (solo vencidos)" : ""}.`
            : soloVencidos
              ? "No hay créditos vencidos pendientes de cobro."
              : "No hay créditos pendientes de cobro."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Vendedor</th>
                <th className="px-3 py-2">Vence</th>
                <th className="px-3 py-2 text-right">Total Bs</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.creditoId} className="border-b border-white/5 text-slate-200">
                  <td className="px-3 py-2">
                    {r.clienteNombre}
                    {r.estado === "vencido" ? (
                      <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200">
                        Vencido {r.diasVencido}d
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{r.vendedorNombre}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{formatIsoDateOnlyBo(r.fechaLimite)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{r.saldoPendienteBs.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={reimprimiendoVentaId === r.ventaId}
                        title="Reimprimir nota de entrega (si se acabó el papel)"
                        onClick={() => void reimprimirNotaEntrega(r.ventaId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/40 hover:bg-emerald-950/40 disabled:opacity-50"
                      >
                        {reimprimiendoVentaId === r.ventaId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Printer className="h-3.5 w-3.5" />
                        )}
                        Reimprimir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPagoRow(r);
                          setMsg(null);
                        }}
                        className="rounded-lg bg-teal-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
                      >
                        Cobrar total
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagoRow != null ? (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-4">
          <h3 className="font-semibold text-white">Cobrar crédito — {pagoRow.clienteNombre}</h3>
          <p className="mt-1 text-sm text-slate-400">
            Pago único por el total de la venta. Vence el{" "}
            <span className="text-slate-300">{formatIsoDateOnlyBo(pagoRow.fechaLimite)}</span>.
          </p>
          <p className="mt-2 text-lg font-semibold tabular-nums text-teal-100">
            {pagoRow.saldoPendienteBs.toFixed(2)} Bs
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] uppercase text-slate-500">Forma de pago</label>
              <select
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value as typeof tipoPago)}
                className="mt-1 block rounded border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="efectivo">Efectivo</option>
                <option value="qr">QR</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <button
              type="button"
              disabled={pagando}
              onClick={() => void registrarPago()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pagando ? "Guardando…" : "Confirmar cobro total"}
            </button>
            <button
              type="button"
              onClick={() => setPagoRow(null)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
        </>
      ) : null}
    </div>
  );
}
