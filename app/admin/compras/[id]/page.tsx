import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { CompraDetalleProductosTabla } from "@/app/admin/compras/_components/compra-detalle-productos-tabla";
import { ComprasNavTabs } from "@/app/admin/importacion/_components/compras-nav-tabs";
import { getCompraDetalleAdmin } from "@/lib/data/compras-listado";
import { formatoMostrarFechaHoraBo } from "@/lib/fecha-bolivia";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Compra #${id}` };
}

function labelTipoPago(tipo: string): string {
  if (tipo === "efectivo") return "Efectivo";
  if (tipo === "qr") return "QR";
  if (tipo === "tarjeta") return "Tarjeta";
  if (tipo === "credito") return "Crédito";
  return tipo || "—";
}

function labelEstado(estado: string): string {
  if (estado === "confirmada") return "Confirmada";
  return estado || "—";
}

export default async function AdminCompraDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string; hasta?: string; sucursal?: string }>;
}) {
  const { id: idParam } = await params;
  const sp = await searchParams;
  const compraId = Number(idParam);
  if (!Number.isFinite(compraId) || compraId < 1) notFound();

  const detalle = await getCompraDetalleAdmin(compraId);
  if (!detalle) notFound();

  const { header, lineas } = detalle;
  const queryExtra = new URLSearchParams();
  if (sp.desde?.trim()) queryExtra.set("desde", sp.desde.trim());
  if (sp.hasta?.trim()) queryExtra.set("hasta", sp.hasta.trim());
  if (sp.sucursal?.trim()) queryExtra.set("sucursal", sp.sucursal.trim());
  const volverHref = queryExtra.toString() ? `/admin/compras?${queryExtra.toString()}` : "/admin/compras";

  const fleteUsd =
    header.tipoCambioSnapshot > 0
      ? header.precioFleteTotalBs / header.tipoCambioSnapshot
      : 0;

  return (
    <AdminPageShell
      backHref={volverHref}
      backLabel="Volver al listado"
      title={`Compra #${header.id}`}
      description={`Importación en ${header.sucursalNombre} · ${header.proveedorNombre}`}
    >
      <ComprasNavTabs />

      <article className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-4 sm:px-5">
          <div className="min-w-0 space-y-1.5 text-sm">
            <p className="text-xs text-slate-500">
              {header.fecha.toLocaleString("es-BO", formatoMostrarFechaHoraBo)}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-500">Proveedor:</span> {header.proveedorNombre}
            </p>
            <p className="text-slate-400">
              <span className="text-slate-500">Registró:</span> {header.usuarioNombre}
            </p>
            <p className="text-slate-400">
              <span className="text-slate-500">Boleta / doc.:</span>{" "}
              <span className="font-mono">{header.numeroDocumento ?? "—"}</span>
            </p>
            <p className="text-slate-400">
              <span className="text-slate-500">Pago:</span> {labelTipoPago(header.tipoPago)}
            </p>
            {header.observaciones ? (
              <p className="text-slate-400">
                <span className="text-slate-500">Observación:</span> {header.observaciones}
              </p>
            ) : null}
            <p className="text-xs text-slate-500">
              T/C snapshot: <span className="font-mono text-slate-400">{header.tipoCambioSnapshot.toFixed(4)}</span>
              {" · "}
              Flete total: <span className="font-mono text-slate-400">{header.precioFleteTotalBs.toFixed(2)} Bs</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200">
              {labelEstado(header.estado)}
            </span>
            <p className="font-mono text-2xl font-semibold tabular-nums text-rose-100">
              {header.totalBs.toFixed(2)} <span className="text-sm font-normal text-slate-400">Bs</span>
            </p>
            <p className="font-mono text-lg font-semibold tabular-nums text-sky-200/90">
              {header.totalUsd.toFixed(4)} <span className="text-sm font-normal text-slate-400">USD</span>
            </p>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Productos importados ({lineas.length})
          </p>
          <CompraDetalleProductosTabla lineas={lineas} />
        </div>

        <div className="border-t border-white/10 bg-black/15 px-4 py-3 text-xs text-slate-500 sm:px-5">
          Subtotal:{" "}
          <span className="font-mono text-slate-300">{header.subtotalBs.toFixed(2)} Bs</span>
          {" · "}
          <span className="font-mono text-sky-200/80">{header.subtotalUsd.toFixed(4)} USD</span>
          {" · "}
          Flete: <span className="font-mono text-slate-300">{header.precioFleteTotalBs.toFixed(2)} Bs</span>
          {fleteUsd > 0 ? (
            <>
              {" · "}
              <span className="font-mono text-sky-200/80">{fleteUsd.toFixed(4)} USD</span>
            </>
          ) : null}
          {" · "}
          Total: <span className="font-mono text-slate-200">{header.totalBs.toFixed(2)} Bs</span>
          {" · "}
          <span className="font-mono text-sky-100">{header.totalUsd.toFixed(4)} USD</span>
        </div>
      </article>

      <div className="mt-4">
        <Link
          href={volverHref}
          className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-300 hover:bg-white/5"
        >
          ← Volver al listado de compras
        </Link>
      </div>
    </AdminPageShell>
  );
}
