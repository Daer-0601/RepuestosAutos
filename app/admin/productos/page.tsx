import { AdminPageShell } from "@/app/admin/_components/admin-page-shell";
import { ProductosCatalogo } from "@/app/admin/productos/_components/productos-catalogo";
import {
  countProductosCatalogo,
  listInventarioPorProductoIds,
  listProductosCatalogo,
  mergeStocksEnFilas,
  parseCatalogoFiltros,
} from "@/lib/data/productos-catalogo";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
};

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filtros = parseCatalogoFiltros(sp);
  const sucursalesRaw = await listSucursales();
  const sucursales = sucursalesRaw.filter((s) => s.estado === "activo").sort((a, b) => a.id - b.id);

  const [total, rows] = await Promise.all([
    countProductosCatalogo(filtros),
    listProductosCatalogo(filtros),
  ]);
  const inv = await listInventarioPorProductoIds(rows.map((r) => r.id));
  const rowsConStock = mergeStocksEnFilas(rows, inv);

  return (
    <AdminPageShell>
      <ProductosCatalogo filtros={filtros} sucursales={sucursales} total={total} rows={rowsConStock} />
    </AdminPageShell>
  );
}
