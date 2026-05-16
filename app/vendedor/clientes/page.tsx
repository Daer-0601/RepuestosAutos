import { PanelSection } from "@/app/_components/panel-section";
import { listClientes } from "@/lib/data/clientes";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function VendedorClientesPage() {
  const rows = await listClientes();

  return (
    <PanelSection
      variant="vendedor"
      wide
      title="Clientes"
      description="Directorio compartido con administración. Solo consulta; el alta de clientes la hacés desde «Nuevo cliente»."
    >
      <div className="space-y-4">
        <Link
          href="/vendedor/clientes/nueva"
          className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-900/20 transition hover:bg-amber-400"
        >
          Nuevo cliente
        </Link>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/40">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Carnet</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3 font-medium">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                    No hay clientes registrados todavía.
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{c.nombre}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{c.telefono ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">{c.carnet_identidad ?? "—"}</td>
                    <td className="max-w-[200px] px-4 py-3 text-slate-400">
                      <span className="line-clamp-2">{c.direccion?.trim() ? c.direccion.trim() : "—"}</span>
                    </td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PanelSection>
  );
}
