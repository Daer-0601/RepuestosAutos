import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { IngresoCompraForm } from "@/app/admin/importacion/ingreso-compra-form";
import { listProveedoresActivos } from "@/lib/data/proveedores";
import { listSucursales } from "@/lib/data/sucursales";
import { getUltimoTipoCambio } from "@/lib/data/tipo-cambio";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ingreso de compra",
};

export default async function AdminImportacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  const [sucursalesRaw, proveedores, tc] = await Promise.all([
    listSucursales(),
    listProveedoresActivos(),
    getUltimoTipoCambio(),
  ]);

  const sucursales = sucursalesRaw
    .filter((s) => s.estado === "activo")
    .map((s) => ({ id: s.id, nombre: s.nombre }));

  const proveedoresOpts = proveedores.map((p) => ({ id: p.id, nombre: p.nombre }));

  return (
    <AdminPageShell
      title="Ingreso a tienda (compra)"
      description="Registrá compra a proveedor: tipo de pago, flete (% o monto) y destino de stock por sucursal. Cada ítem es un producto del catálogo (buscá y seleccioná). Si no existe, usá «Nuevo producto». Al confirmar se crean compra confirmada, detalle, lotes, movimientos de inventario y se actualiza el catálogo (precios, QR, medida, descripción, imágenes opcionales)."
      error={sp.error}
    >
      <IngresoCompraForm
        sucursales={sucursales}
        proveedoresIniciales={proveedoresOpts}
        tipoCambio={tc}
      />
    </AdminPageShell>
  );
}
