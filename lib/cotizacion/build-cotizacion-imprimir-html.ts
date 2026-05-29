import { formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";

export type CotizacionLineaImpresion = {
  codigoPieza: string;
  medida: string;
  nombre: string;
  cantidad: number;
  precioUnitarioBs: number;
  totalLineaBs: number;
};

export type BuildCotizacionImprimirHtmlInput = {
  sucursalNombre: string;
  vendedorNombre?: string | null;
  cajeroUsername?: string | null;
  cotizacionId?: number | null;
  clienteNombre: string | null;
  clienteNit: string | null;
  tipoCambioBsUsd: number | null;
  totalBs: number;
  totalUsd: number | null;
  lineas: CotizacionLineaImpresion[];
  fechaImpresion?: Date;
};

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildCotizacionImprimirHtml(input: BuildCotizacionImprimirHtmlInput): string {
  const fechaStr = (input.fechaImpresion ?? new Date()).toLocaleString("es-BO", formatoMostrarFechaHoraBo);
  const metaRows: { k: string; v: string }[] = [{ k: "Fecha", v: fechaStr }];
  if (input.sucursalNombre.trim()) metaRows.push({ k: "Sucursal", v: input.sucursalNombre.trim() });
  if (input.vendedorNombre?.trim()) metaRows.push({ k: "Vendedor", v: input.vendedorNombre.trim() });
  if (input.cajeroUsername?.trim()) metaRows.push({ k: "Cajero", v: input.cajeroUsername.trim() });
  if (input.clienteNombre?.trim()) metaRows.push({ k: "Cliente", v: input.clienteNombre.trim() });
  if (input.clienteNit?.trim()) metaRows.push({ k: "NIT", v: input.clienteNit.trim() });

  const metaHtml = metaRows
    .map(
      ({ k, v }) =>
        `<tr><th style="text-align:left;padding:6px 10px;border:1px solid #ccc;width:200px;background:#f3f4f6">${escHtml(k)}</th><td style="padding:6px 10px;border:1px solid #ccc">${escHtml(v)}</td></tr>`
    )
    .join("");

  const bodyRows = input.lineas
    .map((ln) => {
      const pieza = ln.codigoPieza.trim() || "—";
      const med = ln.medida.trim() || "—";
      return `<tr>
          <td style="padding:10px 12px;border:1px solid #ccc">${escHtml(pieza)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc">${escHtml(med)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc">${escHtml(ln.nombre)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${ln.cantidad}</td>
          <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${ln.precioUnitarioBs.toFixed(2)}</td>
          <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-variant-numeric:tabular-nums">${ln.totalLineaBs.toFixed(2)}</td>
        </tr>`;
    })
    .join("");

  const totalBs = input.totalBs.toFixed(2);
  const footerRow = `<tr>
      <td colspan="5" style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-weight:600;background:#f3f4f6">Total Bs</td>
      <td style="padding:10px 12px;border:1px solid #ccc;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;background:#f3f4f6">${escHtml(totalBs)}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cotización ${escHtml(fechaStr)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 28px; color: #111; font-size: 16px; line-height: 1.5; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    .meta { width: 100%; border-collapse: collapse; margin-bottom: 24px; max-width: 760px; font-size: 15px; }
    .items { width: 100%; border-collapse: collapse; font-size: 15px; }
    .items th { background: #f3f4f6; font-weight: 600; text-align: left; padding: 12px 14px; border: 1px solid #ccc; }
    .items td { padding: 12px 14px; }
    .items th.num { text-align: right; }
    @media print {
      body { padding: 14px; font-size: 15px; }
      .items th, .items td { padding: 10px 12px; font-size: 14px; }
    }
  </style>
</head>
<body>
  <h1>Cotización</h1>
  <table class="meta">${metaHtml}</table>
  <table class="items">
    <thead>
      <tr>
        <th>Cód. pieza</th>
        <th>Medida</th>
        <th>Producto</th>
        <th class="num">Cant.</th>
        <th class="num">P. unitario Bs</th>
        <th class="num">Subtotal Bs</th>
      </tr>
    </thead>
    <tbody>${bodyRows}${footerRow}</tbody>
  </table>
</body>
</html>`;
}
