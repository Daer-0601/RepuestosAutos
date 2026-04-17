"use client";

import { ProductoQrImagenesControls } from "@/app/admin/productos/_components/producto-qr-imagenes-controls";
import type { SucursalRow } from "@/lib/data/sucursales";
import type { ProductoCatalogoRowConStock } from "@/lib/data/productos-catalogo";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COL_MIN = 40;
const cellPad = "px-2 py-1.5";
/** Líneas verticales entre columnas (color distinto al fondo). */
const cellBorderR = "border-r border-sky-500/35";

function defaultColWidths(sucCount: number): number[] {
  /* … P. venta Bs, luego sucursales, stock total, P. tope, acción */
  const baseCore = [88, 72, 112, 88, 120, 220, 72, 72, 72, 88, 56, 72, 88, 88];
  const suc = Array.from({ length: sucCount }, () => 128);
  return [...baseCore, ...suc, 56, 80, 72];
}

function filaPorStock(stockTotal: number): { tr: string; mono: string } {
  const hay = stockTotal > 0;
  return {
    tr: hay ? "text-emerald-400" : "text-rose-400",
    mono: hay ? "font-mono text-emerald-400" : "font-mono text-rose-400",
  };
}

export function ProductosCatalogoTabla({
  rows,
  sucursales,
}: {
  rows: ProductoCatalogoRowConStock[];
  sucursales: SucursalRow[];
}) {
  const [colWidths, setColWidths] = useState<number[]>(() => defaultColWidths(sucursales.length));
  const resizeDragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  /** Fila marcada al hacer clic (mismo clic desmarca). */
  const [marcadoId, setMarcadoId] = useState<number | null>(null);

  useEffect(() => {
    const need = 17 + sucursales.length;
    setColWidths((prev) => (prev.length === need ? prev : defaultColWidths(sucursales.length)));
  }, [sucursales.length]);

  useEffect(() => {
    setMarcadoId((id) => {
      if (id == null) return null;
      return rows.some((r) => r.id === id) ? id : null;
    });
  }, [rows]);

  const tablaAnchoPx = useMemo(() => colWidths.reduce((a, w) => a + w, 0), [colWidths]);

  const labels = useMemo(() => {
    const base = [
      "",
      "Código",
      "Cód. pieza",
      "Especificación",
      "Medida",
      "Descripción",
      "Repuesto",
      "Proced.",
      "Proveedor",
      "Marca",
      "Unidad",
      "P. compra",
      "P. venta USD",
      "P. venta Bs",
    ];
    const suc = sucursales.map((s) => s.nombre);
    return [...base, ...suc, "Stock", "P. tope", "Acción"];
  }, [sucursales]);

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

  /** Borde derecho de la columna: usable en cabecera y en cualquier fila. */
  const resizeHandle = useCallback(
    (colIndex: number, label: string) => (
      <span
        className="absolute right-0 top-0 z-20 h-full w-4 min-w-[14px] max-w-[18px] cursor-col-resize hover:bg-sky-500/30 active:bg-sky-500/40"
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

  const nSuc = sucursales.length;
  const colSpan = 17 + nSuc;
  /** Primera columna de stock por sucursal (después de P. venta Bs). */
  const idxSucStart = 14;
  /** Stock total general, después de todas las sucursales. */
  const idxStockTotal = 14 + nSuc;
  const idxPtope = idxStockTotal + 1;
  const idxAccion = labels.length - 1;

  return (
    <div className="max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 overscroll-contain">
      <table
        className="table-fixed border-collapse border border-sky-500/30 text-left text-xs"
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] border-b-2 border-sky-500/45 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/20">
          <tr>
            {labels.map((label, i) => {
              const isSuc = i >= idxSucStart && i < idxSucStart + nSuc;
              const isAccion = i === idxAccion;
              const sucursalCol = isSuc ? sucursales[i - idxSucStart] : null;
              const thTitle = isSuc
                ? `${sucursalCol?.nombre ?? label} · arrastrá el borde derecho (aquí o en la tabla)`
                : "Arrastrá el borde derecho de la columna (encabezado o celdas)";
              return (
                <th
                  key={isSuc && sucursalCol ? `suc-${sucursalCol.id}` : `col-${i}`}
                  className={`${cellPad} ${cellBorderR} relative select-none ${isSuc || i === idxStockTotal ? "text-center" : ""} ${isAccion ? "text-right" : ""} ${isSuc ? "align-bottom font-medium normal-case text-slate-300" : ""}`}
                  title={thTitle}
                >
                  <span
                    className={
                      isSuc
                        ? "inline-block max-w-full whitespace-normal break-words text-center leading-snug"
                        : i === 0
                          ? "sr-only"
                          : ""
                    }
                  >
                    {i === 0 ? "Ver QR e imágenes" : label}
                  </span>
                  {resizeHandle(i, label)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-sky-500/30">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-slate-500">
                No hay productos con estos filtros.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => {
              const tone = filaPorStock(r.stock_total);
              const bg =
                r.stock_total > 0
                  ? idx % 2 === 0
                    ? "bg-emerald-950/20"
                    : "bg-emerald-950/10"
                  : idx % 2 === 0
                    ? "bg-rose-950/20"
                    : "bg-rose-950/10";
              const seleccionado = marcadoId === r.id;
              return (
                <tr
                  key={r.id}
                  tabIndex={0}
                  aria-selected={seleccionado}
                  onClick={() => setMarcadoId((prev) => (prev === r.id ? null : r.id))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMarcadoId((prev) => (prev === r.id ? null : r.id));
                    }
                  }}
                  className={`cursor-pointer transition-colors ${bg} ${tone.tr} hover:brightness-110 ${
                    seleccionado
                      ? "relative z-[1] ring-2 ring-inset ring-sky-400 bg-sky-950/55 shadow-[inset_0_0_0_9999px_rgba(56,189,248,0.12)]"
                      : ""
                  }`}
                >
                  <td className={`${cellPad} ${cellBorderR} relative whitespace-nowrap`}>
                    <ProductoQrImagenesControls
                      codigo={r.codigo}
                      qrPayload={r.qr_payload}
                      imagenesUrls={r.imagenes_urls}
                      onOpenInteraction={(e) => e.stopPropagation()}
                    />
                    {resizeHandle(0, labels[0] || "QR")}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate font-mono ${tone.mono}`}>
                    {r.codigo}
                    {resizeHandle(1, labels[1])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate font-mono ${tone.mono}`}>
                    {r.codigo_pieza ?? "—"}
                    {resizeHandle(2, labels[2])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate`}>
                    {r.especificacion ?? "—"}
                    {resizeHandle(3, labels[3])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate text-[11px] font-mono ${tone.mono}`} title={r.medida ?? ""}>
                    {r.medida ?? "—"}
                    {resizeHandle(4, labels[4])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate font-medium`} title={r.descripcion ?? ""}>
                    {r.descripcion ?? r.nombre}
                    {resizeHandle(5, labels[5])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate`}>
                    {r.repuesto ?? "—"}
                    {resizeHandle(6, labels[6])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate`}>
                    {r.procedencia ?? "—"}
                    {resizeHandle(7, labels[7])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate opacity-80`}>
                    {r.proveedor_nombre ?? "—"}
                    {resizeHandle(8, labels[8])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate`}>
                    {r.marca_auto ?? "—"}
                    {resizeHandle(9, labels[9])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate`}>
                    {r.unidad ?? "—"}
                    {resizeHandle(10, labels[10])}
                  </td>
                  <td
                    className={`${cellPad} ${cellBorderR} relative truncate font-mono ${tone.mono}`}
                    title={
                      r.precio_compra_unitario_usd
                        ? `Última compra · USD unit.: ${r.precio_compra_unitario_usd}`
                        : r.precio_compra_unitario_bs
                          ? "Última compra confirmada (unitario Bs)"
                          : undefined
                    }
                  >
                    {r.precio_compra_unitario_bs ?? "—"}
                    {resizeHandle(11, labels[11])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate font-mono ${tone.mono}`}>
                    {r.precio_venta_lista_usd ?? "—"}
                    {resizeHandle(12, labels[12])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate font-mono ${tone.mono}`}>
                    {r.precio_venta_lista_bs ?? "—"}
                    {resizeHandle(13, labels[13])}
                  </td>
                  {sucursales.map((s, si) => {
                    const q = r.stocksPorSucursal.get(s.id) ?? 0;
                    const colI = idxSucStart + si;
                    return (
                      <td key={s.id} className={`${cellPad} ${cellBorderR} relative text-center font-mono ${tone.mono}`}>
                        {q}
                        {resizeHandle(colI, labels[colI] ?? s.nombre)}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} ${cellBorderR} relative truncate text-center font-semibold font-mono ${tone.mono}`}>
                    {r.stock_total}
                    {resizeHandle(idxStockTotal, labels[idxStockTotal])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative truncate font-mono ${tone.mono}`}>
                    {r.punto_tope ?? "—"}
                    {resizeHandle(idxPtope, labels[idxPtope])}
                  </td>
                  <td className={`${cellPad} ${cellBorderR} relative text-right`}>
                    <Link
                      href={`/admin/productos/${r.id}`}
                      className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Editar
                    </Link>
                    {resizeHandle(idxAccion, labels[idxAccion])}
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
