import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { listProductos } from "@/lib/data/productos";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Productos",
};

export default async function AdminProductosPage() {
  const rows = await listProductos(400);

  return (
    <AdminPageShell
      title="Productos"
      description="Código único, payload QR (suele igualar al código), precios de lista y fotos por URL."
      actions={<AdminButtonLink href="/admin/productos/nueva">Nuevo producto</AdminButtonLink>}
    >
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Marca</th>
              <th className="px-4 py-3 font-medium">Lista Bs</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  No hay productos. Importá CSV o creá uno manualmente.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-slate-200">{p.codigo}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 font-medium text-white">
                    {p.nombre}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{p.marca_auto ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-300">{p.precio_venta_lista_bs ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.estado === "activo"
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                          : "rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400"
                      }
                    >
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/productos/${p.id}`}
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
