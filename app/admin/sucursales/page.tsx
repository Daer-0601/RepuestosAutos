import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sucursales",
};

export default async function AdminSucursalesPage() {
  const rows = await listSucursales();

  return (
    <AdminPageShell
      title="Sucursales"
      description="Alta y edición de tiendas. El estado inactivo evita uso operativo sin borrar datos."
      actions={<AdminButtonLink href="/admin/sucursales/nueva">Nueva sucursal</AdminButtonLink>}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                  No hay sucursales. Creá la primera.
                </td>
              </tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{s.nombre}</td>
                  <td className="px-4 py-3 text-slate-400">{s.telefono ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.estado === "activo"
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                          : "rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400"
                      }
                    >
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/sucursales/${s.id}`}
                      className="text-rose-400 hover:text-rose-300 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminPageShell>
  );
}
