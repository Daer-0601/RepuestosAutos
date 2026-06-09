import { ProductosCatalogo } from "@/app/admin/productos/_components/productos-catalogo";
import { PanelSection } from "@/app/_components/panel-section";
import { requireCajeroContext } from "@/lib/auth/staff-panel-context";
import {
  countProductosCatalogo,
  listInventarioPorProductoIds,
  listProductosCatalogo,
  mergeStocksEnFilas,
  parseCatalogoFiltros,
  stripPrecioCompraCatalogoRows,
} from "@/lib/data/productos-catalogo";
import { listSucursales } from "@/lib/data/sucursales";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Productos",
};

export default async function CajeroProductosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCajeroContext();
  const sp = await searchParams;
  const filtros = parseCatalogoFiltros(sp);
  const sucursalesRaw = await listSucursales();
  const sucursales = sucursalesRaw.filter((s) => s.estado === "activo").sort((a, b) => a.id - b.id);

  const [total, rows] = await Promise.all([
    countProductosCatalogo(filtros),
    listProductosCatalogo(filtros),
  ]);
  const inv = await listInventarioPorProductoIds(rows.map((r) => r.id));
  const rowsConStock = stripPrecioCompraCatalogoRows(mergeStocksEnFilas(rows, inv));

  return (
    <PanelSection
      variant="cajero"
      wide
      title="Productos"
      description="Consulta del catálogo con precios de venta y stock. Solo lectura; el precio de compra no se muestra."
    >
      <ProductosCatalogo
        variant="cajero"
        filtros={filtros}
        sucursales={sucursales}
        total={total}
        rows={rowsConStock}
      />
    </PanelSection>
  );
}
