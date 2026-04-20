import { AdminPasswordField } from "@/app/admin/_components/admin-password-field";
import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { createUsuarioAction } from "@/app/admin/usuarios/actions";
import { etiquetaRolEspanol, listRoles } from "@/lib/data/roles";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nuevo usuario",
};

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

export default async function NuevoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const roles = await listRoles();
  const sucursales = await listSucursales();

  return (
    <AdminPageShell backHref="/admin/usuarios" backLabel="Usuarios" title="Nuevo usuario" error={sp.error}>
      <form
        action={createUsuarioAction}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      >
        <div>
          <label
            htmlFor="nombre_completo"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Nombre completo *
          </label>
          <input id="nombre_completo" name="nombre_completo" required className={field} />
        </div>
        <div>
          <label htmlFor="username" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Usuario *
          </label>
          <input id="username" name="username" required autoComplete="off" className={field} />
        </div>
        <AdminPasswordField
          id="password"
          name="password"
          label="Contraseña *"
          required
          autoComplete="new-password"
        />
        <div>
          <label htmlFor="rol_id" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Rol *
          </label>
          <select id="rol_id" name="rol_id" required className={field} defaultValue="2">
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
            Sucursal (obligatoria para Cajero/Vendedor)
          </label>
          <select id="sucursal_id" name="sucursal_id" className={field}>
            <option value="">— Ninguna (solo Admin) —</option>
            {sucursales
              .filter((s) => s.estado === "activo")
              .map((s) => (
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
          <select id="activo" name="activo" className={field} defaultValue="1">
            <option value="1">Sí</option>
            <option value="0">No</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
        >
          Crear usuario
        </button>
      </form>
    </AdminPageShell>
  );
}
