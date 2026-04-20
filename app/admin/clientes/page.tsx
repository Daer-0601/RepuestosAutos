import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { listClientes } from "@/lib/data/clientes";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function AdminClientesPage() {
  const rows = await listClientes();

  return (
    <AdminPageShell
      title="Clientes"
      description="Directorio para ventas y créditos."
      actions={<AdminButtonLink href="/admin/clientes/nueva">Nuevo cliente</AdminButtonLink>}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Carnet</th>
              <th className="px-4 py-3 font-medium">Activo</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                  No hay clientes registrados.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-400">{c.telefono ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{c.carnet_identidad ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        c.activo
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                          : "rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400"
                      }
                    >
                      {c.activo ? "sí" : "no"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/clientes/${c.id}`}
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
