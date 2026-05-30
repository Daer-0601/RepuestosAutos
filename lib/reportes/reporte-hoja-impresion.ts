export type ReporteHojaOrientacion = "portrait" | "landscape";

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtMontoBo(n: number, dec = 2): string {
  const v = Math.round(n * 10 ** dec) / 10 ** dec;
  return v.toLocaleString("es-BO", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

/** Estilos comunes para reportes impresos en hoja A4. */
export function reporteHojaPrintCss(orientacion: ReporteHojaOrientacion = "portrait"): string {
  const page = orientacion === "landscape" ? "A4 landscape" : "A4 portrait";
  return `
    * { box-sizing: border-box; }
    html, body { width: 100%; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 12mm 10mm;
      color: #000;
      font-size: 11pt;
      line-height: 1.35;
    }
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }
    .head-mid { flex: 1; text-align: center; }
    .logo {
      width: 80px;
      height: 58px;
      flex-shrink: 0;
      border: 1px solid #999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .titulo {
      font-family: "Times New Roman", Times, Georgia, serif;
      font-size: 17pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .tienda { margin-top: 6px; font-size: 12pt; font-weight: 600; }
    .sub { margin-top: 4px; font-size: 10.5pt; }
    .sub.vend { font-weight: 600; }
    .nota { margin: 8px 0 0; font-size: 10pt; color: #444; line-height: 1.35; }
    table.items {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-top: 8px;
    }
    table.items th {
      background: #e8e8e8;
      border: 1px solid #000;
      padding: 7px 6px;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      text-align: left;
      vertical-align: bottom;
      line-height: 1.2;
      word-wrap: break-word;
    }
    table.items th.num { text-align: right; }
    table.items td {
      border: 1px solid #000;
      padding: 6px 6px;
      vertical-align: top;
      font-size: 10pt;
      line-height: 1.3;
      word-wrap: break-word;
      overflow-wrap: anywhere;
    }
    table.items td.empty { padding: 16px; text-align: center; color: #555; font-size: 11pt; }
    .c-text { font-size: 10pt; }
    .c-mono { font-family: ui-monospace, "Courier New", monospace; font-size: 9.5pt; }
    .c-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 10pt; }
    tfoot td {
      border: 1px solid #000;
      padding: 8px 8px;
      font-weight: 700;
      font-size: 11pt;
      background: #f3f3f3;
    }
    tfoot .lbl { text-align: right; text-transform: uppercase; }
    tfoot .num { text-align: right; font-variant-numeric: tabular-nums; }
    .foot {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      font-size: 10pt;
      color: #333;
    }
    @media print {
      @page { size: ${page}; margin: 12mm 10mm; }
      body { padding: 0; font-size: 11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      table.items th { font-size: 9pt; padding: 6px 5px; }
      table.items td { font-size: 10pt; padding: 5px 5px; }
      tfoot td { font-size: 11pt; }
    }
  `;
}

export function openReporteHojaPrint(html: string): { ok: true } | { ok: false; message: string } {
  if (typeof document === "undefined") {
    return { ok: false, message: "Impresión no disponible." };
  }
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const w = globalThis.window?.open(objectUrl, "_blank");
  if (!w) {
    URL.revokeObjectURL(objectUrl);
    return { ok: false, message: "No se pudo abrir la ventana de impresión (¿bloqueador de ventanas?)." };
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
      teardown();
      return { ok: false, message: "No se pudo abrir el cuadro de impresión." };
    }
  };
  if (w.document.readyState === "complete") {
    globalThis.setTimeout(doPrint, 120);
  } else {
    w.addEventListener("load", () => globalThis.setTimeout(doPrint, 120), { once: true });
  }
  return { ok: true };
}
