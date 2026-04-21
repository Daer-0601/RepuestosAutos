"use client";

import type { VentaCatalogoApiRow } from "@/lib/types/venta-vendedor-catalogo";
import { ShoppingCart } from "lucide-react";

const cellPad = "border-r border-amber-500/25 px-2 py-1.5 align-middle text-xs";

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
}: {
  miSucursalId: number;
  sucursales: { id: number; nombre: string }[];
  rows: VentaCatalogoApiRow[];
  loading: boolean;
  /** true = todavía no se pulsó «Buscar» */
  sinConsulta: boolean;
  onAgregar: (row: VentaCatalogoApiRow) => void;
}) {
  const colSpan = 8 + sucursales.length;

  return (
    <div className="max-h-[min(70dvh,640px)] overflow-auto rounded-2xl border border-amber-500/20 bg-slate-900/40 overscroll-contain">
      <table className="w-max min-w-full border-collapse border border-amber-500/30 text-left">
        <thead className="sticky top-0 z-[1] border-b-2 border-amber-500/40 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm shadow-black/25">
          <tr>
            <th className={`${cellPad} min-w-[88px]`}>Código</th>
            <th className={`${cellPad} min-w-[88px]`}>Cód. pieza</th>
            <th className={`${cellPad} min-w-[72px]`}>Medida</th>
            <th className={`${cellPad} min-w-[200px]`}>Nombre / desc.</th>
            <th className={`${cellPad} min-w-[80px] text-right`}>P. lista Bs</th>
            <th className={`${cellPad} min-w-[80px] text-right`}>P. lista USD</th>
            <th className={`${cellPad} min-w-[72px] text-right`}>P. tope</th>
            {sucursales.map((s) => (
              <th
                key={s.id}
                className={`${cellPad} max-w-[100px] text-center font-medium normal-case leading-tight text-slate-300 ${
                  s.id === miSucursalId ? "bg-amber-500/10 text-amber-100/95" : ""
                }`}
                title={s.id === miSucursalId ? "Tu sucursal (solo acá podés descontar stock)" : s.nombre}
              >
                <span className="line-clamp-3 break-words">{s.nombre}</span>
              </th>
            ))}
            <th className={`${cellPad} min-w-[56px] text-center`}>Total</th>
            <th className={`${cellPad} min-w-[88px] text-right`}>Acción</th>
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
                Elegí filtros y pulsá «Buscar» para ver productos, precios y stock por sucursal.
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
              const puede = mi > 0;
              const tone = filaTone(r, miSucursalId);
              const stripe = idx % 2 === 0 ? "" : "brightness-[0.98]";
              return (
                <tr key={r.id} className={`${tone} ${stripe}`}>
                  <td className={`${cellPad} font-mono text-amber-200/85`}>{r.codigo}</td>
                  <td className={`${cellPad} font-mono text-slate-400`}>{r.codigo_pieza ?? "—"}</td>
                  <td className={`${cellPad} font-mono text-[11px] text-slate-400`}>{r.medida ?? "—"}</td>
                  <td className={`${cellPad} max-w-[280px]`}>
                    <span className="line-clamp-2 font-medium text-slate-100" title={r.descripcion ?? r.nombre}>
                      {r.descripcion?.trim() ? r.descripcion : r.nombre}
                    </span>
                  </td>
                  <td className={`${cellPad} text-right font-mono text-slate-200`}>
                    {fmtMoneda(r.precio_venta_lista_bs, 2)}
                  </td>
                  <td className={`${cellPad} text-right font-mono text-slate-300`}>
                    {fmtMoneda(r.precio_venta_lista_usd, 4)}
                  </td>
                  <td className={`${cellPad} text-right font-mono text-amber-100/80`}>
                    {fmtMoneda(r.punto_tope, 2)}
                  </td>
                  {sucursales.map((s) => {
                    const q = r.stocksPorSucursal.find((x) => x.sucursalId === s.id)?.stock ?? 0;
                    const esMi = s.id === miSucursalId;
                    return (
                      <td
                        key={s.id}
                        className={`${cellPad} text-center font-mono ${
                          esMi ? "bg-amber-500/5 font-semibold text-amber-100/90" : "text-slate-400"
                        } ${q > 0 ? "text-emerald-200/90" : ""}`}
                      >
                        {q}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} text-center font-mono font-semibold text-slate-200`}>{r.stock_total}</td>
                  <td className={`${cellPad} text-right`}>
                    <button
                      type="button"
                      disabled={!puede}
                      title={
                        puede
                          ? "Agregar al carrito (stock en tu sucursal)"
                          : "Sin stock en tu sucursal; pedí traspaso o venda desde la sucursal que tenga."
                      }
                      onClick={() => onAgregar(r)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-100 transition hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />
                      Agregar
                    </button>
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
