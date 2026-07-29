import { VendedorProductosPanel } from "@/app/vendedor/productos/_components/vendedor-productos-panel";
import { requireVendedorContext } from "@/lib/auth/staff-panel-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
};

export default async function VendedorProductosPage() {
  const ctx = await requireVendedorContext();
  return (
    <VendedorProductosPanel miSucursalId={ctx.sucursalId} sucursalNombre={ctx.sucursalNombre} />
  );
}
