import "server-only";

import { pool } from "@/lib/db";
import { getProveedorActivo } from "@/lib/data/proveedores";
import {
  getProducto,
  replaceProductoImagenesWithConnection,
  updateProductoWithConnection,
  type ProductoUpdateInput,
} from "@/lib/data/productos";
import { getSucursal } from "@/lib/data/sucursales";
import type { ResultSetHeader } from "mysql2";

export type TipoPagoCompra = "efectivo" | "qr" | "tarjeta" | "credito";

export type LineaIngresoInput = {
  productoId: number;
  cantidad: number;
  precioCompraUnitBs: number;
  /** Si es null, se calcula con tipo de cambio. */
  precioCompraUnitUsd: number | null;
  /** null = mantener catálogo */
  precioVentaRefBs: number | null;
  precioVentaRefUsd: number | null;
  porcentajeUtilidad: number | null;
  puntoTope: number | null;
  qrPayload: string;
  /** Si viene vacío se conserva el catálogo. */
  codigoPiezaLinea: string;
  medida: string;
  descripcion: string;
  repuesto: string;
  imagenesUrls: string[];
  /** Si true, se aplica la lista de URLs (vacía borra la galería). */
  reemplazarImagenes: boolean;
};

export type IngresoCompraInput = {
  usuarioId: number;
  sucursalId: number;
  proveedorId: number;
  tipoPago: TipoPagoCompra;
  tipoCambioId: number;
  tipoCambioSnapshot: number;
  /** % flete sobre precio compra unitario (USD): costo final = compra × (1 + %/100). */
  pctFlete: number;
  numeroDocumento: string | null;
  observaciones: string | null;
  /** @deprecated Usar pctFlete por unidad; se ignora si pctFlete > 0 o siempre. */
  fleteTotalBsManual: number | null;
  lineas: LineaIngresoInput[];
};

import { costoConFleteUsd, round2, round4 } from "@/lib/precio-utilidad";

function strNum(s: string | null | undefined): number | null {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function pickNum(
  lineVal: number | null | undefined,
  dbVal: number | null
): number | null {
  if (lineVal !== null && lineVal !== undefined) return lineVal;
  return dbVal;
}

function buildProductoPatch(
  p: NonNullable<Awaited<ReturnType<typeof getProducto>>>,
  line: LineaIngresoInput
): ProductoUpdateInput {
  return {
    codigo: p.codigo,
    qr_payload: line.qrPayload.trim() || p.qr_payload,
    codigo_pieza: line.codigoPiezaLinea.trim() || p.codigo_pieza,
    nombre: p.nombre,
    especificacion: p.especificacion,
    repuesto: line.repuesto.trim() || p.repuesto,
    procedencia: p.procedencia,
    medida: line.medida.trim() || null,
    descripcion: line.descripcion.trim() || null,
    unidad: p.unidad,
    marca_auto: p.marca_auto,
    precio_venta_lista_bs: pickNum(line.precioVentaRefBs, strNum(p.precio_venta_lista_bs)),
    precio_venta_lista_usd: pickNum(line.precioVentaRefUsd, strNum(p.precio_venta_lista_usd)),
    porcentaje_utilidad: pickNum(line.porcentajeUtilidad, strNum(p.porcentaje_utilidad)),
    punto_tope: pickNum(line.puntoTope, strNum(p.punto_tope)),
    estado: p.estado,
  };
}

type LineaCalculada = {
  line: LineaIngresoInput;
  precioUnitUsd: number;
  subtotalBs: number;
  subtotalUsd: number;
  montoFleteBs: number;
  totalBs: number;
  totalUsd: number;
  patch: ProductoUpdateInput | null;
};

export type IngresoCompraResult =
  | { ok: true; compraId: number }
  | { ok: false; message: string };

export async function registrarIngresoCompra(input: IngresoCompraInput): Promise<IngresoCompraResult> {
  const tc = input.tipoCambioSnapshot;
  if (!Number.isFinite(tc) || tc <= 0) {
    return { ok: false, message: "Tipo de cambio inválido." };
  }

  const suc = await getSucursal(input.sucursalId);
  if (!suc || suc.estado !== "activo") {
    return { ok: false, message: "Sucursal inválida o inactiva." };
  }

  const prov = await getProveedorActivo(input.proveedorId);
  if (!prov) {
    return { ok: false, message: "Proveedor inválido o inactivo." };
  }

  if (!input.lineas.length) {
    return { ok: false, message: "Agregá al menos un ítem." };
  }

  const calculadas: LineaCalculada[] = [];
  let sumSubBs = 0;
  let sumSubUsd = 0;
  let sumFleteBs = 0;

  const pctFlete = Math.max(0, Number(input.pctFlete) || 0);

  for (const line of input.lineas) {
    if (!Number.isFinite(line.productoId) || line.productoId < 1) {
      return { ok: false, message: "Ítem con producto inválido." };
    }
    const cant = Math.trunc(line.cantidad);
    if (cant < 1) {
      return { ok: false, message: "La cantidad debe ser al menos 1 en cada ítem." };
    }
    const pUnitBs = round2(line.precioCompraUnitBs);
    if (!Number.isFinite(pUnitBs) || pUnitBs < 0) {
      return { ok: false, message: "Precio de compra inválido." };
    }
    const baseUsd =
      line.precioCompraUnitUsd !== null && Number.isFinite(line.precioCompraUnitUsd)
        ? round4(line.precioCompraUnitUsd)
        : round4(pUnitBs / tc);
    const baseBs = round2(baseUsd * tc);
    const landedUsd = costoConFleteUsd(baseUsd, pctFlete);
    const landedBs = round2(landedUsd * tc);

    const subUsd = round4(cant * baseUsd);
    const subBs = round2(subUsd * tc);
    const montoFleteUsd = round4(cant * baseUsd * (pctFlete / 100));
    const montoFleteBs = round2(montoFleteUsd * tc);
    const totalUsd = round4(cant * landedUsd);
    const totalBs = round2(totalUsd * tc);

    sumSubBs = round2(sumSubBs + subBs);
    sumSubUsd = round4(sumSubUsd + subUsd);
    sumFleteBs = round2(sumFleteBs + montoFleteBs);

    calculadas.push({
      line,
      precioUnitUsd: baseUsd,
      subtotalBs: subBs,
      subtotalUsd: subUsd,
      montoFleteBs,
      totalBs,
      totalUsd,
      patch: null,
    });
  }

  sumSubBs = round2(sumSubBs);
  sumSubUsd = round4(sumSubUsd);
  const fleteTotal = round2(sumFleteBs);
  const totalBs = round2(calculadas.reduce((s, c) => s + c.totalBs, 0));
  const totalUsd = round4(calculadas.reduce((s, c) => s + c.totalUsd, 0));

  /** Si el mismo producto va en más de una línea, no pisamos `productos` (lista/QR/etc.): cada línea queda en detalle y lotes. */
  const lineasPorProducto = new Map<number, number>();
  for (const line of input.lineas) {
    lineasPorProducto.set(line.productoId, (lineasPorProducto.get(line.productoId) ?? 0) + 1);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const catalogoYaAplicado = new Set<number>();

    for (const c of calculadas) {
      const p = await getProducto(c.line.productoId);
      if (!p || p.estado !== "activo") {
        await conn.rollback();
        return { ok: false, message: `Producto #${c.line.productoId} no existe o está inactivo.` };
      }
      const patch = buildProductoPatch(p, c.line);
      c.patch = patch;

      const pid = c.line.productoId;
      const repetidoEnEstaCompra = (lineasPorProducto.get(pid) ?? 0) > 1;
      if (repetidoEnEstaCompra) {
        continue;
      }
      if (!catalogoYaAplicado.has(pid)) {
        catalogoYaAplicado.add(pid);
        await updateProductoWithConnection(conn, pid, patch);
        if (c.line.reemplazarImagenes) {
          await replaceProductoImagenesWithConnection(conn, pid, c.line.imagenesUrls);
        }
      }
    }

    const [compraRes] = await conn.execute<ResultSetHeader>(
      `INSERT INTO compras (
        numero_documento, proveedor_id, usuario_id, sucursal_id, tipo_pago,
        tipo_cambio_id, tipo_cambio_snapshot, precio_flete_total_bs,
        subtotal_bs, subtotal_usd, total_bs, total_usd, observaciones, estado, fecha
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmada', NOW())`,
      [
        input.numeroDocumento?.trim() || null,
        input.proveedorId,
        input.usuarioId,
        input.sucursalId,
        input.tipoPago,
        input.tipoCambioId,
        tc,
        fleteTotal,
        sumSubBs,
        sumSubUsd,
        totalBs,
        totalUsd,
        input.observaciones?.trim() || null,
      ]
    );
    const compraId = compraRes.insertId;

    for (const c of calculadas) {
      const line = c.line;
      const cant = Math.trunc(line.cantidad);
      const patch = c.patch!;
      const [detRes] = await conn.execute<ResultSetHeader>(
        `INSERT INTO compra_detalle (
          compra_id, producto_id, cantidad,
          precio_compra_unitario_bs, precio_compra_unitario_usd,
          precio_venta_referencia_bs, precio_venta_referencia_usd,
          porcentaje_utilidad, punto_tope, monto_flete_prorrateado_bs,
          subtotal_linea_bs, subtotal_linea_usd, total_linea_bs, total_linea_usd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          compraId,
          line.productoId,
          cant,
          round2(line.precioCompraUnitBs),
          c.precioUnitUsd,
          patch.precio_venta_lista_bs,
          patch.precio_venta_lista_usd,
          patch.porcentaje_utilidad,
          patch.punto_tope,
          c.montoFleteBs,
          c.subtotalBs,
          c.subtotalUsd,
          c.totalBs,
          c.totalUsd,
        ]
      );
      const detalleId = detRes.insertId;

      const costoUnitBs = round2(c.totalBs / cant);
      const costoUnitUsd = round4(c.totalUsd / cant);

      await conn.execute(
        `INSERT INTO lotes (
          producto_id, compra_detalle_id, sucursal_id,
          cantidad_inicial, stock_restante, costo_unitario_bs, costo_unitario_usd, fecha_ingreso, agotado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 0)`,
        [line.productoId, detalleId, input.sucursalId, cant, cant, costoUnitBs, costoUnitUsd]
      );

      await conn.execute(
        `INSERT INTO inventario (producto_id, sucursal_id, stock, actualizado_en)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock), actualizado_en = NOW()`,
        [line.productoId, input.sucursalId, cant]
      );

      await conn.execute(
        `INSERT INTO movimientos_inventario (
          producto_id, sucursal_id, tipo, cantidad, referencia_tipo, referencia_id, usuario_id, nota, fecha
        ) VALUES (?, ?, 'entrada', ?, 'compra', ?, ?, ?, NOW())`,
        [line.productoId, input.sucursalId, cant, compraId, input.usuarioId, `Compra #${compraId}`]
      );
    }

    await conn.commit();
    return { ok: true, compraId };
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return { ok: false, message: "No se pudo registrar la compra (error de base de datos)." };
  } finally {
    conn.release();
  }
}
