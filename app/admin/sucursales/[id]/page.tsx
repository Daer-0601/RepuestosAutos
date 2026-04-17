import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { updateSucursalAction } from "@/app/admin/sucursales/actions";
import { getSucursal } from "@/lib/data/sucursales";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: `Sucursal ${id}` };
}

export default async function EditarSucursalPage({ params, searchParams }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    notFound();
  }
  const s = await getSucursal(id);
  if (!s) {
    notFound();
  }
  const sp = await searchParams;

  return (
    <AdminPageShell
      backHref="/admin/sucursales"
      backLabel="Sucursales"
      title={`Editar: ${s.nombre}`}
      description="Actualizá datos o desactivá la sucursal si ya no opera."
      error={sp.error}
    >
      <form
        action={updateSucursalAction}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      >
        <input type="hidden" name="id" value={s.id} />
        <div>
          <label htmlFor="nombre" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Nombre *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={s.nombre}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="direccion" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Dirección
          </label>
          <input
            id="direccion"
            name="direccion"
            defaultValue={s.direccion ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="telefono" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Teléfono
          </label>
          <input
            id="telefono"
            name="telefono"
            defaultValue={s.telefono ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="estado" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            className={field}
            defaultValue={s.estado}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Guardar cambios
          </button>
        </div>
      </form>
    </AdminPageShell>
  );
}
