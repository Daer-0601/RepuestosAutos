import type { VentaDetalleProductoRow } from "@/lib/data/ventas-vendedor";

export function VentaDetalleProductosTabla({ lineas }: { lineas: VentaDetalleProductoRow[] }) {
  if (lineas.length === 0) {
    return <p className="text-xs text-slate-500">Sin productos en esta venta.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[880px] text-left text-xs">
        <thead className="border-b border-white/10 bg-black/25 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">Código</th>
            <th className="px-2 py-2 font-medium">Cód. pieza</th>
            <th className="px-2 py-2 font-medium">Medida</th>
            <th className="px-2 py-2 font-medium">Nombre</th>
            <th className="px-2 py-2 font-medium">Marca</th>
            <th className="px-2 py-2 font-medium">Procedencia</th>
            <th className="px-2 py-2 font-medium">Unidad</th>
            <th className="px-2 py-2 font-medium text-right">Cant.</th>
            <th className="px-2 py-2 font-medium text-right">Unit. Bs</th>
            <th className="px-2 py-2 font-medium text-right">Subtotal Bs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-300">
          {lineas.map((ln, i) => (
            <tr key={`${ln.ventaId}-${ln.productoId}-${i}`}>
              <td className="px-2 py-2 font-mono text-slate-200">{ln.codigo}</td>
              <td className="px-2 py-2 font-mono text-slate-400">{ln.codigoPieza}</td>
              <td className="px-2 py-2 text-slate-400">{ln.medida}</td>
              <td className="max-w-[200px] px-2 py-2 text-slate-200">{ln.nombre}</td>
              <td className="px-2 py-2 text-slate-400">{ln.marcaAuto ?? "—"}</td>
              <td className="px-2 py-2 text-slate-400">{ln.procedencia ?? "—"}</td>
              <td className="px-2 py-2 text-slate-400">{ln.unidad ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{ln.cantidad}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">{ln.precioUnitarioBs.toFixed(2)}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-100">
                {ln.totalLineaBs.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
