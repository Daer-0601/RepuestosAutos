import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { createTipoCambioAction } from "@/app/admin/tipo-cambio/actions";
import { listTipoCambio } from "@/lib/data/tipo-cambio";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tipo de cambio",
};

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

export default async function AdminTipoCambioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const rows = await listTipoCambio(80);

  return (
    <AdminPageShell
      backHref="/admin"
      backLabel="Inicio admin"
      title="Tipo de cambio"
      description="Cada registro guarda el valor vigente a partir de su fecha. Los documentos guardan snapshot propio."
      error={sp.error}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_1fr]">
        <form
          action={createTipoCambioAction}
          className="h-fit space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6"
        >
          <h2 className="text-sm font-semibold text-white">Nuevo valor</h2>
          <div>
            <label
              htmlFor="valor_bs_por_usd"
              className="text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              Bs por 1 USD *
            </label>
            <input
              id="valor_bs_por_usd"
              name="valor_bs_por_usd"
              type="text"
              inputMode="decimal"
              required
              className={field}
              placeholder="ej. 36.50"
            />
          </div>
          <div>
            <label htmlFor="nota" className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Nota (opcional)
            </label>
            <input id="nota" name="nota" className={field} placeholder="Motivo del ajuste" />
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Registrar
          </button>
        </form>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-black/20 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Bs / USD</th>
                <th className="px-4 py-3 font-medium">Usuario id</th>
                <th className="px-4 py-3 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                    Sin registros. Cargá el primer tipo de cambio.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(r.vigente_desde).toLocaleString("es-VE", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-white">{r.valor_bs_por_usd}</td>
                    <td className="px-4 py-3 text-slate-400">{r.usuario_id ?? "—"}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-400">{r.nota ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  );
}
