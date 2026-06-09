import { formatoMostrarFechaBo } from "@/lib/fecha-bolivia";
import {
  escHtml,
  fmtMontoBo,
  openReporteHojaPrint,
  reporteHojaPrintCss,
} from "@/lib/reportes/reporte-hoja-impresion";

export type SalidasDiariasPrintLinea = {
  fecha: string;
  vendedorNombre: string;
  codigoInterno: string;
  codigoPieza: string;
  medida: string;
  descripcion: string;
  cantidad: number;
  totalLineaBs: number;
  totalLineaUsd: number;
  esCredito?: boolean;
  formaPagoLabel?: string;
};

export type SalidasDiariasPrintInput = {
  origin: string;
  sucursalNombre: string;
  periodoLabel: string;
  vendedorLinea?: string | null;
  lineas: SalidasDiariasPrintLinea[];
  totales: { totalBs: number; totalUsd: number };
  fechaImpresion: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

export function formatFechaSalidasCelda(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-BO", formatoMostrarFechaBo);
}

/** Formato impreso: 6.375,08 (coma decimal, es-BO). */
export function fmtMontoSalidas(n: number, dec = 2): string {
  return fmtMontoBo(n, dec);
}

export function labelPeriodoSalidas(d1: string, d2: string): string {
  const fmt = (d: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(d) ? formatFechaSalidasCelda(`${d}T12:00:00`) : d.trim() || "—";
  const a = fmt(d1);
  const b = fmt(d2);
  return d1 === d2 ? a : `${a} al ${b}`;
}

export function totalLineaUsdFromBs(totalLineaBs: number, tipoCambioSnapshot: number | null): number {
  const tc = tipoCambioSnapshot != null && Number.isFinite(tipoCambioSnapshot) && tipoCambioSnapshot > 0
    ? tipoCambioSnapshot
    : 0;
  if (tc <= 0) return 0;
  return round4(totalLineaBs / tc);
}

export function buildReporteSalidasDiariasHtml(input: SalidasDiariasPrintInput): string {
  const logoSrc = escHtml(`${input.origin}/img/logo.png`);
  const titulo = escHtml("REPORTE DE SALIDAS DIARIAS");
  const tienda = escHtml(input.sucursalNombre.trim() ? `TIENDA: ${input.sucursalNombre.trim()}` : "TIENDA");
  const per = escHtml(`Período: ${input.periodoLabel}`);
  const vendSub = input.vendedorLinea?.trim()
    ? `<div class="sub vend">${escHtml(input.vendedorLinea.trim())}</div>`
    : "";
  const fi = escHtml(input.fechaImpresion);
  const totBs = fmtMontoSalidas(input.totales.totalBs);
  const totUsd = fmtMontoSalidas(input.totales.totalUsd, 2);

  const bodyRows =
    input.lineas.length === 0
      ? `<tr><td colspan="10" class="empty">Sin líneas de venta en el período seleccionado.</td></tr>`
      : input.lineas
          .map((ln) => {
            const fp = escHtml(formatFechaSalidasCelda(ln.fecha));
            const vend = escHtml(ln.vendedorNombre?.trim() || "—");
            const cod = escHtml(ln.codigoInterno?.trim() || "—");
            const cp = escHtml(ln.codigoPieza?.trim() || "—");
            const me = escHtml(ln.medida?.trim() || "—");
            const de = escHtml(ln.descripcion?.trim() || "—");
            const pago = escHtml(ln.formaPagoLabel?.trim() || "—");
            const pagoCls = ln.esCredito ? "c-pago c-pago-cred" : "c-pago";
            const cant = String(Math.trunc(Number(ln.cantidad)) || 0);
            const bs = fmtMontoSalidas(ln.totalLineaBs);
            const us = fmtMontoSalidas(ln.totalLineaUsd, 2);
            return `<tr>
            <td class="c-fecha">${fp}</td>
            <td class="c-vend">${vend}</td>
            <td class="${pagoCls}">${pago}</td>
            <td class="c-mono">${cod}</td>
            <td class="c-mono">${cp}</td>
            <td class="c-med">${me}</td>
            <td class="c-desc">${de}</td>
            <td class="c-num">${cant}</td>
            <td class="c-num">${bs}</td>
            <td class="c-num">${us}</td>
          </tr>`;
          })
          .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>${reporteHojaPrintCss("landscape")}
    table.items td, table.items th { overflow: hidden; }
    .c-fecha { white-space: nowrap; font-size: 9pt; }
    .c-vend { font-size: 9pt; line-height: 1.2; word-wrap: break-word; }
    .c-pago {
      font-size: 8.5pt;
      line-height: 1.2;
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
    }
    .c-pago-cred { font-weight: 700; }
    .c-mono { font-size: 9pt; white-space: nowrap; }
    .c-med { font-size: 9pt; word-wrap: break-word; }
    .c-desc { font-size: 9.5pt; word-wrap: break-word; }
  </style>
</head>
<body>
  <header class="head">
    <div class="logo"><img src="${logoSrc}" alt="" /></div>
    <div class="head-mid">
      <div class="titulo">${titulo}</div>
      <div class="tienda">${tienda}</div>
      ${vendSub}
      <div class="sub">${per}</div>
    </div>
    <div style="width:64px"></div>
  </header>
  <table class="items">
    <colgroup>
      <col style="width:7%" />
      <col style="width:11%" />
      <col style="width:8%" />
      <col style="width:6%" />
      <col style="width:12%" />
      <col style="width:8%" />
      <col style="width:26%" />
      <col style="width:5%" />
      <col style="width:8%" />
      <col style="width:9%" />
    </colgroup>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Vendedor</th>
        <th>Pago</th>
        <th>Cód.</th>
        <th>C_REP</th>
        <th>Medida</th>
        <th>Descripción</th>
        <th class="num">Cant.</th>
        <th class="num">S_Bs.</th>
        <th class="num">S_US</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
    <tfoot>
      <tr>
        <td colspan="7" class="lbl">TOTALES:</td>
        <td class="num"></td>
        <td class="num">${totBs} Bs.</td>
        <td class="num">${totUsd} Sus.</td>
      </tr>
    </tfoot>
  </table>
  <footer class="foot">
    <span>${fi}</span>
    <span>Página 1 de 1</span>
  </footer>
</body>
</html>`;
}

export function openReporteSalidasDiariasPrint(html: string): { ok: true } | { ok: false; message: string } {
  return openReporteHojaPrint(html);
}
