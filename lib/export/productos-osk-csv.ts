/** Fila mínima para exportar catálogo al formato «repuestos osk.csv». */
export type ProductoOskCsvRow = {
  codigo: string;
  codigo_pieza: string | null;
  especificacion: string | null;
  nombre: string;
  repuesto: string | null;
  procedencia: string | null;
  marca_auto: string | null;
  unidad: string | null;
  medida: string | null;
  precio_venta_lista_bs: string | null;
};

const OSK_HEADER =
  "Codigo Barra;Codigo Pieza;Especificacion;Descripcion;Repuesto;Procedencia;Marca;Unidad;Medida;Precio Venta";

function csvCell(raw: string): string {
  const s = raw.replace(/\r\n/g, " ").replace(/\n/g, " ").replace(/\r/g, " ");
  if (/[;"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Precio con miles en punto y decimales en coma (ej. 3.982,57). */
export function formatPrecioVentaOskCsv(raw: string | null | undefined): string {
  if (raw == null || String(raw).trim() === "") return "0,00";
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return "0,00";
  const fixed = Math.round(n * 100) / 100;
  const [intPart, decPart] = fixed.toFixed(2).split(".");
  const intWithDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intWithDots},${decPart}`;
}

export function buildProductosOskCsv(rows: ProductoOskCsvRow[]): string {
  const body = rows.map((r) =>
    [
      csvCell(r.codigo),
      csvCell(r.codigo_pieza?.trim() ?? ""),
      csvCell(r.especificacion?.trim() ?? ""),
      csvCell(r.nombre?.trim() ?? ""),
      csvCell(r.repuesto?.trim() ?? ""),
      csvCell(r.procedencia?.trim() ?? ""),
      csvCell(r.marca_auto?.trim() ?? ""),
      csvCell(r.unidad?.trim() ?? ""),
      csvCell(r.medida?.trim() ?? ""),
      csvCell(formatPrecioVentaOskCsv(r.precio_venta_lista_bs)),
    ].join(";")
  );
  return `\uFEFF${OSK_HEADER}\r\n${body.join("\r\n")}\r\n`;
}
