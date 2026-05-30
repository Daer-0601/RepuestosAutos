import { PanelSection } from "@/app/_components/panel-section";
import { VentaDetalleProductosTabla } from "@/app/vendedor/_components/venta-detalle-productos-tabla";
import { VentasHistorialActualizarButton } from "@/app/vendedor/ventas/_components/ventas-historial-actualizar-button";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import {
  listVentasDetalleProductosPorIds,
  listVentasPorSucursal,
  sumTotalesVentasPorSucursalEnRango,
  type VentaDetalleProductoRow,
} from "@/lib/data/ventas-vendedor";
import { formatIsoDateOnlyBo, formatoMostrarFechaHoraBo, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

function labelTipoPago(estadoCobro: string, tipoPago: string): string {
  if (estadoCobro === "pendiente") return "Pendiente en caja";
  if (tipoPago === "efectivo") return "Efectivo";
  if (tipoPago === "qr") return "QR";
  if (tipoPago === "tarjeta") return "Tarjeta";
  if (tipoPago === "credito") return "Crédito";
  return tipoPago;
}

function badgeTipoPago(estadoCobro: string, tipoPago: string): string {
  if (estadoCobro === "pendiente") return "bg-slate-500/20 text-slate-300";
  if (tipoPago === "efectivo") return "bg-emerald-500/20 text-emerald-200";
  if (tipoPago === "qr") return "bg-sky-500/20 text-sky-200";
  if (tipoPago === "tarjeta") return "bg-indigo-500/20 text-indigo-200";
  return "bg-amber-500/20 text-amber-200";
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

  const lineas = await listVentasDetalleProductosPorIds(rows.map((r) => r.id));
  const lineasPorVenta = agruparLineasPorVenta(lineas);

  const fechaLabel = formatIsoDateOnlyBo(fecha);

  return (
    <PanelSection
      variant="vendedor"
      title={`Ventas del ${fechaLabel}`}
      description={`Ventas al contado confirmadas en ${ctx.sucursalNombre} (sin créditos).`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link
          href={volverHref}
          className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Volver al historial de ventas
        </Link>
        <VentasHistorialActualizarButton />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No hay ventas registradas en este día.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            {rows.length} venta{rows.length === 1 ? "" : "s"} el{" "}
            <span className="font-mono text-slate-300">{fecha}</span>
          </p>

          {rows.map((r) => (
            <article key={r.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-sm text-amber-200">Venta #{r.id}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.fecha).toLocaleString("es-BO", formatoMostrarFechaHoraBo)}
                  </p>
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-500">Cliente:</span> {r.cliente_nombre ?? "—"}
                  </p>
                  <p className="text-sm text-slate-400">
                    <span className="text-slate-500">Vendedor:</span> {String(r.vendedor_nombre ?? "—")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeTipoPago(r.estado_cobro, r.tipo_pago)}`}
                  >
                    {labelTipoPago(r.estado_cobro, r.tipo_pago)}
                  </span>
                  <p className="font-mono text-lg font-semibold tabular-nums text-amber-100">
                    {Number(r.total_bs).toFixed(2)}{" "}
                    <span className="text-sm font-normal text-slate-400">Bs</span>
                  </p>
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Productos ({lineasPorVenta.get(r.id)?.length ?? 0})
                </p>
                <VentaDetalleProductosTabla lineas={lineasPorVenta.get(r.id) ?? []} />
              </div>
            </article>
          ))}

          <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 to-slate-950/40 px-4 py-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total del día</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-50">
              {totales.totalBs.toFixed(2)}{" "}
              <span className="text-base font-normal text-slate-400">Bs</span>
            </p>
            {totales.totalUsd > 0 ? (
              <p className="mt-1 font-mono text-sm text-slate-400">≈ {totales.totalUsd.toFixed(4)} USD</p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              Suma de {totales.cantidad} venta{totales.cantidad === 1 ? "" : "s"} al contado.
            </p>
          </div>
        </div>
      )}
    </PanelSection>
  );
}
