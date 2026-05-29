import { PanelSection } from "@/app/_components/panel-section";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import { listVentasPorSucursal, sumTotalesVentasPorSucursalEnRango } from "@/lib/data/ventas-vendedor";
import { formatIsoDateOnlyBo, formatoMostrarFechaHoraBo, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

function labelEstadoCobro(estado: string, tipoPago: string): string {
  if (estado === "pendiente") return "Pendiente en caja";
  if (tipoPago === "efectivo") return "Efectivo";
  if (tipoPago === "qr") return "QR";
  if (tipoPago === "tarjeta") return "Tarjeta";
  if (tipoPago === "credito") return "Crédito";
  return estado;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fecha: string }>;
}): Promise<Metadata> {
  const { fecha } = await params;
  const parsed = parseIsoDateOnly(fecha);
  const label = parsed ? formatIsoDateOnlyBo(parsed) : fecha;
  return { title: `Ventas del ${label}` };
}

export default async function VendedorVentasDiaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const ctx = await requireVendedorContext();
  const { fecha: fechaParam } = await params;
  const sp = await searchParams;

  const fecha = parseIsoDateOnly(fechaParam);
  if (!fecha) notFound();

  const desdeParsed = sp.desde?.trim() ? parseIsoDateOnly(sp.desde.trim()) : null;
  const hastaParsed = sp.hasta?.trim() ? parseIsoDateOnly(sp.hasta.trim()) : null;
  const volverHref =
    desdeParsed && hastaParsed
      ? `/vendedor/ventas?desde=${encodeURIComponent(desdeParsed)}&hasta=${encodeURIComponent(hastaParsed)}`
      : "/vendedor/ventas";

  const [rows, totales] = await Promise.all([
    listVentasPorSucursal(ctx.sucursalId, 5000, { fechaDesde: fecha, fechaHasta: fecha }),
    sumTotalesVentasPorSucursalEnRango(ctx.sucursalId, fecha, fecha),
  ]);

  const fechaLabel = formatIsoDateOnlyBo(fecha);

  return (
    <PanelSection
      variant="vendedor"
      title={`Ventas del ${fechaLabel}`}
      description={`Detalle de ventas confirmadas en ${ctx.sucursalNombre}.`}
    >
      <div className="mb-6">
        <Link
          href={volverHref}
          className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Volver al historial
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No hay ventas registradas en este día.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <p className="border-b border-white/10 bg-black/20 px-4 py-2 text-xs text-slate-500">
            {rows.length} venta{rows.length === 1 ? "" : "s"} el{" "}
            <span className="font-mono text-slate-300">{fecha}</span>
          </p>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-white/10 bg-black/25 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Pago</th>
                <th className="px-4 py-3 font-medium">Cobro</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium text-right">Total Bs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.id} className="text-slate-300">
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(r.fecha).toLocaleString("es-BO", formatoMostrarFechaHoraBo)}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {r.estado_cobro === "pendiente" ? "—" : r.tipo_pago}
                  </td>
                  <td className="px-4 py-3">{labelEstadoCobro(r.estado_cobro, r.tipo_pago)}</td>
                  <td className="px-4 py-3 text-slate-400">{r.cliente_nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {Number(r.total_bs).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Total del día
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-50">
              {totales.totalBs.toFixed(2)}{" "}
              <span className="text-base font-normal text-slate-400">Bs</span>
            </p>
            {totales.totalUsd > 0 ? (
              <p className="mt-1 font-mono text-sm text-slate-400">≈ {totales.totalUsd.toFixed(4)} USD</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              Suma de {totales.cantidad} venta{totales.cantidad === 1 ? "" : "s"}.
            </p>
          </div>
        </div>
      )}
    </PanelSection>
  );
}
