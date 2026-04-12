import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { etiquetaRolEspanol } from "@/lib/data/roles";
import { listUsuarios } from "@/lib/data/usuarios";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default async function AdminUsuariosPage() {
  const rows = await listUsuarios();

  return (
    <AdminPageShell
      title="Usuarios"
      description="Roles: Administrador (sin sucursal), Cajero y Vendedor con sucursal obligatoria."
      actions={<AdminButtonLink href="/admin/usuarios/nueva">Nuevo usuario</AdminButtonLink>}
    >
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Sucursal</th>
              <th className="px-4 py-3 font-medium">Activo</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                  No hay usuarios.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white">{u.nombre_completo}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">{u.username}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {etiquetaRolEspanol({ id: u.rol_id, nombre: u.rol_nombre })}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.sucursal_nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.activo
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                          : "rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400"
                      }
                    >
                      {u.activo ? "sí" : "no"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/usuarios/${u.id}`}
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
