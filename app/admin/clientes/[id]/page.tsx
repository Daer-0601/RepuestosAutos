import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { updateClienteAction } from "@/app/admin/clientes/actions";
import { getCliente } from "@/lib/data/clientes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditarClientePage({ params, searchParams }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    notFound();
  }
  const c = await getCliente(id);
  if (!c) {
    notFound();
  }
  const sp = await searchParams;

  return (
    <AdminPageShell backHref="/admin/clientes" backLabel="Clientes" title={`Editar: ${c.nombre}`} error={sp.error}>
      <form
        action={updateClienteAction}
        className="max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
      >
        <input type="hidden" name="id" value={c.id} />
        <div>
          <label htmlFor="nombre" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Nombre *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={c.nombre}
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
            defaultValue={c.telefono ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="direccion" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Dirección
          </label>
          <textarea
            id="direccion"
            name="direccion"
            rows={3}
            defaultValue={c.direccion ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="activo" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Activo
          </label>
          <select id="activo" name="activo" className={field} defaultValue={c.activo ? "1" : "0"}>
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
