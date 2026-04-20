import { AdminPasswordField } from "@/app/admin/_components/admin-password-field";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { updateUsuarioAction } from "@/app/admin/usuarios/actions";
import { etiquetaRolEspanol, listRoles } from "@/lib/data/roles";
import { listSucursales } from "@/lib/data/sucursales";
import { getUsuario } from "@/lib/data/usuarios";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditarUsuarioPage({ params, searchParams }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    notFound();
  }
  const u = await getUsuario(id);
  if (!u) {
    notFound();
  }
  const sp = await searchParams;
  const roles = await listRoles();
  const sucursales = await listSucursales();

  return (
    <AdminPageShell backHref="/admin/usuarios" backLabel="Usuarios" title={`Editar: ${u.username}`} error={sp.error}>
      <form
        action={updateUsuarioAction}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      >
        <input type="hidden" name="id" value={u.id} />
        <div>
          <label
            htmlFor="nombre_completo"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Nombre completo *
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            required
            defaultValue={u.nombre_completo}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="username" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Usuario *
          </label>
          <input
            id="username"
            name="username"
            required
            defaultValue={u.username}
            className={field}
          />
        </div>
        <AdminPasswordField
          id="password"
          name="password"
          label="Nueva contraseña (opcional)"
          autoComplete="new-password"
          placeholder="Dejar vacío para no cambiar"
        />
        <div>
          <label htmlFor="rol_id" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Rol *
          </label>
          <select
            id="rol_id"
            name="rol_id"
            required
            className={field}
            defaultValue={u.rol_id}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {etiquetaRolEspanol(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="sucursal_id"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Sucursal
          </label>
          <select
            id="sucursal_id"
            name="sucursal_id"
            className={field}
            defaultValue={u.sucursal_id ?? ""}
          >
            <option value="">— Ninguna (Admin) —</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="activo" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Activo
          </label>
          <select id="activo" name="activo" className={field} defaultValue={u.activo ? "1" : "0"}>
            <option value="1">Sí</option>
            <option value="0">No</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
        >
          Guardar cambios
        </button>
      </form>
    </AdminPageShell>
  );
}
