"use client";

import { ProductoQrImagenesControls } from "@/app/admin/productos/_components/producto-qr-imagenes-controls";
import { Trash2 } from "lucide-react";

export type BajaLineaRow = {
  key: string;
  productoId: number;
  codigo: string;
  codigoPieza: string | null;
  medida: string | null;
  nombre: string;
  unidad: string | null;
  descripcion: string | null;
  qrPayload: string;
  imagenesUrls: string[];
  stockSucursal: number;
  cantidad: string;
};

const cellPad = "border-b border-rose-500/20 border-r border-rose-500/30 px-2 py-2 align-top text-xs";
const inp =
  "w-full min-w-0 rounded border border-white/10 bg-slate-950/90 px-1.5 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-rose-500/50";

const N_COLS = 10;

export function BajaLineasTabla({
  lineas,
  onCantidadChange,
  onCantidadBlur,
  onRemove,
}: {
  lineas: BajaLineaRow[];
  onCantidadChange: (key: string, value: string) => void;
  onCantidadBlur?: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-rose-500/25 bg-slate-900/40">
      <table className="w-full min-w-[960px] border-collapse border border-rose-500/30 text-left text-xs">
        <thead className="border-b-2 border-rose-500/40 bg-slate-950/95 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className={`${cellPad} w-[72px] text-center`}>Img / QR</th>
            <th className={`${cellPad} whitespace-nowrap`}>Código</th>
            <th className={`${cellPad} whitespace-nowrap`}>Cód. pieza</th>
            <th className={`${cellPad} whitespace-nowrap`}>Medida</th>
            <th className={`${cellPad} min-w-[180px]`}>Nombre</th>
            <th className={`${cellPad} whitespace-nowrap`}>Unidad</th>
            <th className={`${cellPad} w-20 text-right whitespace-nowrap`}>Stock actual</th>
            <th className={`${cellPad} w-24 text-right whitespace-nowrap`}>Cant. baja</th>
            <th className={`${cellPad} w-24 text-right whitespace-nowrap`}>Restante</th>
            <th className={`${cellPad} w-12 border-r-0`}>
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rose-500/20">
          {lineas.length === 0 ? (
            <tr>
              <td colSpan={N_COLS} className="px-4 py-10 text-center text-sm text-slate-500">
                Todavía no hay productos en esta baja. Buscá en el catálogo de arriba y pulsá Agregar.
              </td>
            </tr>
          ) : (
            lineas.map((ln) => {
              const cant = Math.trunc(Number(ln.cantidad));
              const cantOk = Number.isFinite(cant) && cant > 0 ? cant : 0;
              const restante = ln.stockSucursal - cantOk;
              const restNeg = restante < 0;
              const img0 = ln.imagenesUrls[0] ?? "";
              return (
                <tr key={ln.key} className="bg-slate-950/25 hover:bg-rose-950/20">
                  <td className={`${cellPad} text-center`}>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-rose-500/25 bg-black/40">
                        {img0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img0} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </div>
                      <ProductoQrImagenesControls
                        codigo={ln.codigo}
                        qrPayload={ln.qrPayload}
                        descripcion={ln.descripcion ?? ln.nombre}
                        imagenesUrls={ln.imagenesUrls}
                        size="sm"
                      />
                    </div>
                  </td>
                  <td className={`${cellPad} font-mono text-rose-200`}>{ln.codigo}</td>
                  <td className={`${cellPad} font-mono text-slate-400`}>{ln.codigoPieza?.trim() || "—"}</td>
                  <td className={`${cellPad} font-mono text-[11px] text-slate-400`} title={ln.medida ?? ""}>
                    {ln.medida?.trim() || "—"}
                  </td>
                  <td className={cellPad}>
                    <span className="line-clamp-3 font-medium text-slate-100" title={ln.nombre}>
                      {ln.nombre}
                    </span>
                  </td>
                  <td className={`${cellPad} text-slate-400`}>{ln.unidad?.trim() || "—"}</td>
                  <td className={`${cellPad} text-right font-mono text-emerald-300`}>{ln.stockSucursal}</td>
                  <td className={`${cellPad} text-right`}>
                    <input
                      className={`${inp} text-right`}
                      inputMode="numeric"
                      min={1}
                      value={ln.cantidad}
                      onChange={(e) => onCantidadChange(ln.key, e.target.value)}
                      onBlur={() => onCantidadBlur?.(ln.key)}
                    />
                  </td>
                  <td
                    className={`${cellPad} text-right font-mono font-medium ${restNeg ? "text-rose-300" : "text-sky-200"}`}
                  >
                    {restante}
                  </td>
                  <td className={`${cellPad} border-r-0 text-center`}>
                    <button
                      type="button"
                      onClick={() => onRemove(ln.key)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-200"
                      aria-label="Quitar línea"
                    >
                      <Trash2 className="h-4 w-4" />
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
