import {
  escHtml,
  fmtMontoBo,
  openReporteHojaPrint,
  reporteHojaPrintCss,
} from "@/lib/reportes/reporte-hoja-impresion";

export type ArqueoResumenPrintFila = {
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

export type ArqueoResumenPrintInput = {
  origin: string;
  sucursalNombre: string;
  periodoLabel: string;
  filas: ArqueoResumenPrintFila[];
  totales: {
    ventas: number;
    bs: number;
    usd: number;
    ef: number;
    qr: number;
    tar: number;
    cred: number;
  };
  fechaImpresion: string;
};

export function buildReporteArqueoResumenHtml(input: ArqueoResumenPrintInput): string {
  const logoSrc = escHtml(`${input.origin}/img/logo.png`);
  const titulo = escHtml("ARQUEO GENERAL — RESUMEN POR VENDEDOR");
  const tienda = escHtml(
    input.sucursalNombre.trim() ? `Caja · ${input.sucursalNombre.trim()}` : "Caja"
  );
  const per = escHtml(`Período: ${input.periodoLabel}`);
  const fi = escHtml(input.fechaImpresion);
  const t = input.totales;

  const bodyRows =
    input.filas.length === 0
      ? `<tr><td colspan="9" class="empty">No hay vendedores activos en esta sucursal.</td></tr>`
      : input.filas
          .map((f) => {
            const nom = escHtml(f.nombreCompleto?.trim() || "—");
            const usr = escHtml(f.username?.trim() || "—");
            return `<tr>
            <td class="c-text">${nom}</td>
            <td class="c-mono">${usr}</td>
            <td class="c-num">${f.cantidadVentas}</td>
            <td class="c-num">${fmtMontoBo(f.totalBs)}</td>
            <td class="c-num">${fmtMontoBo(f.totalUsd, 4)}</td>
            <td class="c-num">${fmtMontoBo(f.bsEfectivo)}</td>
            <td class="c-num">${fmtMontoBo(f.bsQr)}</td>
            <td class="c-num">${fmtMontoBo(f.bsTarjeta)}</td>
            <td class="c-num">${fmtMontoBo(f.bsCredito)}</td>
          </tr>`;
          })
          .join("");

  const footRow =
    input.filas.length === 0
      ? ""
      : `<tr>
        <td colspan="2">TOTAL GENERAL (sucursal)</td>
        <td class="num">${t.ventas}</td>
        <td class="num">${fmtMontoBo(t.bs)}</td>
        <td class="num">${fmtMontoBo(t.usd, 4)}</td>
        <td class="num">${fmtMontoBo(t.ef)}</td>
        <td class="num">${fmtMontoBo(t.qr)}</td>
        <td class="num">${fmtMontoBo(t.tar)}</td>
        <td class="num">${fmtMontoBo(t.cred)}</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo}</title>
  <style>${reporteHojaPrintCss("portrait")}</style>
</head>
<body>
  <header class="head">
    <div class="logo"><img src="${logoSrc}" alt="" /></div>
    <div class="head-mid">
      <div class="titulo">${titulo}</div>
      <div class="tienda">${tienda}</div>
      <div class="sub">${per}</div>
    </div>
    <div style="width:80px"></div>
  </header>
  <p class="nota">Ventas confirmadas en el período. Una fila por vendedor activo de la sucursal; la última fila suma todos los montos.</p>
  <table class="items">
    <colgroup>
      <col style="width:18%" />
      <col style="width:11%" />
      <col style="width:8%" />
      <col style="width:11%" />
      <col style="width:11%" />
      <col style="width:11%" />
      <col style="width:10%" />
      <col style="width:10%" />
      <col style="width:10%" />
    </colgroup>
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
}

export { openReporteHojaPrint as openReporteArqueoResumenPrint };
