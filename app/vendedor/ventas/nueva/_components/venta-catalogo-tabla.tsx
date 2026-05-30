"use client";

import { ProductoQrImagenesControls } from "@/app/admin/productos/_components/producto-qr-imagenes-controls";
import type { VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import { ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

const COL_MIN = 40;
/** Columnas fijas antes de sucursales: Img/QR … Precio Tope */
const FIXED_COLS = 9;

/** Anchos iniciales: 9 fijas + N sucursales + Total + Acción */
function defaultColWidths(numSucursales: number): number[] {
  const base = [88, 88, 72, 220, 80, 80, 88, 88, 72];
  const porSuc = 88;
  const tail = [64, 104];
  return [...base, ...Array(Math.max(0, numSucursales)).fill(porSuc), ...tail];
}

const cellPad =
  "border-b border-amber-500/15 border-r border-amber-500/20 px-2 py-2 align-middle text-xs";

function fmtMoneda(s: string | null, dec: number): string {
  if (s == null || s === "") return "—";
  const n = Number(s);
  return Number.isFinite(n) ? n.toFixed(dec) : "—";
}

function stockMi(row: VentaCatalogoApiRow, miSucursalId: number): number {
  return row.stocksPorSucursal.find((x) => x.sucursalId === miSucursalId)?.stock ?? 0;
}

function filaTone(row: VentaCatalogoApiRow, miSucursalId: number): string {
  const mi = stockMi(row, miSucursalId);
  if (mi > 0) return "bg-emerald-950/25 text-slate-200";
  if (row.stock_total > 0) return "bg-amber-950/15 text-slate-300";
  return "bg-slate-950/40 text-slate-500";
}

export function VentaCatalogoTabla({
  miSucursalId,
  sucursales,
  rows,
  loading,
  sinConsulta,
  onAgregar,
  /** Cotizaciones: se puede agregar aunque no haya stock en la sucursal. */
  permitirSinStock = false,
}: {
  miSucursalId: number;
  sucursales: { id: number; nombre: string }[];
  rows: VentaCatalogoApiRow[];
  loading: boolean;
  /** true = todavía no se pulsó «Buscar» */
  sinConsulta: boolean;
  onAgregar: (row: VentaCatalogoApiRow) => void;
  permitirSinStock?: boolean;
}) {
  const nSuc = sucursales.length;
  const nCols = FIXED_COLS + nSuc + 2;
  const sucStart = FIXED_COLS;
  const totalCol = FIXED_COLS + nSuc;
  const accionCol = FIXED_COLS + nSuc + 1;

  const [colWidths, setColWidths] = useState<number[]>(() => defaultColWidths(nSuc));

  useEffect(() => {
    setColWidths((prev) => (prev.length === nCols ? prev : defaultColWidths(nSuc)));
  }, [nCols, nSuc]);

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

  const colSpan = nCols;

  const labelAt = useCallback(
    (i: number): string => {
      if (i === 0) return "Img / QR";
      if (i === 1) return "Código";
      if (i === 2) return "Medida";
      if (i === 3) return "Nombre";
      if (i === 4) return "Marca";
      if (i === 5) return "Procedencia";
      if (i === 6) return "Unidad";
      if (i === 7) return "Precio Lista";
      if (i === 8) return "Precio Tope";
      if (i >= sucStart && i < sucStart + nSuc) {
        const s = sucursales[i - sucStart];
        return s ? s.nombre.slice(0, 24) : `Sucursal ${i - sucStart + 1}`;
      }
      if (i === totalCol) return "Total";
      if (i === accionCol) return "Acción";
      return `col-${i}`;
    },
    [accionCol, nSuc, sucStart, sucursales, totalCol]
  );

  return (
    <div className="max-h-[min(70dvh,640px)] overflow-auto rounded-2xl border border-amber-500/20 bg-slate-900/40 overscroll-contain">
      <table
        className="table-fixed border-collapse border border-amber-500/30 text-left text-xs"
        style={{ width: tablaAnchoPx, minWidth: tablaAnchoPx }}
      >
        <colgroup>
          {colWidths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-[1] border-b-2 border-amber-500/40 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/25">
          <tr>
            <th className={`${cellPad} relative select-none text-center`} title="Arrastrá el borde derecho para ancho">
              Img / QR
              {resizeHandle(0, "Img / QR")}
            </th>
            <th className={`${cellPad} relative select-none`}>
              Código
              {resizeHandle(1, "Código")}
            </th>
            <th className={`${cellPad} relative select-none`}>
              Medida
              {resizeHandle(2, "Medida")}
            </th>
            <th className={`${cellPad} relative select-none`}>
              Nombre
              {resizeHandle(3, "Nombre")}
            </th>
            <th className={`${cellPad} relative select-none`}>
              Marca
              {resizeHandle(4, "Marca")}
            </th>
            <th className={`${cellPad} relative select-none`}>
              Procedencia
              {resizeHandle(5, "Procedencia")}
            </th>
            <th className={`${cellPad} relative select-none`}>
              Unidad
              {resizeHandle(6, "Unidad")}
            </th>
            <th className={`${cellPad} relative select-none text-right`}>
              Precio Lista
              {resizeHandle(7, "Precio Lista")}
            </th>
            <th className={`${cellPad} relative select-none text-right`}>
              Precio Tope
              {resizeHandle(8, "Precio Tope")}
            </th>
            {sucursales.map((s, si) => {
              const i = sucStart + si;
              return (
                <th
                  key={s.id}
                  className={`${cellPad} relative select-none text-center font-medium normal-case leading-tight text-slate-300 ${
                    s.id === miSucursalId ? "bg-amber-500/10 text-amber-100/95" : ""
                  }`}
                  title={
                    s.id === miSucursalId
                      ? permitirSinStock
                        ? "Tu sucursal (solo referencia en cotización)"
                        : "Tu sucursal (solo acá podés descontar stock)"
                      : s.nombre
                  }
                >
                  <span className="line-clamp-3 break-words">{s.nombre}</span>
                  {resizeHandle(i, s.nombre)}
                </th>
              );
            })}
            <th className={`${cellPad} relative select-none text-center`}>
              Total
              {resizeHandle(totalCol, "Total")}
            </th>
            <th className={`${cellPad} relative select-none text-right`}>
              Acción
              {resizeHandle(accionCol, "Acción")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-amber-500/20">
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
                Buscando…
              </td>
            </tr>
          ) : sinConsulta ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
                {permitirSinStock
                  ? "Elegí filtros y pulsá «Buscar» para ver productos, precios y stock (solo referencia)."
                  : "Elegí filtros y pulsá «Buscar» para ver productos, precios y stock por sucursal."}
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">
                Sin resultados. Probá otro filtro o modo de stock.
              </td>
            </tr>
          ) : (
            rows.map((r, idx) => {
              const mi = stockMi(r, miSucursalId);
              const puede = permitirSinStock || mi > 0;
              const tone = permitirSinStock ? "bg-slate-950/30 text-slate-200" : filaTone(r, miSucursalId);
              const stripe = idx % 2 === 0 ? "" : "brightness-[0.98]";
              const img0 = r.imagenes_urls?.[0] ?? "";
              const qrPayload = (r.qr_payload ?? "").trim() || r.codigo;
              const descQr = (r.descripcion ?? "").trim() || r.nombre;
              return (
                <tr key={r.id} className={`${tone} ${stripe}`}>
                  <td className={`${cellPad} relative align-middle`}>
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
                        codigo={r.codigo}
                        qrPayload={qrPayload}
                        descripcion={descQr}
                        imagenesUrls={Array.isArray(r.imagenes_urls) ? r.imagenes_urls : []}
                        size="sm"
                        onOpenInteraction={(e) => e.stopPropagation()}
                      />
                    </div>
                    {resizeHandle(0, labelAt(0))}
                  </td>
                  <td className={`${cellPad} relative truncate font-mono text-amber-200/85`}>
                    {r.codigo}
                    {resizeHandle(1, labelAt(1))}
                  </td>
                  <td className={`${cellPad} relative truncate font-mono text-[11px] text-slate-400`} title={r.medida ?? ""}>
                    {r.medida ?? "—"}
                    {resizeHandle(2, labelAt(2))}
                  </td>
                  <td className={`${cellPad} relative`}>
                    <span className="line-clamp-2 font-medium text-slate-100" title={r.nombre}>
                      {r.nombre}
                    </span>
                    {resizeHandle(3, labelAt(3))}
                  </td>
                  <td className={`${cellPad} relative truncate text-slate-300`} title={r.marca_auto ?? ""}>
                    {r.marca_auto ?? "—"}
                    {resizeHandle(4, labelAt(4))}
                  </td>
                  <td className={`${cellPad} relative truncate text-slate-400`} title={r.procedencia ?? ""}>
                    {r.procedencia ?? "—"}
                    {resizeHandle(5, labelAt(5))}
                  </td>
                  <td className={`${cellPad} relative truncate text-slate-400`} title={r.unidad ?? ""}>
                    {r.unidad ?? "—"}
                    {resizeHandle(6, labelAt(6))}
                  </td>
                  <td className={`${cellPad} relative text-right font-mono text-slate-200`}>
                    {fmtMoneda(r.precio_venta_lista_bs, 2)}
                    {resizeHandle(7, labelAt(7))}
                  </td>
                  <td className={`${cellPad} relative text-right font-mono text-amber-100/80`}>
                    {fmtMoneda(r.punto_tope, 2)}
                    {resizeHandle(8, labelAt(8))}
                  </td>
                  {sucursales.map((s, si) => {
                    const i = sucStart + si;
                    const q = r.stocksPorSucursal.find((x) => x.sucursalId === s.id)?.stock ?? 0;
                    const esMi = s.id === miSucursalId;
                    return (
                      <td
                        key={s.id}
                        className={`${cellPad} relative text-center font-mono ${
                          esMi ? "bg-amber-500/5 font-semibold text-amber-100/90" : "text-slate-400"
                        } ${q > 0 ? "text-emerald-200/90" : ""}`}
                      >
                        {q}
                        {resizeHandle(i, labelAt(i))}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} relative text-center font-mono font-semibold text-slate-200`}>
                    {r.stock_total}
                    {resizeHandle(totalCol, labelAt(totalCol))}
                  </td>
                  <td className={`${cellPad} relative text-right`}>
                    <button
                      type="button"
                      disabled={!puede}
                      title={
                        permitirSinStock
                          ? "Agregar a la cotización (el stock no limita el presupuesto)"
                          : puede
                            ? "Agregar al carrito (stock en tu sucursal)"
                            : "Sin stock en tu sucursal; pedí traspaso o venda desde la sucursal que tenga."
                      }
                      onClick={() => onAgregar(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />
                      Agregar
                    </button>
                    {resizeHandle(accionCol, labelAt(accionCol))}
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
