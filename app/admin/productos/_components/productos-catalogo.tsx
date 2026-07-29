import { AdminButtonLink } from "@/app/admin/_components/admin-button-link";
import {
  CatalogoSearchInput,
  CatalogoSearchProvider,
} from "@/app/admin/productos/_components/catalogo-search-input";
import { ProductosExportOskCsvButton } from "@/app/admin/productos/_components/productos-export-osk-csv-button";
import { ProductosCatalogoTabla } from "@/app/admin/productos/_components/productos-catalogo-tabla";
import type { SucursalRow } from "@/lib/data/sucursales";
import {
  stringifyCatalogoFiltros,
  type CatalogoFiltrosInput,
  type ProductoCatalogoRowConStock,
} from "@/lib/data/productos-catalogo";
import Link from "next/link";

const inpBase =
  "w-full rounded border border-white/10 bg-slate-950/80 text-xs text-white placeholder:text-slate-600 outline-none";

/** Campo «Buscar (todo)»: un poco más compacto que el resto. */
const inpBuscarTodoBase =
  "w-full rounded border border-white/10 bg-slate-950/80 px-1.5 py-1 text-[11px] leading-snug text-white placeholder:text-slate-600 outline-none placeholder:text-[10px]";

function catalogoFormHydrationKey(f: CatalogoFiltrosInput): string {
  return [
    f.q,
    f.codigo,
    f.codigo_pieza,
    f.especificacion,
    f.medida,
    f.descripcion,
    f.repuesto,
    f.stock,
    f.sucursalStockId ?? "",
    f.estado,
    String(f.pageSize),
    String(f.pageOffset),
  ].join("\u241e");
}

export function ProductosCatalogo({
  filtros,
  sucursales,
  total,
  rows,
  variant = "admin",
}: {
  filtros: CatalogoFiltrosInput;
  sucursales: SucursalRow[];
  total: number;
  rows: ProductoCatalogoRowConStock[];
  variant?: "admin" | "vendedor";
}) {
  const basePath = variant === "vendedor" ? "/vendedor/productos" : "/admin/productos";
  const accentBtn =
    variant === "vendedor"
      ? "rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
      : "rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500";
  const accentChipActive =
    variant === "vendedor"
      ? "border-amber-500/60 bg-amber-600/30 text-amber-100"
      : "border-sky-500/60 bg-sky-600/30 text-sky-100";
  const accentChipIdle =
    variant === "vendedor"
      ? "border-white/10 bg-slate-950/60 text-slate-300 hover:border-amber-500/30"
      : "border-white/10 bg-slate-950/60 text-slate-300 hover:border-sky-500/30";
  const focusInput =
    variant === "vendedor" ? "focus:border-amber-500/40" : "focus:border-sky-500/40";

  return (
    <div className="space-y-4">
      <form
        key={catalogoFormHydrationKey(filtros)}
        method="get"
        action={basePath}
        className="rounded-2xl border border-white/10 bg-slate-900/50 p-4"
      >
        <CatalogoSearchProvider
          initial={{
            q: filtros.q,
            codigo: filtros.codigo,
            codigo_pieza: filtros.codigo_pieza,
            especificacion: filtros.especificacion,
            medida: filtros.medida,
            descripcion: filtros.descripcion,
            repuesto: filtros.repuesto,
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <div className="max-w-full sm:max-w-md">
              <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Buscar (todo)</label>
              <CatalogoSearchInput
                name="q"
                placeholder="QR, código pieza, espec., medida, nombre, repuesto, descripción, código (una palabra flexible; dos+ repartidas en esos campos)"
                className={`${inpBuscarTodoBase} ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código</label>
              <CatalogoSearchInput
                name="codigo"
                placeholder="Solo código interno o texto del QR (exacto)"
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código pieza</label>
              <CatalogoSearchInput
                name="codigo_pieza"
                placeholder="Varias palabras: todas en código pieza"
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Especificación</label>
              <CatalogoSearchInput
                name="especificacion"
                placeholder="Varias palabras: todas en especificación"
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Medida</label>
              <CatalogoSearchInput
                name="medida"
                placeholder="Varias palabras: todas en medida"
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Descripción</label>
              <CatalogoSearchInput
                name="descripcion"
                placeholder="Busca en descripción, nombre y especificación"
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Repuesto </label>
              <CatalogoSearchInput
                name="repuesto"
                placeholder="Varias palabras: todas en repuesto"
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stock total</label>
              <select name="stock" defaultValue={filtros.stock} className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}>
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
                className={`${inpBase} px-2 py-1.5 ${focusInput} mt-1`}
              >
                <option value="activo">Solo activos</option>
                <option value="inactivo">Solo inactivos</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </div>
        </CatalogoSearchProvider>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Con stock en:</span>
          {sucursales.map((s) => (
            <Link
              key={s.id}
              href={`${basePath}${stringifyCatalogoFiltros(filtros, { sucursalStockId: s.id })}`}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                filtros.sucursalStockId === s.id ? accentChipActive : accentChipIdle
              }`}
            >
              {s.nombre}
            </Link>
          ))}
          {filtros.sucursalStockId != null ? (
            <Link
              href={`${basePath}${stringifyCatalogoFiltros(filtros, { sucursalStockId: null })}`}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 hover:text-white"
            >
              Quitar filtro sucursal
            </Link>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={accentBtn}>
              Buscar
            </button>
            <Link
              href={basePath}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5"
            >
              Limpiar
            </Link>
          </div>
          {variant === "admin" ? (
            <div className="flex flex-wrap items-center gap-2">
              <ProductosExportOskCsvButton />
              <AdminButtonLink href="/admin/productos/nueva">Nuevo producto</AdminButtonLink>
            </div>
          ) : null}
        </div>
      </form>

      <p className="text-xs text-slate-500">
        {total === 0
          ? "Sin resultados con estos filtros."
          : rows.length < total
            ? `Mostrando ${rows.length} de ${total} producto(s) (máx. ${filtros.pageSize} por carga; refiná filtros para ver el resto).`
            : `Mostrando ${rows.length} producto(s) · desplazá con la barra de la tabla.`}
      </p>

      <ProductosCatalogoTabla
        rows={rows}
        sucursales={sucursales}
        variant={variant}
        mostrarPrecioCompra={variant === "admin"}
        modoAccion={variant === "vendedor" ? "solo-lectura" : "editar"}
      />
    </div>
  );
}
