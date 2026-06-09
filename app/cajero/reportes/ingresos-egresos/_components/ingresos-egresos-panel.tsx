"use client";

import { CajaMovimientoForm } from "@/app/cajero/reportes/ingresos-egresos/_components/caja-movimiento-form";
import { formatoMostrarFechaBo, formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Movimiento = {
  id: number;
  tipo: "ingreso" | "egreso";
  detalle: string;
  montoBs: number;
  esCompraDolar: boolean;
  montoUsd: number | null;
  tipoCambioCompra: number | null;
  fecha: string;
  cajeroUsername: string;
};

type ReporteData = {
  fecha: string;
  sucursalNombre: string;
  tiendaCodigo: string;
  cajeroUsername: string;
  cajeroNombre: string;
  movimientos: Movimiento[];
};

type CajaSolicitud = {
  id: number;
  tipo: "devolucion" | "cambio";
  estado: "pendiente" | "aprobada" | "rechazada" | "registrada";
  cajeroUsuarioId: number;
  cajeroUsername: string;
  cajeroNombre: string;
  codigoDevuelto: string;
  nombreDevuelto: string | null;
  cantidadDevuelta: number;
  montoDevueltoBs: number;
  codigoEntregado: string | null;
  nombreEntregado: string | null;
  cantidadEntregada: number | null;
  montoEntregadoBs: number | null;
  notaCajero: string | null;
  notaAdmin: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtBs(n: number): string {
  return round2(n).toFixed(2);
}

function fmtBsEntero(n: number): string {
  const r = round2(n);
  return Number.isInteger(r) ? String(Math.trunc(r)) : r.toFixed(2);
}

function fmtUsd(n: number): string {
  return round2(n).toFixed(2);
}

function celdaCDolar(m: Movimiento): string {
  if (!m.esCompraDolar || m.montoUsd == null || m.montoUsd <= 0) return "";
  return fmtUsd(m.montoUsd);
}

function labelFechaReporte(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-BO", { ...formatoMostrarFechaBo });
}

function labelFechaLarga(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-BO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/La_Paz",
  });
}

function labelFechaDoc(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

function buildReporteHtml(data: ReporteData): string {
  const origin = globalThis.window?.location?.origin ?? "";
  const logoSrc = escHtml(`${origin}/img/logo.png`);
  const nroDoc = escHtml(data.cajeroUsername.trim() || "—");
  const fechaDoc = escHtml(labelFechaDoc(data.fecha));
  const tienda = escHtml(data.tiendaCodigo);
  const cajeroNombre = escHtml(data.cajeroNombre.trim() || data.cajeroUsername.trim() || "—");
  const fechaLarga = escHtml(labelFechaLarga(data.fecha));
  const fechaImp = escHtml(new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo));

  let totalIngreso = 0;
  let totalEgreso = 0;
  let totalCDolar = 0;

  const filasMov = data.movimientos.map((m) => {
    const ing = m.tipo === "ingreso" ? m.montoBs : 0;
    const egr = m.tipo === "egreso" ? m.montoBs : 0;
    const sub = round2(ing - egr);
    totalIngreso = round2(totalIngreso + ing);
    totalEgreso = round2(totalEgreso + egr);
    if (m.esCompraDolar && m.montoUsd != null) totalCDolar = round2(totalCDolar + m.montoUsd);
    const cd = celdaCDolar(m);
    const cdCell = cd
      ? `<span class="tc-val">${escHtml(cd)}</span>`
      : '<span class="chk"></span>';
    return `<tr>
      <td class="det">${escHtml(m.detalle)}</td>
      <td class="cd">${cdCell}</td>
      <td class="num">${ing > 0 ? fmtBs(ing) : "0.00"}</td>
      <td class="num">${egr > 0 ? fmtBs(egr) : "0.00"}</td>
      <td class="num sub">${sub >= 0 ? "" : ""}${fmtBs(sub)}</td>
    </tr>`;
  });

  const bodyRows =
    filasMov.length > 0
      ? filasMov.join("")
      : `<tr><td colspan="5" class="empty">Sin movimientos registrados para este día.</td></tr>`;

  const totalNeto = round2(totalIngreso - totalEgreso);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>INGRESOS Y EGRESOS DEL DÍA</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; margin: 0; padding: 14mm 16mm; color: #000; font-size: 11pt; line-height: 1.25; }
    .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
    .logo-box { width: 72px; height: 72px; border: 1px solid #333; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .meta { border: 1px solid #333; padding: 6px 10px; font-size: 10pt; min-width: 200px; }
    .meta div { margin: 2px 0; }
    .meta b { display: inline-block; min-width: 72px; }
    .titulo-wrap { text-align: center; margin: 10px 0 6px; }
    .titulo { font-size: 14pt; font-weight: 700; text-decoration: underline; text-transform: uppercase; letter-spacing: 0.02em; }
    .cajero-line { font-size: 11pt; margin-bottom: 10px; }
    table.mov { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.mov th, table.mov td { border: 1px solid #333; padding: 5px 7px; vertical-align: top; }
    table.mov th { font-size: 9pt; font-weight: 700; text-align: center; text-transform: uppercase; background: #f0f0f0; }
    table.mov td.det { text-align: left; font-size: 10pt; }
    table.mov td.cd { text-align: center; width: 56px; }
    table.mov td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; width: 88px; }
    table.mov td.empty { text-align: center; color: #555; padding: 16px; }
    .chk { display: inline-block; width: 14px; height: 14px; border: 1px solid #333; vertical-align: middle; }
    .tc-val { font-size: 9pt; font-variant-numeric: tabular-nums; font-weight: 600; }
    .venta-linea td { font-size: 9.5pt; }
    .venta-total td { font-weight: 600; }
    .bottom { display: flex; justify-content: flex-end; margin-top: 14px; }
    .totales { border: 1px solid #333; padding: 8px 12px; min-width: 240px; font-size: 10.5pt; }
    .totales div { display: flex; justify-content: space-between; gap: 16px; margin: 4px 0; }
    .totales .total-final { font-weight: 700; margin-top: 6px; padding-top: 4px; border-top: 1px solid #333; }
    .firmas { display: flex; justify-content: space-between; margin-top: 36px; gap: 24px; font-size: 10.5pt; }
    .firma { flex: 1; }
    .firma .linea { border-bottom: 1px solid #333; height: 28px; margin: 6px 0 4px; }
    .foot { display: flex; justify-content: space-between; margin-top: 28px; font-size: 9pt; color: #333; }
    @media print {
      @page { size: A4 portrait; margin: 12mm; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="top">
    <div class="logo-box"><img src="${logoSrc}" alt="" /></div>
    <div class="meta">
      <div><b>NRO. DOC.:</b> ${nroDoc}</div>
      <div><b>FECHA:</b> ${fechaDoc}</div>
      <div><b>TIENDA:</b> ${tienda}</div>
    </div>
  </div>
  <div class="titulo-wrap">
    <div class="titulo">INGRESOS Y EGRESOS DEL DÍA</div>
  </div>
  <p class="cajero-line"><b>Cajero:</b> ${cajeroNombre}</p>
  <table class="mov">
    <thead>
      <tr>
        <th>DETALLE</th>
        <th>C_DOLAR</th>
        <th>INGRESOS</th>
        <th>EGRESOS</th>
        <th>SUB_TOTAL</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="bottom">
    <div class="totales">
      <div><span>TOTAL C_DÓLAR:</span><span>${fmtUsd(totalCDolar)} USD</span></div>
      <div><span>TOTAL INGRESO:</span><span>${fmtBsEntero(totalIngreso)} Bs.</span></div>
      <div><span>TOTAL EGRESO:</span><span>${fmtBsEntero(totalEgreso)} Bs.</span></div>
      <div class="total-final"><span>TOTAL:</span><span>${fmtBsEntero(totalNeto)} Bs.</span></div>
    </div>
  </div>
  <div class="firmas">
    <div class="firma">
      <div>RECIBIDO POR:</div>
      <div class="linea"></div>
    </div>
    <div class="firma">
      <div>ENTREGADO POR:</div>
      <div class="linea">${cajeroNombre}</div>
    </div>
  </div>
  <footer class="foot">
    <span>${fechaLarga}</span>
    <span>Impreso: ${fechaImp} · Página 1 de 1</span>
  </footer>
</body>
</html>`;
}

export function IngresosEgresosPanel({ fecha }: { fecha: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [docPrintErr, setDocPrintErr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [data, setData] = useState<ReporteData | null>(null);
  const [solicitudes, setSolicitudes] = useState<CajaSolicitud[]>([]);
  const [registrandoSolicitudId, setRegistrandoSolicitudId] = useState<number | null>(null);

  const [tipoCambioRef, setTipoCambioRef] = useState<number | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ fecha: fecha.trim(), _t: String(Date.now()) });
      const res = await fetch(`/api/cajero/caja-movimientos?${q}`, { cache: "no-store" });
      const json = (await res.json()) as ReporteData & {
        error?: string;
        tipoCambioReferencia?: { valorBsPorUsd: number } | null;
      };
      if (!res.ok) {
        setData(null);
        setErr(json.error ?? "No se pudieron cargar los movimientos.");
        return;
      }
      const refTc = json.tipoCambioReferencia?.valorBsPorUsd;
      if (refTc != null && Number.isFinite(refTc) && refTc > 0) {
        setTipoCambioRef(refTc);
      }
      setData({
        fecha: json.fecha ?? fecha,
        sucursalNombre: json.sucursalNombre ?? "",
        tiendaCodigo: json.tiendaCodigo ?? "",
        cajeroUsername: json.cajeroUsername?.trim() ?? "",
        cajeroNombre: json.cajeroNombre?.trim() ?? json.cajeroUsername?.trim() ?? "",
        movimientos: Array.isArray(json.movimientos) ? json.movimientos : [],
      });

      try {
        const rs = await fetch(`/api/cajero/caja-solicitudes?${q}`, { cache: "no-store" });
        const js = (await rs.json()) as { error?: string; solicitudes?: CajaSolicitud[] };
        if (rs.ok) {
          setSolicitudes(Array.isArray(js.solicitudes) ? js.solicitudes : []);
        }
      } catch {
        // no-op
      }
    } catch {
      setData(null);
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const resumen = useMemo(() => {
    let ing = 0;
    let egr = 0;
    let totalCDolar = 0;
    for (const m of data?.movimientos ?? []) {
      if (m.tipo === "ingreso") ing = round2(ing + m.montoBs);
      else egr = round2(egr + m.montoBs);
      if (m.esCompraDolar && m.montoUsd != null) totalCDolar = round2(totalCDolar + m.montoUsd);
    }
    return {
      ing,
      egr,
      totalCDolar,
      neto: round2(ing - egr),
    };
  }, [data]);

  const imprimirReporte = () => {
    if (!data) return;
    setDocPrintErr(null);
    setPrinting(true);
    try {
      const html = buildReporteHtml(data);
      imprimirHtml(html, setDocPrintErr);
    } catch {
      setDocPrintErr("No se pudo generar el reporte.");
    } finally {
      setPrinting(false);
    }
  };

  const fechaLabel = labelFechaReporte(fecha);

  const registrarSolicitudAprobada = async (id: number) => {
    setRegistrandoSolicitudId(id);
    setErr(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/cajero/caja-solicitudes/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(json.error ?? "No se pudo registrar la solicitud.");
        return;
      }
      setOkMsg("Solicitud registrada en caja.");
      await cargar();
    } catch {
      setErr("Error de red al registrar.");
    } finally {
      setRegistrandoSolicitudId(null);
    }
  };

  return (
    <div className="space-y-6">
      {err ? (
        <p className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100" role="alert">
          {err}
        </p>
      ) : null}
      {okMsg ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-100">
          {okMsg}
        </p>
      ) : null}
      {docPrintErr ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-sm text-amber-100" role="alert">
          {docPrintErr}
        </p>
      ) : null}

      <CajaMovimientoForm
        fechaLabel={fechaLabel}
        tipoCambioRef={tipoCambioRef}
        onRegistered={cargar}
        onError={setErr}
        onOk={setOkMsg}
      />

      {solicitudes.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 ring-1 ring-white/5">
          <h2 className="text-sm font-semibold text-white">Solicitudes (devoluciones / cambios)</h2>
          <p className="mt-1 text-xs text-slate-400">
            El administrador debe aprobar o rechazar. Cuando esté aprobada, podés registrarla en caja.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Devuelto</th>
                  <th className="px-3 py-2">Entregado</th>
                  <th className="px-3 py-2">Nota admin</th>
                  <th className="px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map((s) => (
                  <tr key={s.id} className="border-b border-white/5 text-slate-200 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-slate-400">{s.id}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          s.estado === "pendiente"
                            ? "bg-amber-500/15 text-amber-200"
                            : s.estado === "aprobada"
                              ? "bg-emerald-500/15 text-emerald-200"
                              : s.estado === "rechazada"
                                ? "bg-rose-500/15 text-rose-200"
                                : "bg-slate-500/15 text-slate-200"
                        }`}
                      >
                        {s.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2 capitalize">{s.tipo}</td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-slate-300">{s.codigoDevuelto}</div>
                      <div className="text-xs">{s.nombreDevuelto ?? "—"}</div>
                      <div className="text-[11px] text-slate-500">
                        Cant: {s.cantidadDevuelta} · Bs {fmtBs(s.montoDevueltoBs)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {s.tipo === "cambio" ? (
                        <>
                          <div className="font-mono text-xs text-slate-300">{s.codigoEntregado ?? "—"}</div>
                          <div className="text-xs">{s.nombreEntregado ?? "—"}</div>
                          <div className="text-[11px] text-slate-500">
                            Cant: {s.cantidadEntregada ?? 1} · Bs {fmtBs(s.montoEntregadoBs ?? 0)}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{s.notaAdmin ?? "—"}</td>
                    <td className="px-3 py-2">
                      {s.estado === "aprobada" ? (
                        <button
                          type="button"
                          onClick={() => void registrarSolicitudAprobada(s.id)}
                          disabled={registrandoSolicitudId === s.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {registrandoSolicitudId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          Registrar en caja
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">
          Movimientos del día
          {data?.tiendaCodigo ? (
            <span className="ml-2 font-normal text-slate-400">({data.tiendaCodigo})</span>
          ) : null}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={imprimirReporte}
            disabled={loading || printing || !data}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir reporte del día
          </button>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando…
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Detalle</th>
                  <th className="w-16 px-2 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Monto Bs</th>
                  <th className="px-3 py-2 text-right">C$ (USD)</th>
                </tr>
              </thead>
              <tbody>
                {(data?.movimientos ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      Sin movimientos para este día.
                    </td>
                  </tr>
                ) : null}
                {(data?.movimientos ?? []).map((m) => (
                    <tr key={m.id} className="border-b border-white/5 text-slate-200">
                      <td className="px-3 py-2">{m.detalle}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-slate-500">—</td>
                      <td className="px-3 py-2 capitalize">
                        <span
                          className={
                            m.tipo === "ingreso" ? "text-emerald-300" : "text-rose-300"
                          }
                        >
                          {m.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">
                        {fmtBs(m.montoBs)}
                        {m.esCompraDolar && m.montoUsd != null ? (
                          <span className="block text-[10px] text-slate-500">
                            {m.montoUsd.toFixed(2)} USD
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-amber-200/90">
                        {m.esCompraDolar && m.montoUsd != null ? fmtUsd(m.montoUsd) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-slate-500">Total ingresos</span>
              <p className="font-mono text-lg text-emerald-200">{fmtBs(resumen.ing)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">Total egresos</span>
              <p className="font-mono text-lg text-rose-200">{fmtBs(resumen.egr)} Bs</p>
            </div>
            <div>
              <span className="text-slate-500">Total C$ (USD comprados)</span>
              <p className="font-mono text-lg text-amber-200">{fmtUsd(resumen.totalCDolar)} USD</p>
            </div>
            <div>
              <span className="text-slate-500">Neto del día</span>
              <p className="font-mono text-lg font-semibold text-white">{fmtBs(resumen.neto)} Bs</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
