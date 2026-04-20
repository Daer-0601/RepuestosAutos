import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { createClienteAction } from "@/app/admin/clientes/actions";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nuevo cliente",
};

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <AdminPageShell backHref="/admin/clientes" backLabel="Clientes" title="Nuevo cliente" error={sp.error}>
      <form
        action={createClienteAction}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      >
        <div>
          <label htmlFor="nombre" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Nombre *
          </label>
          <input id="nombre" name="nombre" required className={field} />
        </div>
        <div>
          <label htmlFor="telefono" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Teléfono
          </label>
          <input id="telefono" name="telefono" className={field} />
        </div>
        <div>
          <label
            htmlFor="carnet_identidad"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Carnet de identidad
          </label>
          <input
            id="carnet_identidad"
            name="carnet_identidad"
            className={field}
            placeholder="Ej. V-12345678"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="direccion" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Dirección
          </label>
          <textarea id="direccion" name="direccion" rows={3} className={field} />
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
          Guardar
        </button>
      </form>
    </AdminPageShell>
  );
}
