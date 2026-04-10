import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import {
  listStockBajo,
  resumenComprasUltimosDias,
  resumenVentasUltimosDias,
  ventasPorSucursalUltimosDias,
} from "@/lib/data/reportes-admin";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reportes",
};

const dias = 30;

export default async function AdminReportesPage() {
  const ventas = await resumenVentasUltimosDias(dias);
  const compras = await resumenComprasUltimosDias(dias);
  const porSucursal = await ventasPorSucursalUltimosDias(dias);
  const stockBajo = await listStockBajo(5, 40);

  return (
    <AdminPageShell
      title="Reportes"
      description={`Resúmenes globales últimos ${dias} días (ventas y compras confirmadas). Stock bajo: unidades ≤ 5.`}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Ventas</p>
          <p className="mt-2 text-2xl font-semibold text-white">{ventas.cantidad}</p>
          <p className="mt-1 text-sm text-slate-400">
            Total Bs: <span className="font-mono text-slate-200">{ventas.total_bs}</span>
          </p>
          <p className="text-sm text-slate-400">
            Total USD: <span className="font-mono text-slate-200">{ventas.total_usd}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Compras</p>
          <p className="mt-2 text-2xl font-semibold text-white">{compras.cantidad}</p>
          <p className="mt-1 text-sm text-slate-400">
            Total Bs: <span className="font-mono text-slate-200">{compras.total_bs}</span>
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-white">Ventas por sucursal</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Ventas</th>
              <th className="px-4 py-3">Total Bs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {porSucursal.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={3}>
                  Sin ventas en el período.
                </td>
              </tr>
            ) : (
              porSucursal.map((r) => (
                <tr key={r.sucursal} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{r.sucursal}</td>
                  <td className="px-4 py-3 text-slate-300">{r.ventas}</td>
                  <td className="px-4 py-3 font-mono text-slate-200">{r.total_bs}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-white">Stock bajo (≤ 5)</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sucursal</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {stockBajo.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={4}>
                  No hay ítems con stock ≤ 5 en sucursales activas.
                </td>
              </tr>
            ) : (
              stockBajo.map((r, i) => (
                <tr key={`${r.codigo}-${r.sucursal}-${i}`} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-300">{r.sucursal}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-white">{r.producto}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{r.codigo}</td>
                  <td className="px-4 py-3 text-amber-300">{r.stock}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
