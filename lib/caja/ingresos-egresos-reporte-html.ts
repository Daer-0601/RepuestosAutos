import { formatoMostrarFechaHoraBo, formatoMostrarFechaBo } from "@/lib/fecha-bolivia";

export type IngresosEgresosMovimiento = {
  id: number;
  tipo: "ingreso" | "egreso";
  detalle: string;
  montoBs: number;
  esCompraDolar: boolean;
  montoUsd: number | null;
};

export type IngresosEgresosVentaProducto = {
  productoId: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  totalBs: number;
};

export type IngresosEgresosReporteData = {
  fecha: string;
  sucursalNombre: string;
  tiendaCodigo: string;
  cajeroUsername: string;
  cajeroNombre: string;
  movimientos: IngresosEgresosMovimiento[];
  ventasProductos: IngresosEgresosVentaProducto[];
  ventaTotalBs: number;
  cantidadVentasCobradas: number;
};

export type IngresosEgresosResumen = {
  ing: number;
  egr: number;
  totalCDolar: number;
  neto: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function calcularResumenIngresosEgresos(
  data: Pick<IngresosEgresosReporteData, "movimientos">
): IngresosEgresosResumen {
  let ing = 0;
  let egr = 0;
  let totalCDolar = 0;
  for (const m of data.movimientos ?? []) {
    if (m.tipo === "ingreso") ing = round2(ing + m.montoBs);
    else egr = round2(egr + m.montoBs);
    if (m.esCompraDolar && m.montoUsd != null) totalCDolar = round2(totalCDolar + m.montoUsd);
  }
  return { ing, egr, totalCDolar, neto: round2(ing - egr) };
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

function celdaCDolar(m: IngresosEgresosMovimiento): string {
  if (!m.esCompraDolar || m.montoUsd == null || m.montoUsd <= 0) return "";
  return fmtUsd(m.montoUsd);
}

function labelFechaDoc(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
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

export function buildIngresosEgresosReporteHtml(data: IngresosEgresosReporteData): string {
  const origin = typeof globalThis.window !== "undefined" ? globalThis.window.location?.origin ?? "" : "";
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
    const cdCell = cd ? `<span class="tc-val">${escHtml(cd)}</span>` : '<span class="chk"></span>';
    return `<tr>
      <td class="det">${escHtml(m.detalle)}</td>
      <td class="cd">${cdCell}</td>
      <td class="num">${ing > 0 ? fmtBs(ing) : "0.00"}</td>
      <td class="num">${egr > 0 ? fmtBs(egr) : "0.00"}</td>
      <td class="num sub">${fmtBs(sub)}</td>
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

export function labelFechaReporteBo(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-BO", { ...formatoMostrarFechaBo });
}
