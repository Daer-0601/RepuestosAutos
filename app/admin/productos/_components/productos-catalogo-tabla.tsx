"use client";

import { ProductoQrImagenesControls } from "@/app/admin/productos/_components/producto-qr-imagenes-controls";
import type { SucursalRow } from "@/lib/data/sucursales";
import type { ProductoCatalogoRowConStock } from "@/lib/data/productos-catalogo";
import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COL_MIN = 40;
const cellPad = "px-2 py-1.5";

function cellBorderR(variant: "admin" | "cajero") {
  return variant === "cajero" ? "border-r border-emerald-500/35" : "border-r border-sky-500/35";
}

function defaultColWidths(
  sucCount: number,
  opts: { mostrarPrecioCompra: boolean; mostrarAccion: boolean }
): number[] {
  const baseCore = [88, 72, 112, 88, 120, 220, 72, 72, 72, 88, 56, 72];
  if (opts.mostrarPrecioCompra) baseCore.push(88);
  baseCore.push(88, 88);
  const suc = Array.from({ length: sucCount }, () => 128);
  const tail = [56, 80];
  if (opts.mostrarAccion) tail.push(72);
  return [...baseCore, ...suc, ...tail];
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
  modoAccion = "editar",
  mostrarPrecioCompra = true,
  variant = "admin",
  sucursalReferenciaId = null,
  onAgregar,
  idsEnCarrito,
}: {
  rows: ProductoCatalogoRowConStock[];
  sucursales: SucursalRow[];
  /** En traspasos u otros pickers: botón agregar en lugar de enlace Editar. */
  modoAccion?: "editar" | "agregar" | "solo-lectura";
  /** Oculta columna de precio de compra (p. ej. catálogo cajero). */
  mostrarPrecioCompra?: boolean;
  variant?: "admin" | "cajero";
  /** Resalta la columna de stock de esta sucursal (p. ej. origen del traspaso). */
  sucursalReferenciaId?: number | null;
  onAgregar?: (row: ProductoCatalogoRowConStock) => void;
  /** Productos ya cargados en el traspaso (deshabilita agregar duplicado). */
  idsEnCarrito?: ReadonlySet<number>;
}) {
  const mostrarAccion = modoAccion !== "solo-lectura";
  const borderR = cellBorderR(variant);
  const resizeHandleHover =
    variant === "cajero"
      ? "hover:bg-emerald-500/30 active:bg-emerald-500/40"
      : "hover:bg-sky-500/30 active:bg-sky-500/40";
  const tableBorder =
    variant === "cajero" ? "border-emerald-500/30" : "border-sky-500/30";
  const theadBorder =
    variant === "cajero" ? "border-emerald-500/45" : "border-sky-500/45";
  const tbodyDivide =
    variant === "cajero" ? "divide-emerald-500/30" : "divide-sky-500/30";
  const rowRing =
    variant === "cajero" ? "ring-emerald-400" : "ring-sky-400";
  const rowSelectedBg =
    variant === "cajero"
      ? "bg-emerald-950/55 shadow-[inset_0_0_0_9999px_rgba(16,185,129,0.12)]"
      : "bg-sky-950/55 shadow-[inset_0_0_0_9999px_rgba(56,189,248,0.12)]";
  const sucRefBg = variant === "cajero" ? "bg-emerald-500/15 text-emerald-100" : "bg-sky-500/15 text-sky-100";
  const sucRefCellBg = variant === "cajero" ? "bg-emerald-500/10" : "bg-sky-500/10";
  const linkClass =
    variant === "cajero"
      ? "font-medium text-emerald-300 hover:text-emerald-200 hover:underline"
      : "font-medium text-sky-300 hover:text-sky-200 hover:underline";
  const [colWidths, setColWidths] = useState<number[]>(() =>
    defaultColWidths(sucursales.length, { mostrarPrecioCompra, mostrarAccion })
  );
  const resizeDragRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);
  /** Fila marcada al hacer clic (mismo clic desmarca). */
  const [marcadoId, setMarcadoId] = useState<number | null>(null);

  useEffect(() => {
    const need =
      14 +
      (mostrarPrecioCompra ? 1 : 0) +
      (mostrarAccion ? 1 : 0) +
      sucursales.length;
    setColWidths((prev) =>
      prev.length === need
        ? prev
        : defaultColWidths(sucursales.length, { mostrarPrecioCompra, mostrarAccion })
    );
  }, [sucursales.length, mostrarPrecioCompra, mostrarAccion]);

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
    ];
    if (mostrarPrecioCompra) base.push("P. compra");
    base.push("P. venta USD", "P. venta Bs");
    const suc = sucursales.map((s) => s.nombre);
    const tail = ["Stock", "P. tope"];
    if (mostrarAccion) tail.push("Acción");
    return [...base, ...suc, ...tail];
  }, [sucursales, mostrarPrecioCompra, mostrarAccion]);

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
        className={`absolute right-0 top-0 z-20 h-full w-4 min-w-[14px] max-w-[18px] cursor-col-resize ${resizeHandleHover}`}
        style={{ transform: "translateX(50%)" }}
        onMouseDown={(e) => beginColumnResize(e, colIndex)}
        onClick={(e) => e.stopPropagation()}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Redimensionar columna ${label || colIndex}`}
      />
    ),
    [beginColumnResize, resizeHandleHover]
  );

  const nSuc = sucursales.length;
  const colSpan = labels.length;
  const idxPrecioVentaUsd = 11 + (mostrarPrecioCompra ? 1 : 0);
  const idxPrecioVentaBs = idxPrecioVentaUsd + 1;
  /** Primera columna de stock por sucursal (después de P. venta Bs). */
  const idxSucStart = idxPrecioVentaBs + 1;
  /** Stock total general, después de todas las sucursales. */
  const idxStockTotal = idxSucStart + nSuc;
  const idxPtope = idxStockTotal + 1;
  const idxAccion = mostrarAccion ? idxPtope + 1 : -1;

  return (
    <div className="max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 overscroll-contain">
      <table
        className={`table-fixed border-collapse border ${tableBorder} text-left text-xs`}
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className={`sticky top-0 z-[1] border-b-2 ${theadBorder} bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/20`}>
          <tr>
            {labels.map((label, i) => {
              const isSuc = i >= idxSucStart && i < idxSucStart + nSuc;
              const isAccion = i === idxAccion;
              const sucursalCol = isSuc ? sucursales[i - idxSucStart] : null;
              const esSucRef =
                isSuc && sucursalCol != null && sucursalReferenciaId != null && sucursalCol.id === sucursalReferenciaId;
              const thTitle = isSuc
                ? `${sucursalCol?.nombre ?? label}${esSucRef ? " (sucursal origen)" : ""} · arrastrá el borde derecho`
                : "Arrastrá el borde derecho de la columna (encabezado o celdas)";
              return (
                <th
                  key={isSuc && sucursalCol ? `suc-${sucursalCol.id}` : `col-${i}`}
                  className={`${cellPad} ${borderR} relative select-none ${isSuc || i === idxStockTotal ? "text-center" : ""} ${isAccion ? "text-right" : ""} ${isSuc ? "align-bottom font-medium normal-case text-slate-300" : ""} ${esSucRef ? sucRefBg : ""}`}
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
        <tbody className={`divide-y ${tbodyDivide}`}>
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
                      ? `relative z-[1] ring-2 ring-inset ${rowRing} ${rowSelectedBg}`
                      : ""
                  }`}
                >
                  <td className={`${cellPad} ${borderR} relative whitespace-nowrap`}>
                    <ProductoQrImagenesControls
                      codigo={r.codigo}
                      qrPayload={r.qr_payload}
                      descripcion={r.descripcion ?? r.nombre}
                      imagenesUrls={r.imagenes_urls}
                      onOpenInteraction={(e) => e.stopPropagation()}
                    />
                    {resizeHandle(0, labels[0] || "QR")}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate font-mono ${tone.mono}`}>
                    {r.codigo}
                    {resizeHandle(1, labels[1])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate font-mono ${tone.mono}`}>
                    {r.codigo_pieza ?? "—"}
                    {resizeHandle(2, labels[2])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate`}>
                    {r.especificacion ?? "—"}
                    {resizeHandle(3, labels[3])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate text-[11px] font-mono ${tone.mono}`} title={r.medida ?? ""}>
                    {r.medida ?? "—"}
                    {resizeHandle(4, labels[4])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate font-medium`} title={r.descripcion ?? ""}>
                    {r.descripcion ?? r.nombre}
                    {resizeHandle(5, labels[5])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate`}>
                    {r.repuesto ?? "—"}
                    {resizeHandle(6, labels[6])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate`}>
                    {r.procedencia ?? "—"}
                    {resizeHandle(7, labels[7])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate opacity-80`}>
                    {r.proveedor_nombre ?? "—"}
                    {resizeHandle(8, labels[8])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate`}>
                    {r.marca_auto ?? "—"}
                    {resizeHandle(9, labels[9])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate`}>
                    {r.unidad ?? "—"}
                    {resizeHandle(10, labels[10])}
                  </td>
                  {mostrarPrecioCompra ? (
                    <td
                      className={`${cellPad} ${borderR} relative truncate font-mono ${tone.mono}`}
                      title={
                        r.precio_compra_unitario_usd
                          ? `Última compra · USD unit.: ${r.precio_compra_unitario_usd}`
                          : r.precio_compra_unitario_bs
                            ? "Última compra confirmada (unitario Bs)"
                            : undefined
                      }
                    >
                      {r.precio_compra_unitario_bs ?? "—"}
                      {resizeHandle(idxPrecioVentaUsd - 1, labels[idxPrecioVentaUsd - 1] ?? "P. compra")}
                    </td>
                  ) : null}
                  <td className={`${cellPad} ${borderR} relative truncate font-mono ${tone.mono}`}>
                    {r.precio_venta_lista_usd ?? "—"}
                    {resizeHandle(idxPrecioVentaUsd, labels[idxPrecioVentaUsd] ?? "P. venta USD")}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate font-mono ${tone.mono}`}>
                    {r.precio_venta_lista_bs ?? "—"}
                    {resizeHandle(idxPrecioVentaBs, labels[idxPrecioVentaBs] ?? "P. venta Bs")}
                  </td>
                  {sucursales.map((s, si) => {
                    const q = r.stocksPorSucursal.get(s.id) ?? 0;
                    const colI = idxSucStart + si;
                    const esSucRef =
                      sucursalReferenciaId != null && s.id === sucursalReferenciaId;
                    return (
                      <td
                        key={s.id}
                        className={`${cellPad} ${borderR} relative text-center font-mono ${tone.mono} ${esSucRef ? `${sucRefCellBg} font-semibold` : ""}`}
                      >
                        {q}
                        {resizeHandle(colI, labels[colI] ?? s.nombre)}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} ${borderR} relative truncate text-center font-semibold font-mono ${tone.mono}`}>
                    {r.stock_total}
                    {resizeHandle(idxStockTotal, labels[idxStockTotal])}
                  </td>
                  <td className={`${cellPad} ${borderR} relative truncate font-mono ${tone.mono}`}>
                    {r.punto_tope ?? "—"}
                    {resizeHandle(idxPtope, labels[idxPtope])}
                  </td>
                  {mostrarAccion ? (
                    <td className={`${cellPad} ${borderR} relative text-right`}>
                      {modoAccion === "agregar" && onAgregar ? (
                        (() => {
                          const stockRef =
                            sucursalReferenciaId != null
                              ? r.stocksPorSucursal.get(sucursalReferenciaId) ?? 0
                              : r.stock_total;
                          const yaEnLista = idsEnCarrito?.has(r.id) ?? false;
                          const puede = stockRef > 0;
                          return (
                            <button
                              type="button"
                              disabled={!puede}
                              title={
                                stockRef < 1
                                  ? "Sin stock en la sucursal origen."
                                  : yaEnLista
                                    ? "Sumar una unidad más al traspaso"
                                    : "Agregar al traspaso"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (puede) onAgregar(r);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/15 px-2.5 py-1 text-[11px] font-medium text-sky-100 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />
                              {yaEnLista ? "+1" : "Agregar"}
                            </button>
                          );
                        })()
                      ) : (
                        <Link
                          href={`/admin/productos/${r.id}`}
                          className={linkClass}
                          onClick={(e) => e.stopPropagation()}
                        >
                          Editar
                        </Link>
                      )}
                      {resizeHandle(idxAccion, labels[idxAccion] ?? "Acción")}
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
