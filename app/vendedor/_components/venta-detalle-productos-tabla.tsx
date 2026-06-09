"use client";

import type { VentaDetalleProductoRow } from "@/lib/data/ventas-vendedor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COL_MIN = 40;
const cellPad = "px-2 py-1.5";
const borderR = "border-r border-amber-500/35";
const resizeHandleHover = "hover:bg-amber-500/30 active:bg-amber-500/40";

const DEFAULT_COL_WIDTHS = [88, 88, 88, 200, 120, 100, 100, 72, 56, 88, 96];

const COL_LABELS = [
  "Código",
  "Cód. pieza",
  "Medida",
  "Nombre",
  "Repuesto",
  "Marca",
  "Procedencia",
  "Unidad",
  "Cant.",
  "Unit. Bs",
  "Subtotal Bs",
] as const;

const RIGHT_ALIGN_COLS = new Set([8, 9, 10]);

function lineaKey(ln: VentaDetalleProductoRow, idx: number): string {
  return `${ln.ventaId}-${ln.productoId}-${idx}`;
}

export function VentaDetalleProductosTabla({ lineas }: { lineas: VentaDetalleProductoRow[] }) {
  const [colWidths, setColWidths] = useState<number[]>(() => [...DEFAULT_COL_WIDTHS]);
  const resizeDragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  const [marcadoKey, setMarcadoKey] = useState<string | null>(null);

  useEffect(() => {
    setMarcadoKey((key) => {
      if (key == null) return null;
      return lineas.some((ln, i) => lineaKey(ln, i) === key) ? key : null;
    });
  }, [lineas]);

  const tablaAnchoPx = useMemo(() => colWidths.reduce((a, w) => a + w, 0), [colWidths]);

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
    document.removeEventListener("mousemove", onColumnResizeMove);
    document.removeEventListener("mouseup", onColumnResizeEnd);
  }, [onColumnResizeMove]);

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
      document.addEventListener("mousemove", onColumnResizeMove);
      document.addEventListener("mouseup", onColumnResizeEnd);
    },
    [colWidths, onColumnResizeMove, onColumnResizeEnd]
  );

  const resizeHandle = useCallback(
    (colIndex: number, label: string) => (
      <span
        className={`absolute right-0 top-0 z-20 h-full w-4 min-w-[14px] max-w-[18px] cursor-col-resize ${resizeHandleHover}`}
        style={{ transform: "translateX(50%)" }}
        onMouseDown={(e) => beginColumnResize(e, colIndex)}
        onClick={(e) => e.stopPropagation()}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionar columna ${label || colIndex}`}
      />
    ),
    [beginColumnResize]
  );

  if (lineas.length === 0) {
    return <p className="text-xs text-slate-500">Sin productos en esta venta.</p>;
  }

  return (
    <div className="max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 overscroll-contain">
      <table
        className="table-fixed border-collapse border border-amber-500/30 text-left text-xs"
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] border-b-2 border-amber-500/45 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/20">
          <tr>
            {COL_LABELS.map((label, i) => (
              <th
                key={label}
                className={`${cellPad} ${borderR} relative select-none ${RIGHT_ALIGN_COLS.has(i) ? "text-right" : ""}`}
                title="Arrastrá el borde derecho de la columna (encabezado o celdas)"
              >
                {label}
                {resizeHandle(i, label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-500/30 text-slate-300">
          {lineas.map((ln, idx) => {
            const key = lineaKey(ln, idx);
            const bg = idx % 2 === 0 ? "bg-slate-950/20" : "bg-slate-950/10";
            const seleccionado = marcadoKey === key;
            return (
              <tr
                key={key}
                tabIndex={0}
                aria-selected={seleccionado}
                onClick={() => setMarcadoKey((prev) => (prev === key ? null : key))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setMarcadoKey((prev) => (prev === key ? null : key));
                  }
                }}
                className={`cursor-pointer transition-colors ${bg} hover:brightness-110 ${
                  seleccionado
                    ? "relative z-[1] bg-amber-950/55 shadow-[inset_0_0_0_9999px_rgba(245,158,11,0.12)] ring-2 ring-inset ring-amber-400"
                    : ""
                }`}
              >
                <td className={`${cellPad} ${borderR} relative truncate font-mono text-slate-200`} title={ln.codigo}>
                  {ln.codigo}
                  {resizeHandle(0, COL_LABELS[0])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate font-mono text-slate-400`} title={ln.codigoPieza}>
                  {ln.codigoPieza}
                  {resizeHandle(1, COL_LABELS[1])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-slate-400`} title={ln.medida}>
                  {ln.medida}
                  {resizeHandle(2, COL_LABELS[2])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-slate-200`} title={ln.nombre}>
                  {ln.nombre}
                  {resizeHandle(3, COL_LABELS[3])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-slate-400`} title={ln.repuesto ?? ""}>
                  {ln.repuesto ?? "—"}
                  {resizeHandle(4, COL_LABELS[4])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-slate-400`} title={ln.marcaAuto ?? ""}>
                  {ln.marcaAuto ?? "—"}
                  {resizeHandle(5, COL_LABELS[5])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-slate-400`} title={ln.procedencia ?? ""}>
                  {ln.procedencia ?? "—"}
                  {resizeHandle(6, COL_LABELS[6])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-slate-400`} title={ln.unidad ?? ""}>
                  {ln.unidad ?? "—"}
                  {resizeHandle(7, COL_LABELS[7])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-right tabular-nums`}>
                  {ln.cantidad}
                  {resizeHandle(8, COL_LABELS[8])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-right font-mono tabular-nums`}>
                  {ln.precioUnitarioBs.toFixed(2)}
                  {resizeHandle(9, COL_LABELS[9])}
                </td>
                <td className={`${cellPad} ${borderR} relative truncate text-right font-mono tabular-nums text-slate-100`}>
                  {ln.totalLineaBs.toFixed(2)}
                  {resizeHandle(10, COL_LABELS[10])}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
