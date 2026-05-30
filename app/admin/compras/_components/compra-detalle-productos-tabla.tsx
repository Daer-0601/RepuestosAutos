import type { CompraDetalleLineaRow } from "@/lib/data/compras-listado";

export function CompraDetalleProductosTabla({ lineas }: { lineas: CompraDetalleLineaRow[] }) {
  if (lineas.length === 0) {
    return <p className="text-xs text-slate-500">Sin productos en esta compra.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[960px] text-left text-xs">
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
            <th className="px-2 py-2 font-medium text-right">Flete Bs</th>
            <th className="px-2 py-2 font-medium text-right">Total Bs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-slate-300">
          {lineas.map((ln) => (
            <tr key={ln.id}>
              <td className="px-2 py-2 font-mono text-slate-200">{ln.codigo}</td>
              <td className="px-2 py-2 font-mono text-slate-400">{ln.codigoPieza}</td>
              <td className="px-2 py-2 text-slate-400">{ln.medida}</td>
              <td className="max-w-[200px] px-2 py-2 text-slate-200">{ln.nombre}</td>
              <td className="px-2 py-2 text-slate-400">{ln.marcaAuto ?? "—"}</td>
              <td className="px-2 py-2 text-slate-400">{ln.procedencia ?? "—"}</td>
              <td className="px-2 py-2 text-slate-400">{ln.unidad ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{ln.cantidad}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">{ln.precioCompraUnitBs.toFixed(2)}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums text-slate-400">
                {ln.montoFleteBs.toFixed(2)}
              </td>
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
