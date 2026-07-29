import { formatIsoDateOnlyBo } from "@/lib/fecha-bolivia";
import {
  escHtml,
  fmtMontoBo,
  openReporteHojaPrint,
  reporteHojaPrintCss,
} from "@/lib/reportes/reporte-hoja-impresion";

export type CreditoPendientePrintFila = {
  clienteNombre: string;
  vendedorNombre: string;
  fechaLimite: string;
  saldoPendienteBs: number;
  estado: "pendiente" | "vencido" | "pagado";
  diasVencido: number;
};

export type CreditoPendientesPrintInput = {
  origin: string;
  sucursalNombre: string;
  filtroLabel: string;
  filas: CreditoPendientePrintFila[];
  fechaImpresion: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function labelEstado(f: CreditoPendientePrintFila): string {
  if (f.estado === "vencido") {
    return f.diasVencido > 0 ? `Vencido (${f.diasVencido}d)` : "Vencido";
  }
  return "Pendiente";
}

export function buildReporteCreditosPendientesHtml(input: CreditoPendientesPrintInput): string {
  const logoSrc = escHtml(`${input.origin}/img/logo.png`);
  const titulo = escHtml("CRÉDITOS PENDIENTES DE COBRO");
  const tienda = escHtml(
    input.sucursalNombre.trim() ? `Caja · ${input.sucursalNombre.trim()}` : "Caja"
  );
  const filtro = escHtml(input.filtroLabel.trim() || "Todos los pendientes");
  const fi = escHtml(input.fechaImpresion);

  let totalSaldo = 0;
  const bodyRows =
    input.filas.length === 0
      ? `<tr><td colspan="5" class="empty">No hay créditos pendientes de cobro con estos filtros.</td></tr>`
      : input.filas
          .map((f) => {
            totalSaldo = round2(totalSaldo + f.saldoPendienteBs);
            const estCls = f.estado === "vencido" ? "c-est-venc" : "c-est";
            return `<tr>
            <td class="c-text">${escHtml(f.clienteNombre)}</td>
            <td class="c-text">${escHtml(f.vendedorNombre)}</td>
            <td class="c-fecha">${escHtml(formatIsoDateOnlyBo(f.fechaLimite))}</td>
            <td class="${estCls}">${escHtml(labelEstado(f))}</td>
            <td class="c-num">${fmtMontoBo(f.saldoPendienteBs)}</td>
          </tr>`;
          })
          .join("");

  const footRow =
    input.filas.length === 0
      ? ""
      : `<tr>
        <td colspan="4">TOTAL PENDIENTE (${input.filas.length} crédito${input.filas.length === 1 ? "" : "s"})</td>
        <td class="num">${fmtMontoBo(totalSaldo)} Bs.</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>${reporteHojaPrintCss("portrait")}
    .c-fecha { white-space: nowrap; }
    .c-est { font-size: 10pt; }
    .c-est-venc { font-size: 10pt; font-weight: 700; }
  </style>
</head>
<body>
  <header class="head">
    <div class="logo"><img src="${logoSrc}" alt="" /></div>
    <div class="head-mid">
      <div class="titulo">${titulo}</div>
      <div class="tienda">${tienda}</div>
      <div class="sub">Filtro: ${filtro}</div>
    </div>
    <div style="width:80px"></div>
  </header>
  <p class="nota">Solo créditos entregados con saldo pendiente. El cobro se registra en el módulo Créditos.</p>
  <table class="items">
    <colgroup>
      <col style="width:26%" />
      <col style="width:22%" />
      <col style="width:16%" />
      <col style="width:16%" />
      <col style="width:20%" />
    </colgroup>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Vendedor</th>
        <th>Vence</th>
        <th>Estado</th>
        <th class="num">Saldo Bs</th>
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

export function openReporteCreditosPendientesPrint(
  html: string
): { ok: true } | { ok: false; message: string } {
  return openReporteHojaPrint(html);
}
