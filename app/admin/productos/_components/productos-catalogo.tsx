import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import { CatalogoSearchInput } from "@/app/admin/productos/_components/catalogo-search-input";
import { ProductosCatalogoTabla } from "@/app/admin/productos/_components/productos-catalogo-tabla";
import type { SucursalRow } from "@/lib/data/sucursales";
import {
  stringifyCatalogoFiltros,
  type CatalogoFiltrosInput,
  type ProductoCatalogoRowConStock,
} from "@/lib/data/productos-catalogo";
import Link from "next/link";

const inp =
  "w-full rounded border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-sky-500/40";

export function ProductosCatalogo({
  filtros,
  sucursales,
  total,
  rows,
}: {
  filtros: CatalogoFiltrosInput;
  sucursales: SucursalRow[];
  total: number;
  rows: ProductoCatalogoRowConStock[];
}) {
  return (
    <div className="space-y-4">
      <form method="get" className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Buscar (todo)</label>
            <CatalogoSearchInput
              name="q"
              defaultValue={filtros.q}
              placeholder="Palabras sueltas; basta con que una coincida…"
              className={`${inp} mt-1`}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Espacio, coma o guion. Sin mayúsculas. No busca el código interno del producto.
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código</label>
            <CatalogoSearchInput
              name="codigo"
              defaultValue={filtros.codigo}
              placeholder="Ej. 1000 o 001000 (exacto)"
              className={`${inp} mt-1`}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Solo el producto con ese código o QR; si es número, también coincide sin ceros a la izquierda.
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código pieza</label>
            <CatalogoSearchInput
              name="codigo_pieza"
              defaultValue={filtros.codigo_pieza}
              placeholder="Cualquier palabra alcanza"
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Especificación</label>
            <CatalogoSearchInput
              name="especificacion"
              defaultValue={filtros.especificacion}
              placeholder="Cualquier palabra alcanza"
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Medida</label>
            <CatalogoSearchInput
              name="medida"
              defaultValue={filtros.medida}
              placeholder="Cualquier palabra alcanza"
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
            <CatalogoSearchInput
              name="descripcion"
              defaultValue={filtros.descripcion}
              placeholder="Palabras sueltas; busca también en nombre y especificación"
              className={`${inp} mt-1`}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Separá con espacio, coma, punto, guion, barra, etc. Cualquier término alcanza en descripción, nombre o
              especificación.
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Repuesto </label>
            <CatalogoSearchInput
              name="repuesto"
              defaultValue={filtros.repuesto}
              placeholder="Cualquier palabra alcanza"
              className={`${inp} mt-1`}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stock total</label>
            <select name="stock" defaultValue={filtros.stock} className={`${inp} mt-1`}>
              <option value="">Cualquiera</option>
              <option value="positivo">Con stock</option>
              <option value="cero">Sin stock</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estado</label>
            <select
              name="estado"
              defaultValue={filtros.estado === "" ? "todos" : filtros.estado}
              className={`${inp} mt-1`}
            >
              <option value="activo">Solo activos</option>
              <option value="inactivo">Solo inactivos</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Con stock en:</span>
          {sucursales.map((s) => (
            <Link
              key={s.id}
              href={`/admin/productos${stringifyCatalogoFiltros(filtros, { sucursalStockId: s.id })}`}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                filtros.sucursalStockId === s.id
                  ? "border-sky-500/60 bg-sky-600/30 text-sky-100"
                  : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-sky-500/30"
              }`}
            >
              {s.nombre}
            </Link>
          ))}
          {filtros.sucursalStockId != null ? (
            <Link
              href={`/admin/productos${stringifyCatalogoFiltros(filtros, { sucursalStockId: null })}`}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:text-white"
            >
              Quitar filtro sucursal
            </Link>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Buscar
            </button>
            <Link
              href="/admin/productos"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              Limpiar
            </Link>
          </div>
          <AdminButtonLink href="/admin/productos/nueva">Nuevo producto</AdminButtonLink>
        </div>
      </form>

      <p className="text-xs text-slate-500">
        {total === 0
          ? "Sin resultados con estos filtros."
          : rows.length < total
            ? `Mostrando ${rows.length} de ${total} producto(s) (máx. ${filtros.pageSize} por carga; refiná filtros para ver el resto).`
            : `Mostrando ${rows.length} producto(s) · desplazá con la barra de la tabla.`}
      </p>

      <ProductosCatalogoTabla rows={rows} sucursales={sucursales} />
    </div>
  );
}
