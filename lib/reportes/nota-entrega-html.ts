import type { NotaEntregaData } from "@/lib/data/creditos";
import { montoBolivianosEnLetras } from "@/lib/monto-bolivianos-letras";

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
    /*
      Tamaño como el ticket original (compacto).
      Arial + peso medio-alto: se lee en Elgin sin agrandar el formato.
    */
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      font-weight: 600;
      color: #000;
      margin: 0;
      padding: 0 2mm 2mm;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
    .marca { font-weight: 700; font-size: 11pt; }
    .hora { font-size: 9.5pt; font-weight: 600; }
    .titulo {
      text-align: center;
      font-weight: 700;
      font-size: 11pt;
      margin: 4px 0 2px;
      text-transform: uppercase;
    }
    .fecha { text-align: right; font-size: 9.5pt; margin-bottom: 6px; font-weight: 600; }
    .cliente { margin-bottom: 6px; font-size: 10pt; font-weight: 600; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 2px; }
    table.items th, table.items td {
      border: 1px solid #000;
      padding: 3px 4px;
      vertical-align: top;
      font-weight: 600;
    }
    table.items th {
      font-size: 8pt;
      text-transform: uppercase;
      text-align: center;
      font-weight: 700;
    }
    table.items td.cod { width: 14%; font-size: 9pt; }
    table.items td.desc { font-size: 9pt; word-break: break-word; }
    table.items td.num { text-align: right; white-space: nowrap; font-size: 9pt; width: 12%; }
    .total { margin-top: 8px; font-weight: 700; font-size: 11pt; }
    .son { margin-top: 4px; font-size: 9.5pt; font-weight: 600; }
    .obs { margin-top: 6px; font-size: 9.5pt; font-weight: 600; }
    .firmas { display: flex; justify-content: space-between; margin-top: 20px; gap: 12px; font-size: 9pt; font-weight: 600; }
    .firma { flex: 1; text-align: center; }
    .firma .linea { border-bottom: 1px solid #000; height: 18px; margin-bottom: 3px; }
    .pie { margin-top: 12px; font-size: 9pt; font-weight: 600; }
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        padding: 1mm 2mm 2mm !important;
        font-size: 10pt;
      }
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

/** Impresión por iframe oculto (no usa popup; evita el bloqueador del navegador). */
export function openNotaEntregaPrint(data: NotaEntregaData): { ok: true } | { ok: false; message: string } {
  if (typeof document === "undefined") {
    return { ok: false, message: "Impresión no disponible." };
  }

  const html = buildNotaEntregaHtml(data);
  const prev = document.getElementById("nota-entrega-print-frame");
  if (prev) prev.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "nota-entrega-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", "Impresión nota de entrega");
  // Ancho real ~80 mm: si es 0×0 Chrome escala mal y el ticket sale enorme.
  iframe.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:80mm",
    "height:120mm",
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument ?? win?.document;
  if (!win || !doc) {
    iframe.remove();
    return { ok: false, message: "No se pudo preparar la impresión." };
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    globalThis.setTimeout(() => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    }, 1000);
  };

  const doPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      cleanup();
      return;
    }
    win.addEventListener("afterprint", cleanup, { once: true });
    globalThis.setTimeout(cleanup, 60_000);
  };

  // Esperar un frame para que el layout del iframe tenga tamaño real.
  globalThis.requestAnimationFrame(() => {
    globalThis.setTimeout(doPrint, 250);
  });

  return { ok: true };
}
