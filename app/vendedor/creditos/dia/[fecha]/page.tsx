import { PanelSection } from "@/app/_components/panel-section";
import { VentaDetalleProductosTabla } from "@/app/vendedor/_components/venta-detalle-productos-tabla";
import { VentasHistorialActualizarButton } from "@/app/vendedor/ventas/_components/ventas-historial-actualizar-button";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import {
  listCreditosHistorialPorSucursal,
  sumTotalesCreditosPorSucursalEnRango,
  type CreditoHistorialEstado,
} from "@/lib/data/creditos";
import { listVentasDetalleProductosPorIds, type VentaDetalleProductoRow } from "@/lib/data/ventas-vendedor";
import { formatIsoDateOnlyBo, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

function labelEstadoCredito(estado: CreditoHistorialEstado): string {
  if (estado === "pendiente_caja") return "En caja (sin entregar)";
  if (estado === "pendiente") return "Pendiente de pago";
  if (estado === "vencido") return "Vencido";
  if (estado === "pagado") return "Pagado";
  return estado;
}

function badgeEstadoCredito(estado: CreditoHistorialEstado): string {
  if (estado === "pendiente_caja") return "bg-slate-500/20 text-slate-300";
  if (estado === "pendiente") return "bg-amber-500/20 text-amber-200";
  if (estado === "vencido") return "bg-rose-500/20 text-rose-200";
  if (estado === "pagado") return "bg-emerald-500/20 text-emerald-200";
  return "bg-slate-500/20 text-slate-300";
}

function agruparLineasPorVenta(lineas: VentaDetalleProductoRow[]): Map<number, VentaDetalleProductoRow[]> {
  const map = new Map<number, VentaDetalleProductoRow[]>();
  for (const ln of lineas) {
    const prev = map.get(ln.ventaId) ?? [];
    prev.push(ln);
    map.set(ln.ventaId, prev);
  }
  return map;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ fecha: string }>;
}): Promise<Metadata> {
  const { fecha } = await params;
  const parsed = parseIsoDateOnly(fecha);
  const label = parsed ? formatIsoDateOnlyBo(parsed) : fecha;
  return { title: `Créditos del ${label}` };
}

export default async function VendedorCreditosDiaDetallePage({
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
      ? `/vendedor/creditos?desde=${encodeURIComponent(desdeParsed)}&hasta=${encodeURIComponent(hastaParsed)}`
      : "/vendedor/creditos";

  const [rows, totales] = await Promise.all([
    listCreditosHistorialPorSucursal(ctx.sucursalId, 5000, { fechaDesde: fecha, fechaHasta: fecha }),
    sumTotalesCreditosPorSucursalEnRango(ctx.sucursalId, fecha, fecha),
  ]);

  const lineas = await listVentasDetalleProductosPorIds(rows.map((r) => r.ventaId));
  const lineasPorVenta = agruparLineasPorVenta(lineas);

  const fechaLabel = formatIsoDateOnlyBo(fecha);

  return (
    <PanelSection
      variant="vendedor"
      title={`Créditos del ${fechaLabel}`}
      description={`Detalle de ventas a crédito en ${ctx.sucursalNombre}.`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          href={volverHref}
          className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Volver al historial de créditos
        </Link>
        <VentasHistorialActualizarButton />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No hay ventas a crédito en este día.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            {rows.length} crédito{rows.length === 1 ? "" : "s"} el{" "}
            <span className="font-mono text-slate-300">{fecha}</span>
          </p>

          {rows.map((r) => (
            <article
              key={r.ventaId}
              className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm text-violet-200">Crédito #{r.ventaId}</p>
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-500">Cliente:</span> {r.clienteNombre}
                  </p>
                  <p className="text-sm text-slate-400">
                    <span className="text-slate-500">Vendedor:</span> {r.vendedorNombre}
                  </p>
                  {r.fechaLimite ? (
                    <p className="text-xs text-slate-500">
                      Vence: <span className="font-mono text-slate-400">{r.fechaLimite}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeEstadoCredito(r.estado)}`}>
                    {labelEstadoCredito(r.estado)}
                  </span>
                  <p className="font-mono text-lg font-semibold tabular-nums text-violet-100">
                    {r.montoTotalBs.toFixed(2)} <span className="text-sm font-normal text-slate-400">Bs</span>
                  </p>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Productos ({lineasPorVenta.get(r.ventaId)?.length ?? 0})
                </p>
                <VentaDetalleProductosTabla lineas={lineasPorVenta.get(r.ventaId) ?? []} />
              </div>
            </article>
          ))}

          <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Total del día (crédito)
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-violet-50">
              {totales.totalBs.toFixed(2)}{" "}
              <span className="text-base font-normal text-slate-400">Bs</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {totales.cantidad} venta{totales.cantidad === 1 ? "" : "s"} a crédito. El ingreso en caja se registra al
              cobrar.
            </p>
          </div>
        </div>
      )}
    </PanelSection>
  );
}
