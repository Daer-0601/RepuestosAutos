import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { createSucursalAction } from "@/app/admin/sucursales/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nueva sucursal",
};

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500/40";

export default async function NuevaSucursalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <AdminPageShell
      title="Nueva sucursal"
      description="Datos de contacto y estado operativo."
      error={sp.error}
    >
      <form
        action={createSucursalAction}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      >
        <div>
          <label htmlFor="nombre" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Nombre *
          </label>
          <input id="nombre" name="nombre" required className={field} placeholder="Sucursal Centro" />
        </div>
        <div>
          <label htmlFor="direccion" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Dirección
          </label>
          <input id="direccion" name="direccion" className={field} />
        </div>
        <div>
          <label htmlFor="telefono" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Teléfono
          </label>
          <input id="telefono" name="telefono" className={field} />
        </div>
        <div>
          <label htmlFor="estado" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Estado
          </label>
          <select id="estado" name="estado" className={field} defaultValue="activo">
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Guardar
          </button>
        </div>
      </form>
    </AdminPageShell>
  );
}
