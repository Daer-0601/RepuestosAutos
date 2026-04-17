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
      backHref="/admin/productos"
      backLabel="Productos"
      title="Nuevo producto"
      description="Al guardar se asignan código y QR en secuencia (mismo valor). Podés adjuntar imágenes. Los precios de lista y utilidad se cargan después (p. ej. al ingresar compra)."
      error={sp.error}
    >
      <ProductoEditor mode="create" />
    </AdminPageShell>
  );
}
