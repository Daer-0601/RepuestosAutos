import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { ProductoEditor } from "@/app/admin/productos/producto-editor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nuevo producto",
};

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <AdminPageShell
      title="Nuevo producto"
      description="El QR en etiqueta puede codificar el mismo texto que el código impreso."
      error={sp.error}
    >
      <ProductoEditor mode="create" />
    </AdminPageShell>
  );
}
