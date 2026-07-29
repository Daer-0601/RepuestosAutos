"use client";

import { VentaCatalogoBuscador } from "@/app/vendedor/_components/venta-catalogo-buscador";

export function VendedorProductosPanel({
  miSucursalId,
  sucursalNombre,
}: {
  miSucursalId: number;
  sucursalNombre: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[min(96rem,calc(100vw-1.25rem))]">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Productos</h1>
      <p className="mt-2 text-sm text-slate-400">
        Buscá repuestos con precio de lista en Bs y stock por sucursal ({sucursalNombre}). Solo consulta.
      </p>
      <div className="mt-8 rounded-2xl border border-amber-500/25 bg-slate-900/50 p-6 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.08)] sm:p-8">
        <VentaCatalogoBuscador
          miSucursalId={miSucursalId}
          descripcionStock="Stock por sucursal; tu depósito va resaltado."
        />
      </div>
    </div>
  );
}
