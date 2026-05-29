import { pool } from "@/lib/db";
import type { ProductoOskCsvRow } from "@/lib/export/productos-osk-csv";
import type { RowDataPacket } from "mysql2";

export async function listProductosForOskCsvExport(): Promise<ProductoOskCsvRow[]> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.codigo, p.codigo_pieza, p.especificacion, p.nombre, p.repuesto, p.procedencia,
            p.marca_auto, p.unidad, p.medida, p.precio_venta_lista_bs
     FROM productos p
     ORDER BY CAST(p.codigo AS UNSIGNED) ASC, p.id ASC`
  );
  return (rows as RowDataPacket[]).map((r) => ({
    codigo: String(r.codigo ?? ""),
    codigo_pieza: r.codigo_pieza != null && String(r.codigo_pieza).trim() !== "" ? String(r.codigo_pieza) : null,
    especificacion:
      r.especificacion != null && String(r.especificacion).trim() !== "" ? String(r.especificacion) : null,
    nombre: String(r.nombre ?? ""),
    repuesto: r.repuesto != null && String(r.repuesto).trim() !== "" ? String(r.repuesto) : null,
    procedencia: r.procedencia != null && String(r.procedencia).trim() !== "" ? String(r.procedencia) : null,
    marca_auto: r.marca_auto != null && String(r.marca_auto).trim() !== "" ? String(r.marca_auto) : null,
    unidad: r.unidad != null && String(r.unidad).trim() !== "" ? String(r.unidad) : null,
    medida: r.medida != null && String(r.medida).trim() !== "" ? String(r.medida) : null,
    precio_venta_lista_bs:
      r.precio_venta_lista_bs != null && String(r.precio_venta_lista_bs).trim() !== ""
        ? String(r.precio_venta_lista_bs)
        : null,
  }));
}
