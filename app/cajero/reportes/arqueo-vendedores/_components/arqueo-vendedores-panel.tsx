"use client";

import { formatoMostrarFechaBo, formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { Loader2, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type SalidasDocLinea = {
  fecha: string;
  ventaId: number;
  numeroDocumento: string | null;
  codigoRepuesto: string;
  medida: string;
  descripcion: string;
  cantidad: number;
  totalLineaBs: number;
  totalLineaUsd: number;
};

function formatFechaCelda(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-BO", formatoMostrarFechaBo);
}

/** Convierte YYYY-MM-DD a fecha corta es-BO (evita desfase UTC en solo-fecha). */
function labelPeriodoRango(d1: string, d2: string): string {
  const fmt = (d: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatFechaCelda(`${d}T12:00:00`) : d.trim() || "—";
  const a = fmt(d1);
  const b = fmt(d2);
  return d1 === d2 ? a : `${a} al ${b}`;
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
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [filas, setFilas] = useState<ArqueoFila[]>([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        desde: fechaDesde.trim(),
        hasta: fechaHasta.trim(),
      });
      const res = await fetch(`/api/cajero/arqueo-vendedores?${q}`, { cache: "no-store" });
      const data = (await res.json()) as {
        error?: string;
        sucursalNombre?: string;
        filas?: ArqueoFila[];
      };
      if (!res.ok) {
        setFilas([]);
        setErr(data.error ?? "No se pudo cargar el arqueo.");
        return;
      }
      setSucursalNombre(data.sucursalNombre?.trim() ?? "");
      setFilas(Array.isArray(data.filas) ? data.filas : []);
    } catch {
      setFilas([]);
      setErr("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const totales = useMemo(() => {
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
  }, [filas]);

  const imprimirResumenGeneralCaja = useCallback(() => {
    if (typeof document === "undefined") return;
    setDocPrintErr(null);
    setPrintingResumen(true);
    try {
      const fechaImp = new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo);
      const origin = globalThis.window?.location?.origin ?? "";
      const logoSrc = escHtml(`${origin}/img/logo.png`);
      const tienda = escHtml(sucursalNombre ? `Caja · ${sucursalNombre}` : "Caja");
      const per = escHtml(`Período: ${labelPeriodoRango(fechaDesde, fechaHasta)}`);
      const titulo = escHtml("ARQUEO GENERAL — RESUMEN POR VENDEDOR");
      const fi = escHtml(fechaImp);
      const t = totales;

      const bodyRows =
        filas.length === 0
          ? `<tr><td colspan="9" style="padding:14px;border:1px solid #ccc;text-align:center;color:#666">No hay vendedores activos en esta sucursal.</td></tr>`
          : filas
              .map(
                (f) => `<tr>
            <td style="padding:7px 9px;border:1px solid #ccc">${escHtml(f.nombreCompleto)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;font-family:ui-monospace,monospace;font-size:10px">${escHtml(f.username)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${f.cantidadVentas}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${round2(f.totalBs).toFixed(2)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${round4(f.totalUsd).toFixed(4)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${round2(f.bsEfectivo).toFixed(2)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${round2(f.bsQr).toFixed(2)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${round2(f.bsTarjeta).toFixed(2)}</td>
            <td style="padding:7px 9px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${round2(f.bsCredito).toFixed(2)}</td>
          </tr>`
              )
              .join("");

      const footRow =
        filas.length === 0
          ? ""
          : `<tr style="font-weight:700;background:#e5e7eb">
            <td style="padding:8px 10px;border:1px solid #999" colspan="2">TOTAL GENERAL (sucursal)</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.ventas}</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.bs.toFixed(2)}</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.usd.toFixed(4)}</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.ef.toFixed(2)}</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.qr.toFixed(2)}</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.tar.toFixed(2)}</td>
            <td style="padding:8px 10px;border:1px solid #999;text-align:right;font-variant-numeric:tabular-nums">${t.cred.toFixed(2)}</td>
          </tr>`;

      const docHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px 18px; color: #111; font-size: 12px; line-height: 1.4; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #111; padding-bottom: 10px; }
    .head-mid { flex: 1; text-align: center; }
    .marca { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .titulo { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; }
    .sub { margin-top: 6px; font-size: 11px; }
    .nota { margin-top: 10px; font-size: 10px; color: #444; }
    .logo { width: 72px; height: 52px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; background: #fafafa; }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table.items th { background: #e5e7eb; font-weight: 700; text-align: left; padding: 8px 9px; border: 1px solid #999; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
    table.items th.num { text-align: right; }
    table.items td { font-size: 11px; }
    .foot { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px; color: #333; }
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      body { padding: 0; font-size: 11px; }
      table.items th, table.items td { padding: 6px 7px; }
    }
  </style>
</head>
<body>
  <header class="head">
    <div class="logo"><img src="${logoSrc}" alt="" /></div>
    <div class="head-mid">
      <div class="marca">Repuestos</div>
      <div class="titulo">${titulo}</div>
      <div class="sub">${tienda}</div>
      <div class="sub">${per}</div>
    </div>
    <div style="width:72px"></div>
  </header>
  <p class="nota">Ventas confirmadas en el período. Una fila por vendedor activo de la sucursal; la última fila suma todos los montos.</p>
  <table class="items">
    <thead>
      <tr>
        <th>Vendedor</th>
        <th>Usuario</th>
        <th class="num">Nº ventas</th>
        <th class="num">Total Bs</th>
        <th class="num">Total USD</th>
        <th class="num">Efectivo Bs</th>
        <th class="num">QR Bs</th>
        <th class="num">Tarjeta Bs</th>
        <th class="num">Crédito Bs</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    ${footRow ? `<tfoot>${footRow}</tfoot>` : ""}
  </table>
  <footer class="foot">
    <span>${fi}</span>
    <span>Página 1 de 1</span>
  </footer>
</body>
</html>`;

      const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
      const objectUrl = URL.createObjectURL(blob);
      const w = globalThis.window?.open(objectUrl, "_blank");
      if (!w) {
        URL.revokeObjectURL(objectUrl);
        setDocPrintErr("No se pudo abrir la ventana de impresión (¿bloqueador de ventanas?).");
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
          setDocPrintErr("No se pudo abrir el cuadro de impresión.");
          teardown();
        }
      };
      if (w.document.readyState === "complete") {
        globalThis.setTimeout(doPrint, 120);
      } else {
        w.addEventListener("load", () => globalThis.setTimeout(doPrint, 120), { once: true });
      }
    } catch {
      setDocPrintErr("No se pudo generar el resumen para imprimir.");
    } finally {
      setPrintingResumen(false);
    }
  }, [filas, totales, sucursalNombre, fechaDesde, fechaHasta]);

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
        });
        const res = await fetch(`/api/cajero/arqueo-vendedores/salidas-documento?${q}`, { cache: "no-store" });
        const data = (await res.json()) as {
          error?: string;
          sucursalNombre?: string;
          vendedor?: { nombreCompleto: string; username: string };
          fechaDesde?: string;
          fechaHasta?: string;
          lineas?: SalidasDocLinea[];
          totales?: { totalBs: number; totalUsd: number };
        };
        if (!res.ok) {
          setDocPrintErr(data.error ?? "No se pudo generar el documento.");
          return;
        }
        const sucNom = data.sucursalNombre?.trim() ?? "";
        const vend = data.vendedor ?? { nombreCompleto: nombreVendedor, username: "" };
        const d1 = data.fechaDesde ?? "";
        const d2 = data.fechaHasta ?? "";
        const lineas = Array.isArray(data.lineas) ? data.lineas : [];
        const tot = data.totales ?? { totalBs: 0, totalUsd: 0 };
        const periodoLabel = labelPeriodoRango(d1, d2);
        const fechaImp = new Date().toLocaleString("es-BO", formatoMostrarFechaHoraBo);
        const origin = globalThis.window?.location?.origin ?? "";
        const logoSrc = escHtml(`${origin}/img/logo.png`);

        const bodyRows =
          lineas.length === 0
            ? `<tr><td colspan="7" style="padding:14px;border:1px solid #ccc;text-align:center;color:#666">Sin líneas de venta en el período seleccionado.</td></tr>`
            : lineas
                .map((ln) => {
                  const fp = escHtml(formatFechaCelda(ln.fecha));
                  const cr = escHtml(ln.codigoRepuesto);
                  const me = escHtml(ln.medida);
                  const de = escHtml(ln.descripcion);
                  const cant = Math.trunc(Number(ln.cantidad)) || 0;
                  const bs = round2(ln.totalLineaBs).toFixed(2);
                  const us = round4(ln.totalLineaUsd).toFixed(2);
                  return `<tr>
            <td style="padding:6px 8px;border:1px solid #ccc;white-space:nowrap">${fp}</td>
            <td style="padding:6px 8px;border:1px solid #ccc">${cr}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;font-size:10px">${me}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;font-size:10px">${de}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${cant}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${bs}</td>
            <td style="padding:6px 8px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${us}</td>
          </tr>`;
                })
                .join("");

        const titulo = escHtml("REPORTE DE SALIDAS DIARIAS");
        const tienda = escHtml(sucNom ? `Caja · ${sucNom}` : "Caja");
        const vendLine = escHtml(`Vendedor: ${vend.nombreCompleto}${vend.username ? ` (${vend.username})` : ""}`);
        const per = escHtml(`Período: ${periodoLabel}`);
        const totBs = round2(tot.totalBs).toFixed(2);
        const totUs = round4(tot.totalUsd).toFixed(2);
        const fi = escHtml(fechaImp);

        const docHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 16px 18px; color: #111; font-size: 11px; line-height: 1.35; }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #111; padding-bottom: 10px; }
    .head-mid { flex: 1; text-align: center; }
    .marca { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 4px; }
    .titulo { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    .sub { margin-top: 6px; font-size: 11px; }
    .logo { width: 72px; height: 52px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; background: #fafafa; }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { background: #e5e7eb; font-weight: 700; text-align: left; padding: 7px 8px; border: 1px solid #999; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
    table.items th.num { text-align: right; }
    table.items td { vertical-align: top; }
    .foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 14px; font-size: 10px; color: #333; }
    .tot { text-align: right; font-size: 12px; font-weight: 700; margin-top: 8px; }
    @media print {
      @page { size: A4 landscape; margin: 10mm; }
      body { padding: 0; font-size: 10px; }
      table.items th, table.items td { padding: 5px 6px; font-size: 9px; }
    }
  </style>
</head>
<body>
  <header class="head">
    <div class="logo"><img src="${logoSrc}" alt="" /></div>
    <div class="head-mid">
      <div class="marca">Repuestos</div>
      <div class="titulo">${titulo}</div>
      <div class="sub">${tienda}</div>
      <div class="sub">${vendLine}</div>
      <div class="sub">${per}</div>
    </div>
    <div style="width:72px"></div>
  </header>
  <table class="items">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>C_REP</th>
        <th>Medida</th>
        <th>Descripción</th>
        <th class="num">Cant.</th>
        <th class="num">S_Bs.</th>
        <th class="num">S_US</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="tot">TOTALES: ${escHtml(totBs)} Bs. · ${escHtml(totUs)} USD</div>
  <footer class="foot">
    <span>${fi}</span>
    <span>Página 1 de 1</span>
  </footer>
</body>
</html>`;

        const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const w = globalThis.window?.open(objectUrl, "_blank");
        if (!w) {
          URL.revokeObjectURL(objectUrl);
          setDocPrintErr("No se pudo abrir la ventana de impresión (¿bloqueador de ventanas?).");
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
            setDocPrintErr("No se pudo abrir el cuadro de impresión.");
            teardown();
          }
        };

        if (w.document.readyState === "complete") {
          globalThis.setTimeout(doPrint, 120);
        } else {
          w.addEventListener("load", () => globalThis.setTimeout(doPrint, 120), { once: true });
        }
      } catch {
        setDocPrintErr("Error de red al generar el documento.");
      } finally {
        setPrintingUsuarioId(null);
      }
    },
    [fechaDesde, fechaHasta]
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
          onClick={imprimirResumenGeneralCaja}
          disabled={loading || printingResumen}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/50 px-4 py-2.5 text-sm font-semibold text-emerald-100 shadow hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-50"
          title="Imprimir un solo documento con todos los vendedores y el total general de la sucursal"
        >
          {printingResumen ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
          Imprimir resumen general
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
          el rango. <span className="text-slate-300">Imprimir resumen general</span> genera un solo documento con todos los vendedores y el total
          de la sucursal; <span className="text-slate-300">Salidas</span> imprime el detalle por vendedor (ítems) para el arqueo / cierre del día.
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
