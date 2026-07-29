"use client";

import { ProductoQrImagenesControls } from "@/app/admin/productos/_components/producto-qr-imagenes-controls";
import { Trash2 } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

/** Alineado con `ProductoLookup` en `nueva-venta-form`. */
export type VentaCarritoProducto = {
  id: number;
  codigo: string;
  nombre: string;
  descripcionMostrar: string;
  codigoPieza: string | null;
  medida: string | null;
  unidad: string | null;
  marcaAuto: string | null;
  procedencia: string | null;
  stock: number;
  precio_venta_lista_bs: number | null;
  precio_venta_lista_usd: number | null;
  punto_tope: number | null;
  qrPayload: string;
  imagenesUrls: string[];
};

export type VentaCarritoLinea = {
  key: string;
  producto: VentaCarritoProducto;
  cantidad: string;
  precioUnitBs: string;
};

const COL_MIN = 40;

const DEFAULT_COL_WIDTHS = [88, 84, 72, 200, 80, 88, 64, 96, 80, 56, 52, 88, 44];

const COL_LABELS = [
  "Img / QR",
  "Código",
  "Medida",
  "Nombre",
  "Marca",
  "Procedencia",
  "Unidad",
  "Precio Lista",
  "Precio Tope",
  "Cant.",
  "Stock",
  "Subtotal",
  "",
] as const;

const cellPad = "border-b border-amber-500/15 border-r border-amber-500/20 px-2 py-2 align-top text-xs";

export function VentaCarritoTabla({
  lineas,
  inpPosClass,
  subtotalLineaBs,
  onCantidadChange,
  onCantidadBlur,
  onPrecioChange,
  onPrecioBlur,
  onRemove,
  /** Cotización: el stock es solo referencia, no limita cantidades. */
  modoCotizacion = false,
}: {
  lineas: VentaCarritoLinea[];
  inpPosClass: string;
  subtotalLineaBs: (ln: VentaCarritoLinea) => number | null;
  onCantidadChange: (key: string, value: string) => void;
  onCantidadBlur?: (key: string) => void;
  onPrecioChange: (key: string, value: string) => void;
  onPrecioBlur?: (key: string) => void;
  onRemove: (key: string) => void;
  modoCotizacion?: boolean;
}) {
  const [colWidths, setColWidths] = useState<number[]>(() => [...DEFAULT_COL_WIDTHS]);
  const resizeDragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  const columnResizeMoveRef = useRef<(e: MouseEvent) => void>(() => {});
  const columnResizeEndRef = useRef<() => void>(() => {});

  const tablaAnchoPx = useMemo(() => colWidths.reduce((a, w) => a + w, 0), [colWidths]);

  const stableColumnResizeMove = useCallback((e: MouseEvent) => {
    columnResizeMoveRef.current(e);
  }, []);

  const stableColumnResizeEnd = useCallback(() => {
    columnResizeEndRef.current();
  }, []);

  const onColumnResizeMove = useCallback((e: MouseEvent) => {
    const d = resizeDragRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    const nw = Math.max(COL_MIN, Math.round(d.startWidth + delta));
    setColWidths((prev) => {
      if (prev[d.index] === nw) return prev;
      const next = [...prev];
      next[d.index] = nw;
      return next;
    });
  }, []);

  const onColumnResizeEnd = useCallback(() => {
    resizeDragRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", stableColumnResizeMove);
    document.removeEventListener("mouseup", stableColumnResizeEnd);
  }, [stableColumnResizeMove, stableColumnResizeEnd]);

  useLayoutEffect(() => {
    columnResizeMoveRef.current = onColumnResizeMove;
    columnResizeEndRef.current = onColumnResizeEnd;
  }, [onColumnResizeMove, onColumnResizeEnd]);

  const beginColumnResize = useCallback(
    (e: React.MouseEvent, colIndex: number) => {
      e.preventDefault();
      e.stopPropagation();
      resizeDragRef.current = {
        index: colIndex,
        startX: e.clientX,
        startWidth: colWidths[colIndex],
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", stableColumnResizeMove);
      document.addEventListener("mouseup", stableColumnResizeEnd);
    },
    [colWidths, stableColumnResizeMove, stableColumnResizeEnd]
  );

  const resizeHandle = useCallback(
    (colIndex: number, label: string) => (
      <span
        className="absolute right-0 top-0 z-20 h-full w-4 min-w-[14px] max-w-[18px] cursor-col-resize hover:bg-amber-500/35 active:bg-amber-500/50"
        style={{ transform: "translateX(50%)" }}
        onMouseDown={(e) => beginColumnResize(e, colIndex)}
        onClick={(e) => e.stopPropagation()}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionar columna ${label || colIndex + 1}`}
      />
    ),
    [beginColumnResize]
  );

  const nCols = COL_LABELS.length;

  return (
    <div className="overflow-x-auto rounded-xl border border-amber-500/25 bg-slate-950/50 shadow-inner shadow-black/20 overscroll-contain">
      <table
        className="table-fixed border-collapse text-left text-xs"
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="border-b border-amber-500/35 bg-slate-900/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {COL_LABELS.map((label, i) => (
              <th
                key={i}
                className={`${cellPad} relative select-none ${
                  i >= 7 && i <= 11 ? "text-right" : ""
                } ${i === 12 ? "text-center" : ""}`}
                title="Arrastrá el borde derecho de la columna para cambiar el ancho"
              >
                {label ? label : <span className="text-slate-600">·</span>}
                {resizeHandle(i, label || `col-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-500/15">
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={nCols} className="px-4 py-12 text-center text-sm text-slate-500">
                {modoCotizacion
                  ? "Todavía no hay líneas en esta cotización. Sumá productos con el lector o el buscador (no importa el stock)."
                  : "Todavía no hay repuestos en esta venta. Sumá el primero con el lector de arriba o buscá el código en Productos."}
              </td>
            </tr>
          ) : (
            lineas.map((ln) => {
              const p = ln.producto;
              const sub = subtotalLineaBs(ln);
              const img0 = p.imagenesUrls[0] ?? "";
              const descQr = p.descripcionMostrar?.trim() ? p.descripcionMostrar : p.nombre;
              return (
                <tr key={ln.key} className="bg-slate-950/30 hover:bg-amber-950/10">
                  <td className={`${cellPad} relative`}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-500/25 bg-black/40">
                        {img0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img0} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </div>
                      <ProductoQrImagenesControls
                        codigo={p.codigo}
                        qrPayload={p.qrPayload || p.codigo}
                        descripcion={descQr}
                        imagenesUrls={p.imagenesUrls}
                        size="sm"
                        onOpenInteraction={(e) => e.stopPropagation()}
                      />
                    </div>
                    {resizeHandle(0, COL_LABELS[0])}
                  </td>
                  <td className={`${cellPad} relative truncate font-mono text-amber-200/90`}>
                    {p.codigo}
                    {resizeHandle(1, COL_LABELS[1])}
                  </td>
                  <td className={`${cellPad} relative truncate font-mono text-[11px] text-slate-400`} title={p.medida ?? ""}>
                    {p.medida?.trim() || "—"}
                    {resizeHandle(2, COL_LABELS[2])}
                  </td>
                  <td className={`${cellPad} relative`}>
                    <span className="line-clamp-3 font-medium text-slate-100" title={p.nombre}>
                      {p.nombre}
                    </span>
                    {resizeHandle(3, COL_LABELS[3])}
                  </td>
                  <td className={`${cellPad} relative truncate text-slate-300`} title={p.marcaAuto ?? ""}>
                    {p.marcaAuto?.trim() || "—"}
                    {resizeHandle(4, COL_LABELS[4])}
                  </td>
                  <td className={`${cellPad} relative truncate text-slate-400`} title={p.procedencia ?? ""}>
                    {p.procedencia?.trim() || "—"}
                    {resizeHandle(5, COL_LABELS[5])}
                  </td>
                  <td className={`${cellPad} relative truncate text-slate-400`} title={p.unidad ?? ""}>
                    {p.unidad?.trim() || "—"}
                    {resizeHandle(6, COL_LABELS[6])}
                  </td>
                  <td className={`${cellPad} relative text-right`}>
                    <div className="flex flex-col items-end gap-0.5">
                      <input
                        className={`${inpPosClass} w-full max-w-[7.5rem] text-right font-mono`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder={p.precio_venta_lista_bs != null ? p.precio_venta_lista_bs.toFixed(2) : "—"}
                        value={ln.precioUnitBs}
                        onKeyDown={(e) => {
                          if (e.ctrlKey || e.metaKey || e.altKey) return;
                          if (e.key.length !== 1) return;
                          if (/[0-9.,]/.test(e.key)) return;
                          e.preventDefault();
                        }}
                        onChange={(e) => onPrecioChange(ln.key, e.target.value)}
                        onBlur={() => onPrecioBlur?.(ln.key)}
                      />
                      {p.precio_venta_lista_bs != null &&
                      Number.isFinite(p.precio_venta_lista_bs) &&
                      p.precio_venta_lista_bs > 0 ? (
                        <span className="max-w-[10rem] text-right text-[10px] font-mono leading-tight tabular-nums text-slate-500">
                          lista ({p.precio_venta_lista_bs.toFixed(2)} Bs)
                        </span>
                      ) : null}
                    </div>
                    {resizeHandle(7, COL_LABELS[7])}
                  </td>
                  <td className={`${cellPad} relative text-right font-mono text-amber-100/85`}>
                    {p.punto_tope != null ? p.punto_tope.toFixed(2) : "—"}
                    {resizeHandle(8, COL_LABELS[8])}
                  </td>
                  <td className={`${cellPad} relative text-right`}>
                    <input
                      className={`${inpPosClass} w-full text-right font-mono`}
                      inputMode="numeric"
                      value={ln.cantidad}
                      onChange={(e) => onCantidadChange(ln.key, e.target.value)}
                      onBlur={() => onCantidadBlur?.(ln.key)}
                    />
                    {resizeHandle(9, COL_LABELS[9])}
                  </td>
                  <td className={`${cellPad} relative text-right font-mono text-emerald-200/85`}>
                    {p.stock}
                    {resizeHandle(10, COL_LABELS[10])}
                  </td>
                  <td className={`${cellPad} relative text-right font-mono text-slate-100`}>
                    {sub != null ? sub.toFixed(2) : "—"}
                    {resizeHandle(11, COL_LABELS[11])}
                  </td>
                  <td className={`${cellPad} relative border-r-0 text-center`}>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-200"
                      aria-label="Quitar línea"
                      onClick={() => onRemove(ln.key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    {resizeHandle(12, COL_LABELS[12] || "acción")}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
