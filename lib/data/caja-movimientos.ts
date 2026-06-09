import "server-only";

import { labelDetalleProductoCodigoNombre } from "@/lib/caja/detalle-producto-label";
import { codigoTienda } from "@/lib/caja/tienda-codigo";
import { pool } from "@/lib/db";
import {
  consumirStockCaja,
  ingresarStockCaja,
  resolverProductoActivoPorCodigo,
} from "@/lib/data/inventario-caja";
import {
  diaRangoDatetimeSql,
  formatDateTimeMysqlBolivia,
  ventasCobroRangoFechaSql,
} from "@/lib/fecha-bolivia";
import { withBoliviaMysqlSession } from "@/lib/mysql-bolivia-session";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

/*
  MySQL (opcional; la app también crea/migra al primer uso):

  CREATE TABLE caja_movimientos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sucursal_id INT UNSIGNED NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    tipo ENUM('ingreso','egreso') NOT NULL,
    detalle VARCHAR(500) NOT NULL,
    monto_bs DECIMAL(18,2) NOT NULL,
    en_dolares TINYINT(1) NOT NULL DEFAULT 0,
    monto_usd DECIMAL(18,4) NULL,
    tipo_cambio_compra DECIMAL(18,6) NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_caja_mov_suc_fecha (sucursal_id, fecha),
    KEY idx_caja_mov_usuario (usuario_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
*/

export type CajaMovimientoTipo = "ingreso" | "egreso";

export type CajaMovimientoRow = {
  id: number;
  tipo: CajaMovimientoTipo;
  detalle: string;
  montoBs: number;
  /** Compra de dólares: egreso calculado al tipo de cambio pagado. */
  esCompraDolar: boolean;
  montoUsd: number | null;
  tipoCambioCompra: number | null;
  fecha: string;
  usuarioId: number;
  cajeroUsername: string;
  cajeroNombre: string;
};

let tableReady = false;

async function ensureCajaMovimientosColumns(): Promise<void> {
  const alters = [
    `ALTER TABLE caja_movimientos ADD COLUMN monto_usd DECIMAL(18,4) NULL AFTER en_dolares`,
    `ALTER TABLE caja_movimientos ADD COLUMN tipo_cambio_compra DECIMAL(18,6) NULL AFTER monto_usd`,
  ];
  for (const sql of alters) {
    try {
      await pool.execute(sql);
    } catch (err: unknown) {
      const e = err as { errno?: number };
      if (e.errno !== 1060) throw err;
    }
  }
}

async function ensureCajaMovimientosTable(): Promise<void> {
  if (tableReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS caja_movimientos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      sucursal_id INT UNSIGNED NOT NULL,
      usuario_id INT UNSIGNED NOT NULL,
      tipo ENUM('ingreso','egreso') NOT NULL,
      detalle VARCHAR(500) NOT NULL,
      monto_bs DECIMAL(18,2) NOT NULL,
      en_dolares TINYINT(1) NOT NULL DEFAULT 0,
      monto_usd DECIMAL(18,4) NULL,
      tipo_cambio_compra DECIMAL(18,6) NULL,
      fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_caja_mov_suc_fecha (sucursal_id, fecha),
      KEY idx_caja_mov_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await ensureCajaMovimientosColumns();
  tableReady = true;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round4(n: number) {
  return Math.round(n * 1e4) / 1e4;
}

function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

export type RegistrarCajaMovimientoInput = {
  sucursalId: number;
  usuarioId: number;
  tipo: CajaMovimientoTipo;
  detalle: string;
  montoBs: number;
  compraDolar?: {
    montoUsd: number;
    tipoCambioCompra: number;
  };
};

export type RegistrarDevolucionCajaInput = {
  sucursalId: number;
  usuarioId: number;
  codigo: string;
  cantidad: number;
  montoBs: number;
  nombre?: string | null;
  nota?: string | null;
  /** Referencia de solicitud aprobada (movimiento inventario). */
  solicitudId?: number;
};

export type RegistrarCambioCajaInput = {
  sucursalId: number;
  usuarioId: number;
  devuelto: { codigo: string; cantidad: number; montoBs: number; nombre?: string | null };
  entregado: { codigo: string; cantidad: number; montoBs: number; nombre?: string | null };
  nota?: string | null;
  solicitudId?: number;
};

/** Texto estándar para devolución / egreso en cambio (como planilla). */
export function detalleTextoDevolucion(input: {
  codigo: string;
  cantidad: number;
  codigoCambioCon?: string | null;
  nombre?: string | null;
}): string {
  const cod = input.codigo.trim().toUpperCase();
  if (!cod) return "DEV";
  const qty = Math.max(1, Math.trunc(input.cantidad));
  const pza = qty === 1 ? "1PZA " : `${qty}PZA `;
  let s = `DEV ${pza}COD ${cod}`;
  const cambio = input.codigoCambioCon?.trim().toUpperCase();
  if (cambio) s += ` (CAMBIO CON COD ${cambio})`;
  const nom = input.nombre?.trim();
  if (nom) s = `${s} · ${nom}`;
  return s.slice(0, 500);
}

export function detalleTextoCambioEntregado(codigo: string, nombre?: string | null): string {
  const cod = codigo.trim().toUpperCase();
  const nom = nombre?.trim() ?? "";
  return labelDetalleProductoCodigoNombre(
    cod ? `CAMBIO ENT COD ${cod}` : "CAMBIO ENT",
    nom
  ).slice(0, 500);
}

type InsertCajaRow = {
  sucursalId: number;
  usuarioId: number;
  tipo: CajaMovimientoTipo;
  detalle: string;
  montoBs: number;
  esCompraDolar?: boolean;
  montoUsd?: number | null;
  tipoCambioCompra?: number | null;
  fecha?: string;
};

async function insertCajaMovimientoRow(
  executor: PoolConnection | typeof pool,
  row: InsertCajaRow
): Promise<number> {
  const fecha = row.fecha ?? formatDateTimeMysqlBolivia(new Date());
  const [res] = await executor.execute<ResultSetHeader>(
    `INSERT INTO caja_movimientos (
       sucursal_id, usuario_id, tipo, detalle, monto_bs, en_dolares,
       monto_usd, tipo_cambio_compra, fecha
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.sucursalId,
      row.usuarioId,
      row.tipo,
      row.detalle,
      round2(row.montoBs),
      row.esCompraDolar ? 1 : 0,
      row.montoUsd ?? null,
      row.tipoCambioCompra ?? null,
      fecha,
    ]
  );
  return Number(res.insertId);
}

export async function registrarCajaMovimiento(
  input: RegistrarCajaMovimientoInput
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  await ensureCajaMovimientosTable();

  if (!Number.isFinite(input.sucursalId) || input.sucursalId < 1) {
    return { ok: false, message: "Sucursal no válida." };
  }
  if (!Number.isFinite(input.usuarioId) || input.usuarioId < 1) {
    return { ok: false, message: "Usuario no válido." };
  }

  let tipo = input.tipo;
  let detalle = input.detalle.trim();
  let montoBs = round2(Number(input.montoBs));
  let esCompraDolar = 0;
  let montoUsd: number | null = null;
  let tipoCambioCompra: number | null = null;

  if (input.compraDolar) {
    const usd = round4(Number(input.compraDolar.montoUsd));
    const tc = round6(Number(input.compraDolar.tipoCambioCompra));
    if (!Number.isFinite(usd) || usd <= 0) {
      return { ok: false, message: "Indicá la cantidad de dólares comprados." };
    }
    if (!Number.isFinite(tc) || tc <= 0) {
      return { ok: false, message: "Indicá el tipo de cambio al que compraste el dólar (Bs/USD)." };
    }
    tipo = "egreso";
    montoBs = round2(usd * tc);
    esCompraDolar = 1;
    montoUsd = usd;
    tipoCambioCompra = tc;
    if (!detalle) {
      detalle = `COMPRA DOLAR ${usd.toFixed(2)} USD @ ${tc.toFixed(4)} Bs/USD`;
    }
  } else {
    if (tipo !== "ingreso" && tipo !== "egreso") {
      return { ok: false, message: "Tipo de movimiento no válido." };
    }
    if (!detalle) return { ok: false, message: "Indicá el detalle del movimiento." };
    if (!Number.isFinite(montoBs) || montoBs <= 0) {
      return { ok: false, message: "El monto debe ser mayor a 0." };
    }
  }

  if (detalle.length > 500) {
    return { ok: false, message: "El detalle es demasiado largo (máx. 500 caracteres)." };
  }

  const id = await insertCajaMovimientoRow(pool, {
    sucursalId: input.sucursalId,
    usuarioId: input.usuarioId,
    tipo,
    detalle,
    montoBs,
    esCompraDolar: esCompraDolar === 1,
    montoUsd,
    tipoCambioCompra,
  });
  return { ok: true, id };
}

export async function registrarDevolucionCaja(
  input: RegistrarDevolucionCajaInput,
  existingConn?: PoolConnection
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  await ensureCajaMovimientosTable();
  const codigo = input.codigo.trim().toUpperCase();
  if (!codigo) return { ok: false, message: "Indicá el código del producto devuelto." };
  const cantidad = Math.max(1, Math.trunc(Number(input.cantidad)));
  const montoBs = round2(Number(input.montoBs));
  if (!Number.isFinite(montoBs) || montoBs <= 0) {
    return { ok: false, message: "El monto de la devolución debe ser mayor a 0." };
  }
  let detalle = detalleTextoDevolucion({ codigo, cantidad, nombre: input.nombre });
  const nota = input.nota?.trim();
  if (nota) detalle = `${detalle} — ${nota}`.slice(0, 500);

  const conn = existingConn ?? (await pool.getConnection());
  const ownConn = !existingConn;
  try {
    if (ownConn) await conn.beginTransaction();
    const producto = await resolverProductoActivoPorCodigo(conn, codigo);
    if (!producto) {
      if (ownConn) await conn.rollback();
      return { ok: false, message: "Producto devuelto no encontrado o inactivo." };
    }

    const fecha = formatDateTimeMysqlBolivia(new Date());
    const id = await insertCajaMovimientoRow(conn, {
      sucursalId: input.sucursalId,
      usuarioId: input.usuarioId,
      tipo: "egreso",
      detalle,
      montoBs,
      fecha,
    });

    const inv = await ingresarStockCaja(conn, {
      productoId: producto.id,
      sucursalId: input.sucursalId,
      cantidad,
      referenciaTipo: "devolucion",
      referenciaId: input.solicitudId ?? id,
      usuarioId: input.usuarioId,
      nota: `Devolución caja #${id}`,
      fecha,
    });
    if (!inv.ok) {
      if (ownConn) await conn.rollback();
      return inv;
    }

    if (ownConn) await conn.commit();
    return { ok: true, id };
  } catch {
    if (ownConn) await conn.rollback();
    return { ok: false, message: "No se pudo registrar la devolución. Intentá de nuevo." };
  } finally {
    if (ownConn) conn.release();
  }
}

export async function registrarCambioCaja(
  input: RegistrarCambioCajaInput,
  existingConn?: PoolConnection
): Promise<{ ok: true; ids: [number, number] } | { ok: false; message: string }> {
  await ensureCajaMovimientosTable();
  const codDev = input.devuelto.codigo.trim().toUpperCase();
  const codEnt = input.entregado.codigo.trim().toUpperCase();
  if (!codDev) return { ok: false, message: "Indicá el código del producto devuelto." };
  if (!codEnt) return { ok: false, message: "Indicá el código del producto entregado." };
  if (codDev === codEnt) {
    return { ok: false, message: "El producto devuelto y el entregado deben ser distintos." };
  }

  const cantDev = Math.max(1, Math.trunc(Number(input.devuelto.cantidad)));
  const cantEnt = Math.max(1, Math.trunc(Number(input.entregado.cantidad)));
  const montoDev = round2(Number(input.devuelto.montoBs));
  const montoEnt = round2(Number(input.entregado.montoBs));
  if (!Number.isFinite(montoDev) || montoDev <= 0) {
    return { ok: false, message: "El monto del producto devuelto debe ser mayor a 0." };
  }
  if (!Number.isFinite(montoEnt) || montoEnt <= 0) {
    return { ok: false, message: "El monto del producto entregado debe ser mayor a 0." };
  }

  let detalleEgr = detalleTextoDevolucion({
    codigo: codDev,
    cantidad: cantDev,
    codigoCambioCon: codEnt,
    nombre: input.devuelto.nombre,
  });
  let detalleIng = detalleTextoCambioEntregado(codEnt, input.entregado.nombre);
  const nota = input.nota?.trim();
  if (nota) {
    detalleEgr = `${detalleEgr} — ${nota}`.slice(0, 500);
    detalleIng = `${detalleIng} — ${nota}`.slice(0, 500);
  }

  const conn = existingConn ?? (await pool.getConnection());
  const ownConn = !existingConn;
  try {
    if (ownConn) await conn.beginTransaction();
    const prodDev = await resolverProductoActivoPorCodigo(conn, codDev);
    if (!prodDev) {
      if (ownConn) await conn.rollback();
      return { ok: false, message: "Producto devuelto no encontrado o inactivo." };
    }
    const prodEnt = await resolverProductoActivoPorCodigo(conn, codEnt);
    if (!prodEnt) {
      if (ownConn) await conn.rollback();
      return { ok: false, message: "Producto entregado no encontrado o inactivo." };
    }

    const fecha = formatDateTimeMysqlBolivia(new Date());
    const refId = input.solicitudId ?? 0;

    const salida = await consumirStockCaja(conn, {
      productoId: prodEnt.id,
      sucursalId: input.sucursalId,
      cantidad: cantEnt,
      referenciaTipo: "cambio_entregado",
      referenciaId: refId,
      usuarioId: input.usuarioId,
      nota: `Cambio entregado COD ${codEnt}`,
      fecha,
    });
    if (!salida.ok) {
      if (ownConn) await conn.rollback();
      return salida;
    }

    const entrada = await ingresarStockCaja(conn, {
      productoId: prodDev.id,
      sucursalId: input.sucursalId,
      cantidad: cantDev,
      referenciaTipo: "cambio_devuelto",
      referenciaId: refId,
      usuarioId: input.usuarioId,
      nota: `Cambio devuelto COD ${codDev}`,
      fecha,
    });
    if (!entrada.ok) {
      if (ownConn) await conn.rollback();
      return entrada;
    }

    const idEgr = await insertCajaMovimientoRow(conn, {
      sucursalId: input.sucursalId,
      usuarioId: input.usuarioId,
      tipo: "egreso",
      detalle: detalleEgr,
      montoBs: montoDev,
      fecha,
    });
    const idIng = await insertCajaMovimientoRow(conn, {
      sucursalId: input.sucursalId,
      usuarioId: input.usuarioId,
      tipo: "ingreso",
      detalle: detalleIng,
      montoBs: montoEnt,
      fecha,
    });
    if (ownConn) await conn.commit();
    return { ok: true, ids: [idEgr, idIng] };
  } catch {
    if (ownConn) await conn.rollback();
    return { ok: false, message: "No se pudo registrar el cambio. Intentá de nuevo." };
  } finally {
    if (ownConn) conn.release();
  }
}

function mapMovimientoRow(r: RowDataPacket): CajaMovimientoRow {
  const esCompraDolar = Number(r.en_dolares ?? 0) === 1;
  const montoUsdRaw = r.monto_usd != null ? Number(r.monto_usd) : null;
  const tcRaw = r.tipo_cambio_compra != null ? Number(r.tipo_cambio_compra) : null;
  return {
    id: Number(r.id),
    tipo: r.tipo === "ingreso" ? "ingreso" : "egreso",
    detalle: String(r.detalle ?? "").trim(),
    montoBs: Number(r.monto_bs ?? 0),
    esCompraDolar,
    montoUsd:
      montoUsdRaw != null && Number.isFinite(montoUsdRaw) && montoUsdRaw > 0 ? montoUsdRaw : null,
    tipoCambioCompra:
      tcRaw != null && Number.isFinite(tcRaw) && tcRaw > 0 ? tcRaw : null,
    fecha:
      r.fecha instanceof Date
        ? r.fecha.toISOString()
        : typeof r.fecha === "string"
          ? r.fecha
          : "",
    usuarioId: Number(r.usuario_id),
    cajeroUsername: String(r.username ?? ""),
    cajeroNombre: String(r.nombre_completo ?? "").trim() || String(r.username ?? ""),
  };
}

export async function listCajaMovimientosDia(
  sucursalId: number,
  fecha: string
): Promise<CajaMovimientoRow[]> {
  await ensureCajaMovimientosTable();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return [];

  const rango = diaRangoDatetimeSql(f, "m.fecha");
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT m.id, m.tipo, m.detalle, m.monto_bs, m.en_dolares, m.monto_usd, m.tipo_cambio_compra,
              m.fecha, m.usuario_id, u.username, u.nombre_completo
       FROM caja_movimientos m
       INNER JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.sucursal_id = ?
         ${rango.clause}
       ORDER BY m.fecha ASC, m.id ASC`,
      [sucursalId, ...rango.params]
    )
  );

  return (rows as RowDataPacket[]).map(mapMovimientoRow);
}

export async function deleteCajaMovimiento(
  id: number,
  sucursalId: number,
  usuarioId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureCajaMovimientosTable();
  if (!Number.isFinite(id) || id < 1) return { ok: false, message: "Movimiento no válido." };
  if (!Number.isFinite(sucursalId) || sucursalId < 1) {
    return { ok: false, message: "Sucursal no válida." };
  }
  if (!Number.isFinite(usuarioId) || usuarioId < 1) {
    return { ok: false, message: "Usuario no válido." };
  }

  try {
    const [linkRows] = await pool.execute<RowDataPacket[]>(
      `SELECT id FROM caja_solicitudes
       WHERE movimiento_egreso_id = ? OR movimiento_ingreso_id = ?
       LIMIT 1`,
      [id, id]
    );
    if ((linkRows as RowDataPacket[]).length > 0) {
      return { ok: false, message: "No se puede borrar un movimiento vinculado a devolución o cambio." };
    }
  } catch (err: unknown) {
    const e = err as { errno?: number };
    if (e.errno !== 1146) throw err;
  }

  const [res] = await pool.execute<ResultSetHeader>(
    `DELETE FROM caja_movimientos WHERE id = ? AND sucursal_id = ? AND usuario_id = ?`,
    [id, sucursalId, usuarioId]
  );
  if (res.affectedRows < 1) {
    return {
      ok: false,
      message: "No se encontró el movimiento o no tenés permiso para borrarlo.",
    };
  }
  return { ok: true };
}

/** Productos vendidos (confirmados) en la sucursal un día, agrupados por producto. */
export type VentaProductoDiaRow = {
  productoId: number;
  codigo: string;
  medida: string;
  nombre: string;
  cantidad: number;
  totalBs: number;
};

export async function listVentasProductosDiaSucursal(
  sucursalId: number,
  fecha: string,
  limitRows = 5000
): Promise<VentaProductoDiaRow[]> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return [];

  const lim = Math.min(Math.max(1, Math.trunc(limitRows)), 8000);
  const rango = ventasCobroRangoFechaSql(f, f);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT p.id AS producto_id,
            COALESCE(
              NULLIF(TRIM(p.qr_payload), ''),
              NULLIF(TRIM(p.codigo_pieza), ''),
              NULLIF(TRIM(p.codigo), ''),
              '—'
            ) AS codigo,
            COALESCE(NULLIF(TRIM(p.medida), ''), '—') AS medida,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS nombre,
            SUM(d.cantidad) AS cantidad,
            COALESCE(SUM(d.total_linea_bs), 0) AS total_bs
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE v.sucursal_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}
     GROUP BY p.id, codigo, medida, nombre
     ORDER BY nombre ASC, codigo ASC, p.id ASC
     LIMIT ${lim}`,
      [sucursalId, ...rango.params]
    )
  );

  return (rows as RowDataPacket[]).map((r) => ({
    productoId: Number(r.producto_id),
    codigo: String(r.codigo ?? "—"),
    medida: String(r.medida ?? "—"),
    nombre: String(r.nombre ?? "—"),
    cantidad: Number(r.cantidad ?? 0),
    totalBs: round2(Number(r.total_bs ?? 0)),
  }));
}

/** Total Bs de ventas confirmadas y cobradas de la sucursal en un día (calendario Bolivia). */
export async function totalVentasConfirmadasDiaBs(
  sucursalId: number,
  fecha: string
): Promise<number> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return 0;
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return 0;

  const rango = ventasCobroRangoFechaSql(f, f);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(v.total_bs), 0) AS total_bs
     FROM ventas v
     WHERE v.sucursal_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}`,
      [sucursalId, ...rango.params]
    )
  );
  return round2(Number((rows[0] as RowDataPacket | undefined)?.total_bs ?? 0));
}

/** Suma de líneas de detalle (cobradas) del día; debe coincidir con el total de documentos. */
export async function totalVentasDetalleCobradasDiaBs(
  sucursalId: number,
  fecha: string
): Promise<number> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return 0;
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return 0;

  const rango = ventasCobroRangoFechaSql(f, f);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(d.total_linea_bs), 0) AS total_bs
     FROM venta_detalle d
     INNER JOIN ventas v ON v.id = d.venta_id
     WHERE v.sucursal_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}`,
      [sucursalId, ...rango.params]
    )
  );
  return round2(Number((rows[0] as RowDataPacket | undefined)?.total_bs ?? 0));
}

/** Cantidad de documentos de venta cobrados en el día. */
export async function countVentasCobradasDiaSucursal(
  sucursalId: number,
  fecha: string
): Promise<number> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return 0;
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return 0;

  const rango = ventasCobroRangoFechaSql(f, f);
  const [rows] = await withBoliviaMysqlSession((conn) =>
    conn.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS n
     FROM ventas v
     WHERE v.sucursal_id = ?
       AND v.estado = 'confirmada'
       ${rango.clause}`,
      [sucursalId, ...rango.params]
    )
  );
  return Number((rows[0] as RowDataPacket | undefined)?.n ?? 0);
}

/** Total Bs del día: documentos de venta; si no cuadra con el detalle, usa la suma de líneas. */
export async function totalVentasCobradasDiaBsReconciliado(
  sucursalId: number,
  fecha: string
): Promise<number> {
  const [porVentas, porDetalle] = await Promise.all([
    totalVentasConfirmadasDiaBs(sucursalId, fecha),
    totalVentasDetalleCobradasDiaBs(sucursalId, fecha),
  ]);
  if (porDetalle > porVentas + 0.01) return porDetalle;
  return porVentas;
}

/** Número de documento para el reporte del día (referencia estable). */
export async function numeroDocumentoIngresosEgresosDia(
  sucursalId: number,
  fecha: string
): Promise<number> {
  await ensureCajaMovimientosTable();
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return 1;

  const [movRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(MAX(id), 0) AS n
     FROM caja_movimientos
     WHERE sucursal_id = ? AND DATE(fecha) = ?`,
    [sucursalId, f]
  );
  const movMax = Number((movRows[0] as RowDataPacket | undefined)?.n ?? 0);

  const [venRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(MAX(id), 0) AS n
     FROM ventas
     WHERE sucursal_id = ?
       AND estado = 'confirmada'
       AND DATE(fecha) = ?`,
    [sucursalId, f]
  );
  const venMax = Number((venRows[0] as RowDataPacket | undefined)?.n ?? 0);

  const n = Math.max(movMax, venMax);
  return n > 0 ? n : 1;
}

export type ReporteIngresosEgresosDia = {
  fecha: string;
  sucursalId: number;
  sucursalNombre: string;
  tiendaCodigo: string;
  movimientos: CajaMovimientoRow[];
};

export async function getReporteIngresosEgresosDiaSucursal(
  sucursalId: number,
  fecha: string,
  sucursalNombre: string
): Promise<ReporteIngresosEgresosDia | null> {
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return null;
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;

  const movimientos = await listCajaMovimientosDia(sucursalId, f);

  return {
    fecha: f,
    sucursalId,
    sucursalNombre,
    tiendaCodigo: codigoTienda(sucursalId, sucursalNombre),
    movimientos,
  };
}
