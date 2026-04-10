import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { ProductoEditor } from "@/app/admin/productos/producto-editor";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditarProductoPage({ params, searchParams }: Props) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    notFound();
  }
  const sp = await searchParams;

  return (
    <AdminPageShell title="Editar producto" error={sp.error}>
      <ProductoEditor mode="edit" id={id} />
    </AdminPageShell>
  );
}
