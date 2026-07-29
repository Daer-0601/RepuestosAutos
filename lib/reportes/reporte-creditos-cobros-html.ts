import { formatIsoDateOnlyBo, formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import { labelPeriodoSalidas } from "@/lib/reportes/reporte-salidas-diarias-html";
import {
  escHtml,
  fmtMontoBo,
  openReporteHojaPrint,
  reporteHojaPrintCss,
} from "@/lib/reportes/reporte-hoja-impresion";

export type CobroCreditoPrintFila = {
  clienteNombre: string;
  vendedorNombre: string;
  fecha: string;
  tipoPago: "efectivo" | "qr" | "tarjeta";
  montoBs: number;
  cajeroNombre: string;
};

export type CreditosCobrosPrintInput = {
  origin: string;
  sucursalNombre: string;
  fechaDesde: string;
  fechaHasta: string;
  filas: CobroCreditoPrintFila[];
  fechaImpresion: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function labelTipoPago(tp: CobroCreditoPrintFila["tipoPago"]): string {
  if (tp === "qr") return "QR";
  if (tp === "tarjeta") return "Tarjeta";
  return "Efectivo";
}

function labelFechaCobro(iso: string): string {
  const t = iso.trim();
  if (!t) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return formatIsoDateOnlyBo(t);
  const d = new Date(t.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString("es-BO", formatoMostrarFechaHoraBo);
}

export function buildReporteCreditosCobrosHtml(input: CreditosCobrosPrintInput): string {
  const logoSrc = escHtml(`${input.origin}/img/logo.png`);
  const titulo = escHtml("COBROS DE CRÉDITO");
  const tienda = escHtml(
    input.sucursalNombre.trim() ? `Caja · ${input.sucursalNombre.trim()}` : "Caja"
  );
  const per = escHtml(`Período: ${labelPeriodoSalidas(input.fechaDesde, input.fechaHasta)}`);
  const fi = escHtml(input.fechaImpresion);

  let total = 0;
  let totalEf = 0;
  let totalQr = 0;
  let totalTar = 0;

  const bodyRows =
    input.filas.length === 0
      ? `<tr><td colspan="6" class="empty">No hay cobros de crédito en el período seleccionado.</td></tr>`
      : input.filas
          .map((f) => {
            total = round2(total + f.montoBs);
            if (f.tipoPago === "efectivo") totalEf = round2(totalEf + f.montoBs);
            else if (f.tipoPago === "qr") totalQr = round2(totalQr + f.montoBs);
            else totalTar = round2(totalTar + f.montoBs);
            return `<tr>
            <td class="c-fecha">${escHtml(labelFechaCobro(f.fecha))}</td>
            <td class="c-text">${escHtml(f.clienteNombre)}</td>
            <td class="c-text">${escHtml(f.vendedorNombre)}</td>
            <td class="c-pago">${escHtml(labelTipoPago(f.tipoPago))}</td>
            <td class="c-num">${fmtMontoBo(f.montoBs)}</td>
            <td class="c-text">${escHtml(f.cajeroNombre)}</td>
          </tr>`;
          })
          .join("");

  const footRow =
    input.filas.length === 0
      ? ""
      : `<tr>
        <td colspan="4">TOTAL COBRADO (${input.filas.length} pago${input.filas.length === 1 ? "" : "s"})</td>
        <td class="num">${fmtMontoBo(total)} Bs.</td>
        <td></td>
      </tr>`;

  const resumen =
    input.filas.length === 0
      ? ""
      : `<p class="nota">Efectivo: ${fmtMontoBo(totalEf)} Bs · QR: ${fmtMontoBo(totalQr)} Bs · Tarjeta: ${fmtMontoBo(totalTar)} Bs</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>${reporteHojaPrintCss("landscape")}
    .c-fecha { white-space: nowrap; font-size: 9pt; }
    .c-pago { font-size: 10pt; }
  </style>
</head>
<body>
  <header class="head">
    <div class="logo"><img src="${logoSrc}" alt="" /></div>
    <div class="head-mid">
      <div class="titulo">${titulo}</div>
      <div class="tienda">${tienda}</div>
      <div class="sub">${per}</div>
    </div>
    <div style="width:64px"></div>
  </header>
  <p class="nota">Ingresos por cobro de créditos (fecha de pago). También figuran en Ingresos / egresos del día.</p>
  ${resumen}
  <table class="items">
    <colgroup>
      <col style="width:16%" />
      <col style="width:22%" />
      <col style="width:18%" />
      <col style="width:12%" />
      <col style="width:14%" />
      <col style="width:18%" />
    </colgroup>
    <thead>
      <tr>
        <th>Fecha cobro</th>
        <th>Cliente</th>
        <th>Vendedor</th>
        <th>Pago</th>
        <th class="num">Monto Bs</th>
        <th>Cajero</th>
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
}

export function openReporteCreditosCobrosPrint(
  html: string
): { ok: true } | { ok: false; message: string } {
  return openReporteHojaPrint(html);
}
