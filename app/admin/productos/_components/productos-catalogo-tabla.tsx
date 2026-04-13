"use client";

import { ProductoQrImagenesControls } from "@/app/admin/productos/_components/producto-qr-imagenes-controls";
import type { SucursalRow } from "@/lib/data/sucursales";
import type { ProductoCatalogoRowConStock } from "@/lib/data/productos-catalogo";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COL_MIN = 40;
const cellPad = "px-2 py-1.5";

function defaultColWidths(sucCount: number): number[] {
  const base = [88, 72, 112, 88, 220, 72, 72, 72, 88, 56, 120, 72, 88, 88, 56];
  /* Columnas sucursal: ancho para nombre completo (se puede estirar después). */
  const suc = Array.from({ length: sucCount }, () => 128);
  return [...base, ...suc, 80, 72];
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
      "Descripción",
      "Repuesto",
      "Proced.",
      "Proveedor",
      "Marca",
      "Unidad",
      "Medida",
      "P. compra",
      "P. venta Bs",
      "P. venta USD",
      "Stock",
    ];
    const suc = sucursales.map((s) => s.nombre);
    return [...base, ...suc, "P. tope", "Acción"];
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

  const nSuc = sucursales.length;
  const colSpan = 17 + nSuc;
  const idxSucStart = 15;
  const idxAccion = labels.length - 1;

  return (
    <div className="max-h-[min(75dvh,720px)] overflow-y-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40 overscroll-contain">
      <table
        className="table-fixed border-collapse text-left text-xs"
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] border-b border-white/10 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/20">
          <tr>
            {labels.map((label, i) => {
              const isSuc = i >= idxSucStart && i < idxSucStart + nSuc;
              const isAccion = i === idxAccion;
              const sucursalCol = isSuc ? sucursales[i - idxSucStart] : null;
              const thTitle = isSuc
                ? `${sucursalCol?.nombre ?? label} · arrastrá el borde derecho para ancho`
                : "Arrastrá el borde derecho para cambiar el ancho";
              return (
                <th
                  key={isSuc && sucursalCol ? `suc-${sucursalCol.id}` : `col-${i}`}
                  className={`${cellPad} relative select-none ${isSuc || i === 14 ? "text-center" : ""} ${isAccion ? "text-right" : ""} ${isSuc ? "align-bottom font-medium normal-case text-slate-300" : ""}`}
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
                  <span
                    className="absolute right-0 top-0 z-10 h-full w-3 max-w-[12px] cursor-col-resize hover:bg-sky-500/25"
                    style={{ transform: "translateX(50%)" }}
                    onMouseDown={(e) => beginColumnResize(e, i)}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Redimensionar columna ${label}`}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
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
                  <td className={`${cellPad} whitespace-nowrap`}>
                    <ProductoQrImagenesControls
                      codigo={r.codigo}
                      qrPayload={r.qr_payload}
                      imagenesUrls={r.imagenes_urls}
                      onOpenInteraction={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.codigo}</td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.codigo_pieza ?? "—"}</td>
                  <td className={`${cellPad} truncate`}>{r.especificacion ?? "—"}</td>
                  <td className={`${cellPad} truncate font-medium`} title={r.descripcion ?? ""}>
                    {r.descripcion ?? r.nombre}
                  </td>
                  <td className={`${cellPad} truncate`}>{r.repuesto ?? "—"}</td>
                  <td className={`${cellPad} truncate`}>{r.procedencia ?? "—"}</td>
                  <td className={`${cellPad} truncate opacity-80`}>—</td>
                  <td className={`${cellPad} truncate`}>{r.marca_auto ?? "—"}</td>
                  <td className={`${cellPad} truncate`}>{r.unidad ?? "—"}</td>
                  <td className={`${cellPad} truncate text-[11px] font-mono ${tone.mono}`} title={r.medida ?? ""}>
                    {r.medida ?? "—"}
                  </td>
                  <td className={`${cellPad} truncate opacity-80`}>—</td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.precio_venta_lista_bs ?? "—"}</td>
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.precio_venta_lista_usd ?? "—"}</td>
                  <td className={`${cellPad} truncate text-center font-semibold font-mono ${tone.mono}`}>
                    {r.stock_total}
                  </td>
                  {sucursales.map((s) => {
                    const q = r.stocksPorSucursal.get(s.id) ?? 0;
                    return (
                      <td key={s.id} className={`${cellPad} text-center font-mono ${tone.mono}`}>
                        {q}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} truncate font-mono ${tone.mono}`}>{r.punto_tope ?? "—"}</td>
                  <td className={`${cellPad} text-right`}>
                    <Link
                      href={`/admin/productos/${r.id}`}
                      className="font-medium text-sky-300 hover:text-sky-200 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Editar
                    </Link>
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
