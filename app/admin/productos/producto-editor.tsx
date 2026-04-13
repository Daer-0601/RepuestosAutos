import { ProductoImagenesUrlsField } from "@/app/admin/productos/_components/producto-imagenes-urls-field";
import { createProductoAction, updateProductoAction } from "@/app/admin/productos/actions";
import { getProducto, listProductoImagenes } from "@/lib/data/productos";
import { notFound } from "next/navigation";

const field =
  "mt-1 w-full rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/40";

export async function ProductoEditor({
  mode,
  id,
}: {
  mode: "create" | "edit";
  id?: number;
}) {
  const product = mode === "edit" && id ? await getProducto(id) : null;
  if (mode === "edit" && id && !product) {
    notFound();
  }
  const imagenes = mode === "edit" && id ? await listProductoImagenes(id) : [];
  const action = mode === "create" ? createProductoAction : updateProductoAction;

  const unidadDefault =
    product?.unidad === "JGO" || product?.unidad === "PZA" ? product.unidad : "PZA";

  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-6">
      <form action={action} encType="multipart/form-data" className="space-y-4">
        {mode === "edit" && product ? <input type="hidden" name="id" value={product.id} /> : null}
        {mode === "create" ? (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-100/90">
            El <strong className="font-medium text-emerald-200">código</strong> y el{" "}
            <strong className="font-medium text-emerald-200">QR</strong> se generan solos al crear (mismo
            número, secuencia según el catálogo).
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="codigo" className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Código *
              </label>
              <input
                id="codigo"
                name="codigo"
                required
                defaultValue={product?.codigo ?? ""}
                className={field}
              />
            </div>
            <div>
              <label
                htmlFor="qr_payload"
                className="text-xs font-medium uppercase tracking-wider text-slate-500"
              >
                QR payload
              </label>
              <input
                id="qr_payload"
                name="qr_payload"
                defaultValue={product?.qr_payload ?? ""}
                className={field}
                placeholder="Si vacío, se usa el código"
              />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="nombre" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Nombre *
          </label>
          <input
            id="nombre"
            name="nombre"
            required
            defaultValue={product?.nombre ?? ""}
            className={field}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="codigo_pieza"
              className="text-xs font-medium uppercase tracking-wider text-slate-500"
            >
              Código pieza
            </label>
            <input
              id="codigo_pieza"
              name="codigo_pieza"
              defaultValue={product?.codigo_pieza ?? ""}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="marca_auto" className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Marca auto
            </label>
            <input
              id="marca_auto"
              name="marca_auto"
              defaultValue={product?.marca_auto ?? ""}
              className={field}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="repuesto" className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Repuesto
            </label>
            <input id="repuesto" name="repuesto" defaultValue={product?.repuesto ?? ""} className={field} />
          </div>
          <div>
            <label htmlFor="unidad" className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Unidad
            </label>
            <select id="unidad" name="unidad" className={field} defaultValue={unidadDefault}>
              <option value="PZA">PZA</option>
              <option value="JGO">JGO</option>
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="procedencia" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Procedencia
          </label>
          <input
            id="procedencia"
            name="procedencia"
            defaultValue={product?.procedencia ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="medida" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Medida
          </label>
          <input id="medida" name="medida" defaultValue={product?.medida ?? ""} className={field} />
        </div>
        <div>
          <label
            htmlFor="especificacion"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            Especificación
          </label>
          <textarea
            id="especificacion"
            name="especificacion"
            rows={2}
            defaultValue={product?.especificacion ?? ""}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="descripcion" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            defaultValue={product?.descripcion ?? ""}
            className={field}
          />
        </div>
        {mode === "edit" ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="precio_venta_lista_bs"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  Precio lista Bs
                </label>
                <input
                  id="precio_venta_lista_bs"
                  name="precio_venta_lista_bs"
                  defaultValue={product?.precio_venta_lista_bs ?? ""}
                  className={field}
                />
              </div>
              <div>
                <label
                  htmlFor="precio_venta_lista_usd"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  Precio lista USD
                </label>
                <input
                  id="precio_venta_lista_usd"
                  name="precio_venta_lista_usd"
                  defaultValue={product?.precio_venta_lista_usd ?? ""}
                  className={field}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="porcentaje_utilidad"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  % utilidad
                </label>
                <input
                  id="porcentaje_utilidad"
                  name="porcentaje_utilidad"
                  defaultValue={product?.porcentaje_utilidad ?? ""}
                  className={field}
                />
              </div>
              <div>
                <label
                  htmlFor="punto_tope"
                  className="text-xs font-medium uppercase tracking-wider text-slate-500"
                >
                  Punto tope
                </label>
                <input
                  id="punto_tope"
                  name="punto_tope"
                  defaultValue={product?.punto_tope ?? ""}
                  className={field}
                />
              </div>
            </div>
          </>
        ) : null}
        <div>
          <label htmlFor="estado" className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            className={field}
            defaultValue={product?.estado ?? "activo"}
          >
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        {mode === "edit" ? <ProductoImagenesUrlsField initialUrls={imagenes} /> : null}
        <div className="space-y-2">
          <label
            htmlFor="imagen_archivos"
            className="text-xs font-medium uppercase tracking-wider text-slate-500"
          >
            {mode === "edit" ? "Agregar imágenes (archivos)" : "Subir imágenes"}
          </label>
          <input
            id="imagen_archivos"
            name="imagen_archivos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className={`${field} py-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-600`}
          />
          <p className="text-xs text-slate-500">JPG, PNG, WebP o GIF, hasta 5 MB por archivo.</p>
        </div>
        <button
          type="submit"
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500"
        >
          {mode === "create" ? "Crear producto" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
