import type { NotaEntregaData } from "@/lib/data/creditos";
import { montoBolivianosEnLetras } from "@/lib/monto-bolivianos-letras";
import { openReporteHojaPrint } from "@/lib/reportes/reporte-hoja-impresion";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtFechaLarga(iso: string): string {
  const p = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : iso.slice(0, 10);
  const [y, m, d] = p.split("-").map(Number);
  if (!Number.isFinite(y)) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("es-BO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/La_Paz",
  });
}

function fmtNum(n: number, dec = 2): string {
  return n.toLocaleString("es-BO", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export function buildNotaEntregaHtml(data: NotaEntregaData): string {
  const titulo = escHtml(`Nota de Entrega Nru. ${data.numeroDocumento}`);
  const fecha = escHtml(fmtFechaLarga(data.fechaDoc));
  const hora = escHtml(data.horaDoc || "");
  const cliente = escHtml(data.clienteNombre);
  const tienda = data.tiendaLabel.trim() ? escHtml(data.tiendaLabel.trim()) : "";
  const usuario = escHtml(data.vendedorUsername);
  const obs = data.observacion.trim()
    ? escHtml(data.observacion.trim())
    : escHtml(usuario);
  const total = fmtNum(data.totalBs);
  const son = escHtml(montoBolivianosEnLetras(data.totalBs));
  const filas = data.lineas
    .map(
      (ln) => `<tr>
      <td class="cod">${escHtml(ln.codigo)}</td>
      <td class="desc">${escHtml(ln.descripcion)}</td>
      <td class="num">${fmtNum(ln.cantidad, 2)}</td>
      <td class="num">${fmtNum(ln.unitario)}</td>
      <td class="num">${fmtNum(ln.total)}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 11pt;
      color: #000;
      margin: 8mm 10mm;
      line-height: 1.25;
    }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .marca { font-weight: 700; font-size: 12pt; }
    .hora { font-size: 10pt; }
    .titulo { text-align: center; font-weight: 700; font-size: 12pt; margin: 8px 0 4px; text-transform: uppercase; }
    .fecha { text-align: right; font-size: 10.5pt; margin-bottom: 8px; }
    .cliente { margin-bottom: 8px; font-size: 11pt; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    table.items th, table.items td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; }
    table.items th { font-size: 9pt; text-transform: uppercase; text-align: center; }
    table.items td.cod { width: 14%; font-size: 10pt; }
    table.items td.desc { font-size: 10pt; }
    table.items td.num { text-align: right; white-space: nowrap; font-size: 10pt; width: 12%; }
    .total { margin-top: 10px; font-weight: 700; font-size: 12pt; }
    .son { margin-top: 6px; font-size: 10.5pt; }
    .obs { margin-top: 8px; font-size: 10.5pt; }
    .firmas { display: flex; justify-content: space-between; margin-top: 28px; gap: 16px; font-size: 10pt; }
    .firma { flex: 1; text-align: center; }
    .firma .linea { border-bottom: 1px dotted #000; height: 22px; margin-bottom: 4px; }
    .pie { margin-top: 16px; font-size: 10pt; }
    @media print {
      @page { size: 80mm auto; margin: 4mm; }
      body { margin: 0; font-size: 10pt; }
    }
  </style>
</head>
<body>
  <div class="top">
    ${tienda ? `<div class="marca">${tienda}</div>` : "<div></div>"}
    <div class="hora">${hora}</div>
  </div>
  <div class="titulo">${titulo}</div>
  <div class="fecha">${fecha}</div>
  <div class="cliente"><strong>Cliente :</strong> ${cliente}</div>
  <table class="items">
    <thead>
      <tr>
        <th>Codigo</th>
        <th>Descripcion</th>
        <th>Cantidad</th>
        <th>Unitario</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="total">Total Bs. ${total}</div>
  <div class="son">Son : ${son} Bolivianos.</div>
  <div class="obs">Observación : ${obs}</div>
  <div class="firmas">
    <div class="firma"><div class="linea"></div>Entregué Conforme</div>
    <div class="firma"><div class="linea"></div>Recibí Conforme</div>
  </div>
  <div class="pie">Usuario : ${usuario}</div>
</body>
</html>`;
}

export function openNotaEntregaPrint(data: NotaEntregaData): { ok: true } | { ok: false; message: string } {
  return openReporteHojaPrint(buildNotaEntregaHtml(data));
}
