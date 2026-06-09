import "server-only";

import {
  detalleTextoCambioEntregado,
  detalleTextoDevolucion,
  registrarCambioCaja,
  registrarDevolucionCaja,
} from "@/lib/data/caja-movimientos";
import { getProductoVentaCompletoPorCodigo } from "@/lib/data/ventas-vendedor";
import { pool } from "@/lib/db";
import { formatDateTimeMysqlBolivia } from "@/lib/fecha-bolivia";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

/*
  CREATE TABLE caja_solicitudes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sucursal_id INT UNSIGNED NOT NULL,
    cajero_usuario_id INT UNSIGNED NOT NULL,
    tipo ENUM('devolucion','cambio') NOT NULL,
    estado ENUM('pendiente','aprobada','rechazada','registrada') NOT NULL DEFAULT 'pendiente',
    codigo_devuelto VARCHAR(64) NOT NULL,
    nombre_devuelto VARCHAR(255) NULL,
    cantidad_devuelta INT UNSIGNED NOT NULL DEFAULT 1,
    monto_devuelto_bs DECIMAL(18,2) NOT NULL,
    codigo_entregado VARCHAR(64) NULL,
    nombre_entregado VARCHAR(255) NULL,
    cantidad_entregada INT UNSIGNED NULL,
    monto_entregado_bs DECIMAL(18,2) NULL,
    nota_cajero TEXT NULL,
    nota_admin TEXT NULL,
    admin_usuario_id INT UNSIGNED NULL,
    movimiento_egreso_id INT UNSIGNED NULL,
    movimiento_ingreso_id INT UNSIGNED NULL,
    fecha_solicitud DATETIME NOT NULL,
    fecha_resolucion DATETIME NULL,
    fecha_registro DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_caja_sol_estado (estado, fecha_solicitud),
    KEY idx_caja_sol_suc_fecha (sucursal_id, fecha_solicitud)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
*/

export type CajaSolicitudTipo = "devolucion" | "cambio";
export type CajaSolicitudEstado = "pendiente" | "aprobada" | "rechazada" | "registrada";

export type CajaSolicitudRow = {
  id: number;
  sucursalId: number;
  sucursalNombre: string;
  cajeroUsuarioId: number;
  cajeroUsername: string;
  cajeroNombre: string;
  tipo: CajaSolicitudTipo;
  estado: CajaSolicitudEstado;
  codigoDevuelto: string;
  nombreDevuelto: string | null;
  cantidadDevuelta: number;
  montoDevueltoBs: number;
  codigoEntregado: string | null;
  nombreEntregado: string | null;
  cantidadEntregada: number | null;
  montoEntregadoBs: number | null;
  notaCajero: string | null;
  notaAdmin: string | null;
  adminUsuarioId: number | null;
  adminNombre: string | null;
  movimientoEgresoId: number | null;
  movimientoIngresoId: number | null;
  fechaSolicitud: string;
  fechaResolucion: string | null;
  fechaRegistro: string | null;
};

let tableReady = false;

async function ensureCajaSolicitudesTable(): Promise<void> {
  if (tableReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS caja_solicitudes (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      sucursal_id INT UNSIGNED NOT NULL,
      cajero_usuario_id INT UNSIGNED NOT NULL,
      tipo ENUM('devolucion','cambio') NOT NULL,
      estado ENUM('pendiente','aprobada','rechazada','registrada') NOT NULL DEFAULT 'pendiente',
      codigo_devuelto VARCHAR(64) NOT NULL,
      nombre_devuelto VARCHAR(255) NULL,
      cantidad_devuelta INT UNSIGNED NOT NULL DEFAULT 1,
      monto_devuelto_bs DECIMAL(18,2) NOT NULL,
      codigo_entregado VARCHAR(64) NULL,
      nombre_entregado VARCHAR(255) NULL,
      cantidad_entregada INT UNSIGNED NULL,
      monto_entregado_bs DECIMAL(18,2) NULL,
      nota_cajero TEXT NULL,
      nota_admin TEXT NULL,
      admin_usuario_id INT UNSIGNED NULL,
      movimiento_egreso_id INT UNSIGNED NULL,
      movimiento_ingreso_id INT UNSIGNED NULL,
      fecha_solicitud DATETIME NOT NULL,
      fecha_resolucion DATETIME NULL,
      fecha_registro DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_caja_sol_estado (estado, fecha_solicitud),
      KEY idx_caja_sol_suc_fecha (sucursal_id, fecha_solicitud)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  tableReady = true;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function mapSolicitudRow(r: RowDataPacket): CajaSolicitudRow {
  return {
    id: Number(r.id),
    sucursalId: Number(r.sucursal_id),
    sucursalNombre: String(r.sucursal_nombre ?? "").trim(),
    cajeroUsuarioId: Number(r.cajero_usuario_id),
    cajeroUsername: String(r.cajero_username ?? ""),
    cajeroNombre:
      String(r.cajero_nombre ?? "").trim() || String(r.cajero_username ?? ""),
    tipo: r.tipo === "cambio" ? "cambio" : "devolucion",
    estado: (["pendiente", "aprobada", "rechazada", "registrada"].includes(String(r.estado))
      ? r.estado
      : "pendiente") as CajaSolicitudEstado,
    codigoDevuelto: String(r.codigo_devuelto ?? "").trim(),
    nombreDevuelto:
      r.nombre_devuelto != null && String(r.nombre_devuelto).trim() !== ""
        ? String(r.nombre_devuelto).trim()
        : null,
    cantidadDevuelta: Number(r.cantidad_devuelta ?? 1),
    montoDevueltoBs: Number(r.monto_devuelto_bs ?? 0),
    codigoEntregado:
      r.codigo_entregado != null && String(r.codigo_entregado).trim() !== ""
        ? String(r.codigo_entregado).trim()
        : null,
    nombreEntregado:
      r.nombre_entregado != null && String(r.nombre_entregado).trim() !== ""
        ? String(r.nombre_entregado).trim()
        : null,
    cantidadEntregada:
      r.cantidad_entregada != null ? Number(r.cantidad_entregada) : null,
    montoEntregadoBs: r.monto_entregado_bs != null ? Number(r.monto_entregado_bs) : null,
    notaCajero:
      r.nota_cajero != null && String(r.nota_cajero).trim() !== ""
        ? String(r.nota_cajero).trim()
        : null,
    notaAdmin:
      r.nota_admin != null && String(r.nota_admin).trim() !== ""
        ? String(r.nota_admin).trim()
        : null,
    adminUsuarioId: r.admin_usuario_id != null ? Number(r.admin_usuario_id) : null,
    adminNombre:
      r.admin_nombre != null && String(r.admin_nombre).trim() !== ""
        ? String(r.admin_nombre).trim()
        : null,
    movimientoEgresoId:
      r.movimiento_egreso_id != null ? Number(r.movimiento_egreso_id) : null,
    movimientoIngresoId:
      r.movimiento_ingreso_id != null ? Number(r.movimiento_ingreso_id) : null,
    fechaSolicitud:
      r.fecha_solicitud instanceof Date
        ? r.fecha_solicitud.toISOString()
        : typeof r.fecha_solicitud === "string"
          ? r.fecha_solicitud
          : "",
    fechaResolucion:
      r.fecha_resolucion instanceof Date
        ? r.fecha_resolucion.toISOString()
        : typeof r.fecha_resolucion === "string"
          ? r.fecha_resolucion
          : null,
    fechaRegistro:
      r.fecha_registro instanceof Date
        ? r.fecha_registro.toISOString()
        : typeof r.fecha_registro === "string"
          ? r.fecha_registro
          : null,
  };
}

const SELECT_SOLICITUD = `
  SELECT s.*,
         suc.nombre AS sucursal_nombre,
         uc.username AS cajero_username,
         uc.nombre_completo AS cajero_nombre,
         ua.nombre_completo AS admin_nombre
  FROM caja_solicitudes s
  INNER JOIN sucursales suc ON suc.id = s.sucursal_id
  INNER JOIN usuarios uc ON uc.id = s.cajero_usuario_id
  LEFT JOIN usuarios ua ON ua.id = s.admin_usuario_id
`;

export type CrearCajaSolicitudInput = {
  sucursalId: number;
  cajeroUsuarioId: number;
  tipo: CajaSolicitudTipo;
  devuelto: {
    codigo: string;
    nombre?: string | null;
    cantidad: number;
    montoBs: number;
  };
  entregado?: {
    codigo: string;
    nombre?: string | null;
    cantidad: number;
    montoBs: number;
  } | null;
  notaCajero?: string | null;
};

export async function crearCajaSolicitud(
  input: CrearCajaSolicitudInput
): Promise<{ ok: true; id: number } | { ok: false; message: string }> {
  await ensureCajaSolicitudesTable();

  if (input.tipo !== "devolucion" && input.tipo !== "cambio") {
    return { ok: false, message: "Tipo de solicitud no válido." };
  }

  const codDev = input.devuelto.codigo.trim().toUpperCase();
  if (!codDev) return { ok: false, message: "Indicá el producto devuelto." };
  const prodDev = await getProductoVentaCompletoPorCodigo(input.sucursalId, codDev);
  if (!prodDev) {
    return { ok: false, message: "Producto devuelto no encontrado o inactivo." };
  }
  const montoDev = round2(Number(input.devuelto.montoBs));
  if (!Number.isFinite(montoDev) || montoDev <= 0) {
    return { ok: false, message: "El monto devuelto debe ser mayor a 0." };
  }
  const cantDev = Math.max(1, Math.trunc(Number(input.devuelto.cantidad)));

  let codEnt: string | null = null;
  let nomEnt: string | null = null;
  let cantEnt: number | null = null;
  let montoEnt: number | null = null;

  if (input.tipo === "cambio") {
    const ent = input.entregado;
    if (!ent) return { ok: false, message: "Indicá el producto entregado." };
    codEnt = ent.codigo.trim().toUpperCase();
    if (!codEnt) return { ok: false, message: "Indicá el código del producto entregado." };
    if (codEnt === codDev) {
      return { ok: false, message: "El producto devuelto y el entregado deben ser distintos." };
    }
    montoEnt = round2(Number(ent.montoBs));
    if (!Number.isFinite(montoEnt) || montoEnt <= 0) {
      return { ok: false, message: "El monto del producto entregado debe ser mayor a 0." };
    }
    cantEnt = Math.max(1, Math.trunc(Number(ent.cantidad)));
    nomEnt = ent.nombre?.trim() || null;
    const prodEnt = await getProductoVentaCompletoPorCodigo(input.sucursalId, codEnt);
    if (!prodEnt) {
      return { ok: false, message: "Producto entregado no encontrado o inactivo." };
    }
    if (prodEnt.stockMiSucursal < cantEnt) {
      return {
        ok: false,
        message: `Stock insuficiente para ${codEnt} (disponible: ${prodEnt.stockMiSucursal}).`,
      };
    }
  }

  const fecha = formatDateTimeMysqlBolivia(new Date());
  const [res] = await pool.execute<ResultSetHeader>(
    `INSERT INTO caja_solicitudes (
       sucursal_id, cajero_usuario_id, tipo, estado,
       codigo_devuelto, nombre_devuelto, cantidad_devuelta, monto_devuelto_bs,
       codigo_entregado, nombre_entregado, cantidad_entregada, monto_entregado_bs,
       nota_cajero, fecha_solicitud
     ) VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sucursalId,
      input.cajeroUsuarioId,
      input.tipo,
      codDev,
      input.devuelto.nombre?.trim() || prodDev.nombre || null,
      cantDev,
      montoDev,
      codEnt,
      nomEnt,
      cantEnt,
      montoEnt,
      input.notaCajero?.trim() || null,
      fecha,
    ]
  );

  return { ok: true, id: Number(res.insertId) };
}

export async function listCajaSolicitudesSucursalDia(
  sucursalId: number,
  fecha: string
): Promise<CajaSolicitudRow[]> {
  await ensureCajaSolicitudesTable();
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return [];

  const [rows] = await pool.execute<RowDataPacket[]>(
    `${SELECT_SOLICITUD}
     WHERE s.sucursal_id = ? AND DATE(s.fecha_solicitud) = ?
     ORDER BY s.fecha_solicitud DESC, s.id DESC`,
    [sucursalId, f]
  );
  return (rows as RowDataPacket[]).map(mapSolicitudRow);
}

export async function listCajaSolicitudesAdmin(opts?: {
  estado?: CajaSolicitudEstado | "todas";
  limit?: number;
}): Promise<CajaSolicitudRow[]> {
  await ensureCajaSolicitudesTable();
  const lim = Math.min(Math.max(1, Math.trunc(opts?.limit ?? 200)), 500);
  const estado = opts?.estado ?? "pendiente";

  const where =
    estado === "todas" ? "" : `WHERE s.estado = ?`;
  const params = estado === "todas" ? [] : [estado];

  const [rows] = await pool.execute<RowDataPacket[]>(
    `${SELECT_SOLICITUD}
     ${where}
     ORDER BY
       CASE s.estado WHEN 'pendiente' THEN 0 WHEN 'aprobada' THEN 1 ELSE 2 END,
       s.fecha_solicitud DESC
     LIMIT ${lim}`,
    params
  );
  return (rows as RowDataPacket[]).map(mapSolicitudRow);
}

export type ListCajaSolicitudesHistorialOpts = {
  fechaDesde: string;
  fechaHasta: string;
  sucursalId?: number | null;
  estado?: CajaSolicitudEstado | "todas";
  tipo?: CajaSolicitudTipo | "todos";
  limit?: number;
};

export type CajaSolicitudesHistorialResumen = {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  registradas: number;
  montoDevueltoRegistradasBs: number;
};

function buildHistorialWhere(opts: ListCajaSolicitudesHistorialOpts): {
  clauses: string[];
  params: (string | number)[];
} {
  const clauses: string[] = [
    "s.fecha_solicitud >= ?",
    "s.fecha_solicitud < DATE_ADD(?, INTERVAL 1 DAY)",
  ];
  const params: (string | number)[] = [
    `${opts.fechaDesde.trim()} 00:00:00`,
    `${opts.fechaHasta.trim()} 00:00:00`,
  ];

  if (opts.sucursalId != null && Number.isFinite(opts.sucursalId) && opts.sucursalId > 0) {
    clauses.push("s.sucursal_id = ?");
    params.push(opts.sucursalId);
  }
  if (opts.estado && opts.estado !== "todas") {
    clauses.push("s.estado = ?");
    params.push(opts.estado);
  }
  if (opts.tipo && opts.tipo !== "todos") {
    clauses.push("s.tipo = ?");
    params.push(opts.tipo);
  }

  return { clauses, params };
}

export async function listCajaSolicitudesHistorialAdmin(
  opts: ListCajaSolicitudesHistorialOpts
): Promise<CajaSolicitudRow[]> {
  await ensureCajaSolicitudesTable();
  const lim = Math.min(Math.max(1, Math.trunc(opts.limit ?? 500)), 1000);
  const { clauses, params } = buildHistorialWhere(opts);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `${SELECT_SOLICITUD}
     WHERE ${clauses.join(" AND ")}
     ORDER BY s.fecha_solicitud DESC, s.id DESC
     LIMIT ${lim}`,
    params
  );
  return (rows as RowDataPacket[]).map(mapSolicitudRow);
}

export async function resumenCajaSolicitudesHistorialAdmin(
  opts: Omit<ListCajaSolicitudesHistorialOpts, "limit">
): Promise<CajaSolicitudesHistorialResumen> {
  await ensureCajaSolicitudesTable();
  const { clauses, params } = buildHistorialWhere(opts);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN s.estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
       SUM(CASE WHEN s.estado = 'aprobada' THEN 1 ELSE 0 END) AS aprobadas,
       SUM(CASE WHEN s.estado = 'rechazada' THEN 1 ELSE 0 END) AS rechazadas,
       SUM(CASE WHEN s.estado = 'registrada' THEN 1 ELSE 0 END) AS registradas,
       SUM(CASE WHEN s.estado = 'registrada' THEN s.monto_devuelto_bs ELSE 0 END) AS monto_devuelto_registradas
     FROM caja_solicitudes s
     WHERE ${clauses.join(" AND ")}`,
    params
  );
  const r = rows[0] as RowDataPacket | undefined;
  return {
    total: Number(r?.total ?? 0),
    pendientes: Number(r?.pendientes ?? 0),
    aprobadas: Number(r?.aprobadas ?? 0),
    rechazadas: Number(r?.rechazadas ?? 0),
    registradas: Number(r?.registradas ?? 0),
    montoDevueltoRegistradasBs: round2(Number(r?.monto_devuelto_registradas ?? 0)),
  };
}

export async function countCajaSolicitudesPendientes(): Promise<number> {
  await ensureCajaSolicitudesTable();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM caja_solicitudes WHERE estado = 'pendiente'`
  );
  return Number((rows[0] as RowDataPacket | undefined)?.n ?? 0);
}

export async function getCajaSolicitud(
  id: number,
  sucursalId?: number
): Promise<CajaSolicitudRow | null> {
  await ensureCajaSolicitudesTable();
  if (!Number.isFinite(id) || id < 1) return null;

  const params: (number | string)[] = [id];
  let extra = "";
  if (sucursalId != null && Number.isFinite(sucursalId) && sucursalId > 0) {
    extra = " AND s.sucursal_id = ?";
    params.push(sucursalId);
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `${SELECT_SOLICITUD} WHERE s.id = ?${extra} LIMIT 1`,
    params
  );
  const r = rows[0] as RowDataPacket | undefined;
  return r ? mapSolicitudRow(r) : null;
}

export async function resolverCajaSolicitud(
  id: number,
  adminUsuarioId: number,
  aprobar: boolean,
  notaAdmin?: string | null
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureCajaSolicitudesTable();
  const sol = await getCajaSolicitud(id);
  if (!sol) return { ok: false, message: "Solicitud no encontrada." };
  if (sol.estado !== "pendiente") {
    return { ok: false, message: "Esta solicitud ya fue resuelta." };
  }

  if (aprobar && sol.tipo === "cambio" && sol.codigoEntregado) {
    const prodEnt = await getProductoVentaCompletoPorCodigo(sol.sucursalId, sol.codigoEntregado);
    const cantEnt = sol.cantidadEntregada ?? 1;
    if (!prodEnt) {
      return { ok: false, message: "Producto entregado no encontrado o inactivo." };
    }
    if (prodEnt.stockMiSucursal < cantEnt) {
      return {
        ok: false,
        message: `Sin stock suficiente para aprobar (${sol.codigoEntregado}: ${prodEnt.stockMiSucursal} disponible).`,
      };
    }
  }

  const estado: CajaSolicitudEstado = aprobar ? "aprobada" : "rechazada";
  const fecha = formatDateTimeMysqlBolivia(new Date());

  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE caja_solicitudes
     SET estado = ?, nota_admin = ?, admin_usuario_id = ?, fecha_resolucion = ?
     WHERE id = ? AND estado = 'pendiente'`,
    [estado, notaAdmin?.trim() || null, adminUsuarioId, fecha, id]
  );
  if (res.affectedRows < 1) {
    return { ok: false, message: "No se pudo actualizar la solicitud." };
  }
  return { ok: true };
}

export async function registrarCajaSolicitudEnCaja(
  id: number,
  sucursalId: number,
  cajeroUsuarioId: number
): Promise<
  | { ok: true; movimientoEgresoId: number; movimientoIngresoId: number | null }
  | { ok: false; message: string }
> {
  const sol = await getCajaSolicitud(id, sucursalId);
  if (!sol) return { ok: false, message: "Solicitud no encontrada en tu sucursal." };
  if (sol.cajeroUsuarioId !== cajeroUsuarioId) {
    return { ok: false, message: "Solo el cajero que creó la solicitud puede registrarla." };
  }
  if (sol.estado === "registrada") {
    return { ok: false, message: "Esta solicitud ya fue registrada en caja." };
  }
  if (sol.estado === "pendiente") {
    return { ok: false, message: "La solicitud aún está pendiente de aprobación del administrador." };
  }
  if (sol.estado === "rechazada") {
    return { ok: false, message: "La solicitud fue rechazada. No se puede registrar en caja." };
  }
  if (sol.estado !== "aprobada") {
    return { ok: false, message: "Estado de solicitud no válido para registrar." };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [lockRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, tipo, estado, codigo_devuelto, nombre_devuelto, cantidad_devuelta, monto_devuelto_bs,
              codigo_entregado, nombre_entregado, cantidad_entregada, monto_entregado_bs, nota_cajero
       FROM caja_solicitudes
       WHERE id = ? AND sucursal_id = ? AND cajero_usuario_id = ?
       FOR UPDATE`,
      [id, sucursalId, cajeroUsuarioId]
    );
    const locked = lockRows[0] as RowDataPacket | undefined;
    if (!locked || String(locked.estado) !== "aprobada") {
      await conn.rollback();
      return { ok: false, message: "Esta solicitud ya fue registrada o no está aprobada." };
    }

    const fecha = formatDateTimeMysqlBolivia(new Date());

    if (String(locked.tipo) === "devolucion") {
      const r = await registrarDevolucionCaja(
        {
          sucursalId,
          usuarioId: cajeroUsuarioId,
          codigo: String(locked.codigo_devuelto ?? ""),
          cantidad: Number(locked.cantidad_devuelta ?? 1),
          montoBs: Number(locked.monto_devuelto_bs ?? 0),
          nombre:
            locked.nombre_devuelto != null ? String(locked.nombre_devuelto) : null,
          nota: locked.nota_cajero != null ? String(locked.nota_cajero) : null,
          solicitudId: id,
        },
        conn
      );
      if (!r.ok) {
        await conn.rollback();
        return r;
      }

      const [res] = await conn.execute<ResultSetHeader>(
        `UPDATE caja_solicitudes
         SET estado = 'registrada', movimiento_egreso_id = ?, fecha_registro = ?
         WHERE id = ? AND estado = 'aprobada'`,
        [r.id, fecha, id]
      );
      if (res.affectedRows < 1) {
        await conn.rollback();
        return { ok: false, message: "Esta solicitud ya fue registrada en caja." };
      }

      await conn.commit();
      return { ok: true, movimientoEgresoId: r.id, movimientoIngresoId: null };
    }

    if (!locked.codigo_entregado || locked.monto_entregado_bs == null) {
      await conn.rollback();
      return { ok: false, message: "Datos incompletos para el cambio." };
    }

    const r = await registrarCambioCaja(
      {
        sucursalId,
        usuarioId: cajeroUsuarioId,
        devuelto: {
          codigo: String(locked.codigo_devuelto ?? ""),
          cantidad: Number(locked.cantidad_devuelta ?? 1),
          montoBs: Number(locked.monto_devuelto_bs ?? 0),
          nombre:
            locked.nombre_devuelto != null ? String(locked.nombre_devuelto) : null,
        },
        entregado: {
          codigo: String(locked.codigo_entregado ?? ""),
          cantidad: Number(locked.cantidad_entregada ?? 1),
          montoBs: Number(locked.monto_entregado_bs ?? 0),
          nombre:
            locked.nombre_entregado != null ? String(locked.nombre_entregado) : null,
        },
        nota: locked.nota_cajero != null ? String(locked.nota_cajero) : null,
        solicitudId: id,
      },
      conn
    );
    if (!r.ok) {
      await conn.rollback();
      return r;
    }

    const [res] = await conn.execute<ResultSetHeader>(
      `UPDATE caja_solicitudes
       SET estado = 'registrada', movimiento_egreso_id = ?, movimiento_ingreso_id = ?, fecha_registro = ?
       WHERE id = ? AND estado = 'aprobada'`,
      [r.ids[0], r.ids[1], fecha, id]
    );
    if (res.affectedRows < 1) {
      await conn.rollback();
      return { ok: false, message: "Esta solicitud ya fue registrada en caja." };
    }

    await conn.commit();
    return { ok: true, movimientoEgresoId: r.ids[0], movimientoIngresoId: r.ids[1] };
  } catch {
    await conn.rollback();
    return { ok: false, message: "No se pudo registrar en caja. Intentá de nuevo." };
  } finally {
    conn.release();
  }
}

/** Vista previa del detalle (sin guardar movimiento). */
export function previewDetalleSolicitud(sol: CajaSolicitudRow): {
  egreso: string;
  ingreso: string | null;
} {
  const egreso = detalleTextoDevolucion({
    codigo: sol.codigoDevuelto,
    cantidad: sol.cantidadDevuelta,
    codigoCambioCon: sol.tipo === "cambio" ? sol.codigoEntregado : null,
    nombre: sol.nombreDevuelto,
  });
  const ingreso =
    sol.tipo === "cambio" && sol.codigoEntregado
      ? detalleTextoCambioEntregado(sol.codigoEntregado, sol.nombreEntregado)
      : null;
  return { egreso, ingreso };
}
