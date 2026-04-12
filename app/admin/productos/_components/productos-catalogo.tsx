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
  const desde = total === 0 ? 0 : (filtros.page - 1) * filtros.pageSize + 1;
  const hasta = Math.min(filtros.page * filtros.pageSize, total);
  const totalPaginas = Math.max(1, Math.ceil(total / filtros.pageSize));

  return (
    <div className="space-y-4">
      <form method="get" className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
        <input type="hidden" name="page" value="1" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Buscar (todo)</label>
            <input
              name="q"
              defaultValue={filtros.q}
              placeholder="Varias palabras o fragmentos; orden libre…"
              className={`${inp} mt-1`}
            />
            <p className="mt-1 text-[10px] text-slate-500">
              Separa con espacio o coma. No hace falta el texto exacto ni las mayúsculas.
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código</label>
            <input name="codigo" defaultValue={filtros.codigo} placeholder="Buscar por código" className={`${inp} mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código pieza</label>
            <input name="codigo_pieza" defaultValue={filtros.codigo_pieza} className={`${inp} mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Especificación</label>
            <input name="especificacion" defaultValue={filtros.especificacion} className={`${inp} mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
            <input name="descripcion" defaultValue={filtros.descripcion} className={`${inp} mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Procedencia</label>
            <input name="procedencia" defaultValue={filtros.procedencia} className={`${inp} mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Repuesto / tipo</label>
            <input name="repuesto" defaultValue={filtros.repuesto} className={`${inp} mt-1`} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Marca auto</label>
            <input name="marca" defaultValue={filtros.marca} className={`${inp} mt-1`} />
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
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Mostrar</label>
            <select name="perPage" defaultValue={String(filtros.pageSize)} className={`${inp} mt-1`}>
              {[10, 25, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n} registros
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Con stock en:</span>
          {sucursales.map((s) => (
            <Link
              key={s.id}
              href={`/admin/productos${stringifyCatalogoFiltros(filtros, { sucursalStockId: s.id, page: 1 })}`}
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
              href={`/admin/productos${stringifyCatalogoFiltros(filtros, { sucursalStockId: null, page: 1 })}`}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:text-white"
            >
              Quitar filtro sucursal
            </Link>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <p>
          {desde === 0 ? "Sin resultados" : `${desde}–${hasta} de ${total} registros`}
          {totalPaginas > 1 ? ` · página ${filtros.page} de ${totalPaginas}` : null}
        </p>
        <div className="flex flex-wrap gap-1">
          {filtros.page > 1 ? (
            <Link
              href={`/admin/productos${stringifyCatalogoFiltros(filtros, { page: filtros.page - 1 })}`}
              className="rounded border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/5"
            >
              Anterior
            </Link>
          ) : null}
          {filtros.page < totalPaginas ? (
            <Link
              href={`/admin/productos${stringifyCatalogoFiltros(filtros, { page: filtros.page + 1 })}`}
              className="rounded border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/5"
            >
              Siguiente
            </Link>
          ) : null}
        </div>
      </div>

      <ProductosCatalogoTabla rows={rows} sucursales={sucursales} />
    </div>
  );
}
