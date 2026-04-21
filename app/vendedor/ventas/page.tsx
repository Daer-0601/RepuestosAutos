import { PanelSection } from "@/app/_components/panel-section";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import { listVentasPorSucursal } from "@/lib/data/ventas-vendedor";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Historial de ventas",
};

export default async function VendedorVentasHistorialPage() {
  const ctx = await requireVendedorContext();
  const rows = await listVentasPorSucursal(ctx.sucursalId, 100);

  return (
    <PanelSection
      variant="vendedor"
      title="Historial de ventas"
      description={`Ventas confirmadas en ${ctx.sucursalNombre}.`}
    >
      <div className="mb-6">
        <Link
          href="/vendedor/ventas/nueva"
          className="inline-flex rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100 ring-1 ring-amber-500/35 hover:bg-amber-500/30"
        >
          + Nueva venta
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay ventas registradas en esta sucursal.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Cobro</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium text-right">Total Bs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="px-4 py-3 font-mono text-xs text-amber-200/80">{r.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.fecha).toLocaleString("es-VE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 capitalize">{r.tipo_pago}</td>
                  <td className="px-4 py-3">{r.estado_cobro}</td>
                  <td className="px-4 py-3 text-slate-400">{r.cliente_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">{Number(r.total_bs).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelSection>
  );
}
