import "server-only";

import { getCliente } from "@/lib/data/clientes";
import { pool } from "@/lib/db";
import { formatDateTimeMysqlBolivia, mysqlValueToIsoDateOnly, parseIsoDateOnly } from "@/lib/fecha-bolivia";
import { withBoliviaMysqlSession } from "@/lib/mysql-bolivia-session";
import type { TipoPagoVenta } from "@/lib/data/ventas-vendedor";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

let creditosSchemaReady = false;
let creditosMigrateDone = false;
let creditosSchemaEnsurePromise: Promise<void> | null = null;

async function runCreditosSchemaEnsure(): Promise<void> {
  if (!creditosSchemaReady) {
    const alters = [
      `CREATE TABLE IF NOT EXISTS creditos (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      venta_id INT UNSIGNED NOT NULL,
      cliente_id INT UNSIGNED NOT NULL,
      sucursal_id INT UNSIGNED NOT NULL,
      monto_total_bs DECIMAL(18,2) NOT NULL,
      saldo_pendiente_bs DECIMAL(18,2) NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_limite DATE NOT NULL,
      estado ENUM('pendiente','pagado','vencido') NOT NULL DEFAULT 'pendiente',
      entregado_en DATETIME NOT NULL,
      observacion VARCHAR(255) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_credito_venta (venta_id),
      KEY idx_credito_cliente (cliente_id, estado),
      KEY idx_credito_limite (fecha_limite, estado),
      KEY idx_credito_sucursal (sucursal_id, estado)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `CREATE TABLE IF NOT EXISTS pagos_credito (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      credito_id INT UNSIGNED NOT NULL,
      monto_bs DECIMAL(18,2) NOT NULL,
      tipo_pago ENUM('efectivo','qr','tarjeta') NOT NULL,
      cajero_usuario_id INT UNSIGNED NOT NULL,
      fecha DATETIME NOT NULL,
      nota VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_pago_credito (credito_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ];

    for (const sql of alters) {
      await pool.execute(sql);
    }

    try {
      await pool.execute(
        `ALTER TABLE clientes ADD COLUMN bloqueado_credito TINYINT(1) NOT NULL DEFAULT 0`
      );
    } catch (err: unknown) {
      const e = err as { errno?: number };
      if (e.errno !== 1060) throw err;
    }

    creditosSchemaReady = true;
  }

  if (!creditosMigrateDone) {
    await migrateCreditosColumns();
    creditosMigrateDone = true;
  }
}

async function tryAlterCreditos(sql: string): Promise<void> {
  try {
    await pool.execute(sql);
  } catch (err: unknown) {
    const e = err as { errno?: number };
    if (e.errno !== 1060) throw err;
  }
}

/** Completa columnas de tablas `creditos` / `pagos_credito` creadas con esquema anterior. */
async function migrateCreditosColumns(): Promise<void> {
  await tryAlterCreditos(
    `ALTER TABLE creditos ADD COLUMN cliente_id INT UNSIGNED NULL AFTER venta_id`
  );
  await tryAlterCreditos(
    `ALTER TABLE creditos ADD COLUMN sucursal_id INT UNSIGNED NULL AFTER cliente_id`
  );
  await tryAlterCreditos(
    `ALTER TABLE creditos ADD COLUMN entregado_en DATETIME NULL AFTER estado`
  );
  await tryAlterCreditos(
    `ALTER TABLE creditos ADD COLUMN observacion VARCHAR(255) NULL AFTER entregado_en`
  );

  try {
    await pool.execute(
      `ALTER TABLE creditos MODIFY COLUMN estado ENUM('pendiente','pagado','vencido') NOT NULL DEFAULT 'pendiente'`
    );
  } catch (err: unknown) {
    const e = err as { errno?: number };
    if (e.errno !== 1054 && e.errno !== 1265) throw err;
  }

  await pool.execute(
    `UPDATE creditos cr
     INNER JOIN ventas v ON v.id = cr.venta_id
     SET cr.cliente_id = COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id),
         cr.sucursal_id = COALESCE(NULLIF(cr.sucursal_id, 0), v.sucursal_id)
     WHERE cr.cliente_id IS NULL OR cr.cliente_id = 0 OR cr.sucursal_id IS NULL OR cr.sucursal_id = 0`
  );

  await pool.execute(
    `UPDATE creditos
     SET entregado_en = CONCAT(fecha_inicio, ' 12:00:00')
     WHERE entregado_en IS NULL AND fecha_inicio IS NOT NULL`
  );

  await tryAlterCreditos(
    `ALTER TABLE pagos_credito ADD COLUMN tipo_pago ENUM('efectivo','qr','tarjeta') NOT NULL DEFAULT 'efectivo' AFTER monto_bs`
  );
  await tryAlterCreditos(
    `ALTER TABLE pagos_credito ADD COLUMN cajero_usuario_id INT UNSIGNED NULL AFTER tipo_pago`
  );
  await tryAlterCreditos(
    `ALTER TABLE pagos_credito ADD COLUMN fecha DATETIME NULL AFTER cajero_usuario_id`
  );
  await tryAlterCreditos(
    `ALTER TABLE pagos_credito ADD COLUMN nota VARCHAR(255) NULL AFTER fecha`
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function addMesCalendario(iso: string): string {
  const p = parseIsoDateOnly(iso);
  if (!p) return iso;
  const [y, m, d] = p.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export async function ensureCreditosSchema(): Promise<void> {
  if (creditosSchemaReady && creditosMigrateDone) return;

  if (!creditosSchemaEnsurePromise) {
    creditosSchemaEnsurePromise = runCreditosSchemaEnsure().finally(() => {
      creditosSchemaEnsurePromise = null;
    });
  }

  await creditosSchemaEnsurePromise;
}

/** Marca vencidos y bloquea clientes con saldo pendiente pasado el plazo. */
export async function sincronizarCreditosVencidosYBloqueos(): Promise<void> {
  await ensureCreditosSchema();
  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);

  await pool.execute(
    `UPDATE creditos SET estado = 'vencido'
     WHERE estado = 'pendiente' AND saldo_pendiente_bs > 0 AND fecha_limite < ?`,
    [hoy]
  );

  await pool.execute(
    `UPDATE clientes c
     INNER JOIN (
       SELECT DISTINCT COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id) AS cliente_id
       FROM creditos cr
       INNER JOIN ventas v ON v.id = cr.venta_id
       WHERE cr.estado IN ('pendiente','vencido')
         AND cr.saldo_pendiente_bs > 0
         AND cr.fecha_limite < ?
         AND COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id) IS NOT NULL
     ) v ON v.cliente_id = c.id
     SET c.activo = 0, c.bloqueado_credito = 1`,
    [hoy]
  );
}

export async function assertClientePuedeRecibirCredito(
  clienteId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  await sincronizarCreditosVencidosYBloqueos();
  const cli = await getCliente(clienteId);
  if (!cli) return { ok: false, message: "Cliente no encontrado." };
  if (cli.activo !== 1) {
    if (cli.bloqueado_credito === 1) {
      return {
        ok: false,
        message: "Cliente bloqueado por crédito vencido. Debe regularizar el pago con caja o pedir al administrador que lo reactive.",
      };
    }
    return { ok: false, message: "Cliente inactivo." };
  }
  return { ok: true };
}

export type CreditoPendienteCobroRow = {
  creditoId: number;
  ventaId: number;
  numeroDocumento: string | null;
  clienteId: number;
  clienteNombre: string;
  vendedorNombre: string;
  fechaEntrega: string;
  fechaLimite: string;
  montoTotalBs: number;
  saldoPendienteBs: number;
  estado: "pendiente" | "vencido" | "pagado";
  diasVencido: number;
};

export async function listCreditosPendientesSucursal(
  sucursalId: number,
  opts?: { soloVencidos?: boolean; clienteId?: number | null }
): Promise<CreditoPendienteCobroRow[]> {
  await ensureCreditosSchema();
  await sincronizarCreditosVencidosYBloqueos();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];

  const hoy = formatDateTimeMysqlBolivia(new Date()).slice(0, 10);
  const extra = opts?.soloVencidos ? "AND cr.fecha_limite < ?" : "";
  const clienteId =
    opts?.clienteId != null && Number.isFinite(opts.clienteId) && opts.clienteId > 0
      ? Math.trunc(opts.clienteId)
      : null;
  const clienteClause = clienteId != null ? "AND c.id = ?" : "";
  const params: (string | number)[] = [sucursalId];
  if (opts?.soloVencidos) params.push(hoy);
  if (clienteId != null) params.push(clienteId);

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT cr.id AS credito_id,
            cr.venta_id,
            v.numero_documento,
            cr.cliente_id,
            c.nombre AS cliente_nombre,
            u.nombre_completo AS vendedor_nombre,
            cr.entregado_en,
            cr.fecha_limite,
            cr.monto_total_bs,
            cr.saldo_pendiente_bs,
            cr.estado
     FROM creditos cr
     INNER JOIN ventas v ON v.id = cr.venta_id
     INNER JOIN clientes c ON c.id = COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id)
     INNER JOIN usuarios u ON u.id = v.usuario_id
     WHERE COALESCE(NULLIF(cr.sucursal_id, 0), v.sucursal_id) = ?
       AND cr.saldo_pendiente_bs > 0
       AND cr.estado IN ('pendiente','vencido')
       ${extra}
       ${clienteClause}
     ORDER BY cr.fecha_limite ASC, cr.id ASC`,
    params
  );

  return (rows as RowDataPacket[]).map((r) => {
    const lim = String(r.fecha_limite ?? "").slice(0, 10);
    const diasVencido =
      lim && lim < hoy ? Math.floor((Date.parse(hoy) - Date.parse(lim)) / 86400000) : 0;
    return {
      creditoId: Number(r.credito_id),
      ventaId: Number(r.venta_id),
      numeroDocumento:
        r.numero_documento != null && String(r.numero_documento).trim() !== ""
          ? String(r.numero_documento).trim()
          : null,
      clienteId: Number(r.cliente_id),
      clienteNombre: String(r.cliente_nombre ?? "").trim() || "—",
      vendedorNombre: String(r.vendedor_nombre ?? "").trim() || "—",
      fechaEntrega:
        r.entregado_en instanceof Date
          ? formatDateTimeMysqlBolivia(r.entregado_en)
          : String(r.entregado_en ?? ""),
      fechaLimite: lim,
      montoTotalBs: round2(Number(r.monto_total_bs ?? 0)),
      saldoPendienteBs: round2(Number(r.saldo_pendiente_bs ?? 0)),
      estado: String(r.estado ?? "pendiente") as CreditoPendienteCobroRow["estado"],
      diasVencido,
    };
  });
}

export type ClienteCreditoPendienteBusquedaRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  carnet_identidad: string | null;
  creditosPendientes: number;
};

/** Clientes con créditos pendientes de cobro en la sucursal (incluye vencidos/bloqueados). */
export async function buscarClientesCreditosPendientesSucursal(
  sucursalId: number,
  q: string,
  limit = 25
): Promise<ClienteCreditoPendienteBusquedaRow[]> {
  await ensureCreditosSchema();
  await sincronizarCreditosVencidosYBloqueos();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];

  const term = q.trim();
  const max = Math.min(Math.max(Math.trunc(limit) || 25, 1), 100);
  const params: (string | number)[] = [sucursalId];
  let filtro = "";

  if (term) {
    const like = `%${term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    filtro = `AND (c.nombre LIKE ? OR IFNULL(c.telefono, '') LIKE ? OR IFNULL(c.carnet_identidad, '') LIKE ?)`;
    params.push(like, like, like);
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id,
            c.nombre,
            c.telefono,
            c.carnet_identidad,
            COUNT(cr.id) AS creditos_pendientes
     FROM creditos cr
     INNER JOIN ventas v ON v.id = cr.venta_id
     INNER JOIN clientes c ON c.id = COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id)
     WHERE COALESCE(NULLIF(cr.sucursal_id, 0), v.sucursal_id) = ?
       AND cr.saldo_pendiente_bs > 0
       AND cr.estado IN ('pendiente','vencido')
       ${filtro}
     GROUP BY c.id, c.nombre, c.telefono, c.carnet_identidad
     ORDER BY c.nombre ASC
     LIMIT ${max}`,
    params
  );

  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre ?? "").trim(),
    telefono: r.telefono != null && String(r.telefono).trim() !== "" ? String(r.telefono).trim() : null,
    carnet_identidad:
      r.carnet_identidad != null && String(r.carnet_identidad).trim() !== ""
        ? String(r.carnet_identidad).trim()
        : null,
    creditosPendientes: Number(r.creditos_pendientes ?? 0),
  }));
}

export type CreditoHistorialEstado = "pendiente_caja" | "pendiente" | "vencido" | "pagado";

export type CreditoHistorialRow = {
  creditoId: number | null;
  ventaId: number;
  fechaReferencia: string;
  clienteNombre: string;
  vendedorNombre: string;
  montoTotalBs: number;
  saldoPendienteBs: number;
  fechaLimite: string | null;
  estado: CreditoHistorialEstado;
};

export type CreditoTotalesPorDiaRow = {
  fecha: string;
  cantidad: number;
  totalBs: number;
};

const SQL_VENTA_ES_CREDITO = `(v.tipo_pago = 'credito' OR cr.id IS NOT NULL)`;

function creditoHistorialEstado(r: RowDataPacket): CreditoHistorialEstado {
  if (r.credito_id == null) return "pendiente_caja";
  const saldo = round2(Number(r.saldo_pendiente_bs ?? 0));
  const estado = String(r.estado ?? "pendiente");
  if (estado === "pagado" || saldo <= 0) return "pagado";
  if (estado === "vencido") return "vencido";
  return "pendiente";
}

function mapCreditoHistorialRow(r: RowDataPacket): CreditoHistorialRow {
  const entregado =
    r.entregado_en instanceof Date
      ? formatDateTimeMysqlBolivia(r.entregado_en)
      : r.entregado_en != null
        ? String(r.entregado_en)
        : "";
  const ventaFecha =
    r.venta_fecha instanceof Date
      ? formatDateTimeMysqlBolivia(r.venta_fecha)
      : String(r.venta_fecha ?? "");
  const fechaRef = (entregado || ventaFecha).slice(0, 10);
  const limRaw = r.fecha_limite != null ? String(r.fecha_limite).slice(0, 10) : null;

  return {
    creditoId: r.credito_id != null ? Number(r.credito_id) : null,
    ventaId: Number(r.venta_id),
    fechaReferencia: fechaRef,
    clienteNombre: String(r.cliente_nombre ?? "").trim() || "—",
    vendedorNombre: String(r.vendedor_nombre ?? "").trim() || "—",
    montoTotalBs: round2(Number(r.monto_total_bs ?? r.total_bs ?? 0)),
    saldoPendienteBs: round2(Number(r.saldo_pendiente_bs ?? r.total_bs ?? 0)),
    fechaLimite: limRaw,
    estado: creditoHistorialEstado(r),
  };
}

/** Totales diarios de ventas a crédito (entrega o fecha de venta si aún está en caja). */
export async function listTotalesCreditosPorDiaPorSucursal(
  sucursalId: number,
  fechaDesde: string,
  fechaHasta: string
): Promise<CreditoTotalesPorDiaRow[]> {
  await ensureCreditosSchema();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return [];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DATE(COALESCE(cr.entregado_en, v.fecha)) AS dia,
            COUNT(*) AS n,
            COALESCE(SUM(v.total_bs), 0) AS sum_bs
     FROM ventas v
     LEFT JOIN creditos cr ON cr.venta_id = v.id
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
       AND ${SQL_VENTA_ES_CREDITO}
       AND DATE(COALESCE(cr.entregado_en, v.fecha)) >= ?
       AND DATE(COALESCE(cr.entregado_en, v.fecha)) <= ?
     GROUP BY DATE(COALESCE(cr.entregado_en, v.fecha))
     ORDER BY dia DESC`,
    [sucursalId, d1, d2]
  );

  return (rows as RowDataPacket[]).map((r) => ({
    fecha: mysqlValueToIsoDateOnly(r.dia) ?? "",
    cantidad: Number(r.n),
    totalBs: round2(Number(r.sum_bs ?? 0)),
  })).filter((row) => row.fecha !== "");
}

export async function sumTotalesCreditosPorSucursalEnRango(
  sucursalId: number,
  fechaDesde: string,
  fechaHasta: string
): Promise<{ totalBs: number; cantidad: number }> {
  await ensureCreditosSchema();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) {
    return { totalBs: 0, cantidad: 0 };
  }
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  if (!d1 || !d2) return { totalBs: 0, cantidad: 0 };

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(v.total_bs), 0) AS sum_bs, COUNT(*) AS n
     FROM ventas v
     LEFT JOIN creditos cr ON cr.venta_id = v.id
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
       AND ${SQL_VENTA_ES_CREDITO}
       AND DATE(COALESCE(cr.entregado_en, v.fecha)) >= ?
       AND DATE(COALESCE(cr.entregado_en, v.fecha)) <= ?`,
    [sucursalId, d1, d2]
  );
  const r = rows[0] as { sum_bs: unknown; n: unknown } | undefined;
  if (!r) return { totalBs: 0, cantidad: 0 };
  return { totalBs: round2(Number(r.sum_bs ?? 0)), cantidad: Number(r.n ?? 0) };
}

export async function listCreditosHistorialPorSucursal(
  sucursalId: number,
  limit = 5000,
  opts?: { fechaDesde: string; fechaHasta: string } | null
): Promise<CreditoHistorialRow[]> {
  await ensureCreditosSchema();
  if (!Number.isFinite(sucursalId) || sucursalId < 1) return [];

  const hasFecha =
    opts != null &&
    typeof opts.fechaDesde === "string" &&
    typeof opts.fechaHasta === "string" &&
    opts.fechaDesde.length > 0 &&
    opts.fechaHasta.length > 0;

  const lim = Math.min(Math.max(Math.trunc(limit) || 5000, 1), 5000);
  const dateClause = hasFecha
    ? `AND DATE(COALESCE(cr.entregado_en, v.fecha)) >= ? AND DATE(COALESCE(cr.entregado_en, v.fecha)) <= ?`
    : "";
  const params: (string | number)[] = [sucursalId];
  if (hasFecha) params.push(opts!.fechaDesde, opts!.fechaHasta);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT v.id AS venta_id,
            v.fecha AS venta_fecha,
            v.total_bs,
            cr.id AS credito_id,
            cr.entregado_en,
            cr.fecha_limite,
            cr.monto_total_bs,
            cr.saldo_pendiente_bs,
            cr.estado,
            COALESCE(NULLIF(TRIM(c.nombre), ''), '—') AS cliente_nombre,
            COALESCE(NULLIF(TRIM(u.nombre_completo), ''), u.username, '—') AS vendedor_nombre
     FROM ventas v
     LEFT JOIN creditos cr ON cr.venta_id = v.id
     LEFT JOIN clientes c ON c.id = COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id)
     INNER JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.sucursal_id = ? AND v.estado = 'confirmada'
       AND ${SQL_VENTA_ES_CREDITO}
       ${dateClause}
     ORDER BY COALESCE(cr.entregado_en, v.fecha) DESC, v.id DESC
     LIMIT ${lim}`,
    params
  );

  return (rows as RowDataPacket[]).map(mapCreditoHistorialRow);
}

export type ClienteBloqueadoCreditoRow = {
  id: number;
  nombre: string;
  telefono: string | null;
  carnetIdentidad: string | null;
  saldoVencidoBs: number;
  creditosVencidos: number;
  fechaLimiteMasAntigua: string | null;
};

export async function listClientesBloqueadosPorCredito(): Promise<ClienteBloqueadoCreditoRow[]> {
  await ensureCreditosSchema();
  await sincronizarCreditosVencidosYBloqueos();

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id, c.nombre, c.telefono, c.carnet_identidad,
            COALESCE(SUM(cr.saldo_pendiente_bs), 0) AS saldo_vencido,
            COUNT(cr.id) AS n_creditos,
            MIN(cr.fecha_limite) AS fecha_limite_min
     FROM clientes c
     INNER JOIN creditos cr ON cr.estado IN ('pendiente','vencido')
       AND cr.saldo_pendiente_bs > 0
       AND cr.fecha_limite < ?
     INNER JOIN ventas v ON v.id = cr.venta_id
       AND COALESCE(NULLIF(cr.cliente_id, 0), v.cliente_id) = c.id
     WHERE c.bloqueado_credito = 1 OR c.activo = 0
     GROUP BY c.id, c.nombre, c.telefono, c.carnet_identidad
     HAVING saldo_vencido > 0
     ORDER BY c.nombre ASC`,
    [formatDateTimeMysqlBolivia(new Date()).slice(0, 10)]
  );

  return (rows as RowDataPacket[]).map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre ?? ""),
    telefono: r.telefono != null ? String(r.telefono) : null,
    carnetIdentidad: r.carnet_identidad != null ? String(r.carnet_identidad) : null,
    saldoVencidoBs: round2(Number(r.saldo_vencido ?? 0)),
    creditosVencidos: Number(r.n_creditos ?? 0),
    fechaLimiteMasAntigua:
      r.fecha_limite_min != null ? String(r.fecha_limite_min).slice(0, 10) : null,
  }));
}

export async function reactivarClienteCredito(
  clienteId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureCreditosSchema();
  if (!Number.isFinite(clienteId) || clienteId < 1) {
    return { ok: false, message: "Cliente no válido." };
  }
  const [res] = await pool.execute<ResultSetHeader>(
    `UPDATE clientes SET activo = 1, bloqueado_credito = 0 WHERE id = ?`,
    [clienteId]
  );
  if (res.affectedRows < 1) return { ok: false, message: "Cliente no encontrado." };
  return { ok: true };
}

export type NotaEntregaLinea = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unitario: number;
  total: number;
};

export type NotaEntregaData = {
  numeroDocumento: string;
  fechaDoc: string;
  horaDoc: string;
  clienteNombre: string;
  lineas: NotaEntregaLinea[];
  totalBs: number;
  observacion: string;
  vendedorUsername: string;
  tiendaLabel: string;
};

export async function getNotaEntregaData(
  ventaId: number,
  sucursalId: number
): Promise<NotaEntregaData | null> {
  await ensureCreditosSchema();
  const [vrows] = await pool.execute<RowDataPacket[]>(
    `SELECT v.id, v.numero_documento, v.fecha, v.total_bs,
            COALESCE(NULLIF(TRIM(c.nombre), ''), NULLIF(TRIM(v.cliente_nombre_libre), ''), '—') AS cliente_nombre,
            u.username AS vendedor_username,
            cr.observacion,
            COALESCE(NULLIF(TRIM(s.nombre), ''), '') AS sucursal_nombre
     FROM ventas v
     INNER JOIN usuarios u ON u.id = v.usuario_id
     INNER JOIN sucursales s ON s.id = v.sucursal_id
     LEFT JOIN clientes c ON c.id = v.cliente_id
     LEFT JOIN creditos cr ON cr.venta_id = v.id
     WHERE v.id = ? AND v.sucursal_id = ?
     LIMIT 1`,
    [ventaId, sucursalId]
  );
  const v = vrows[0] as RowDataPacket | undefined;
  if (!v) return null;

  const [lrows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(NULLIF(TRIM(p.codigo), ''), '—') AS codigo,
            COALESCE(NULLIF(TRIM(p.nombre), ''), '—') AS descripcion,
            d.cantidad, d.precio_unitario_bs, d.total_linea_bs
     FROM venta_detalle d
     INNER JOIN productos p ON p.id = d.producto_id
     WHERE d.venta_id = ?
     ORDER BY d.id ASC`,
    [ventaId]
  );

  const fechaRaw =
    v.fecha instanceof Date ? formatDateTimeMysqlBolivia(v.fecha) : String(v.fecha ?? "");
  const fechaDoc = fechaRaw.slice(0, 10);
  const horaDoc = fechaRaw.length >= 19 ? fechaRaw.slice(11, 19) : "";

  const numero =
    v.numero_documento != null && String(v.numero_documento).trim() !== ""
      ? String(v.numero_documento).trim()
      : String(v.id);

  return {
    numeroDocumento: numero,
    fechaDoc,
    horaDoc,
    clienteNombre: String(v.cliente_nombre ?? "—"),
    lineas: (lrows as RowDataPacket[]).map((r) => ({
      codigo: String(r.codigo ?? "—"),
      descripcion: String(r.descripcion ?? "—"),
      cantidad: Number(r.cantidad ?? 0),
      unitario: round2(Number(r.precio_unitario_bs ?? 0)),
      total: round2(Number(r.total_linea_bs ?? 0)),
    })),
    totalBs: round2(Number(v.total_bs ?? 0)),
    observacion: String(v.observacion ?? "").trim(),
    vendedorUsername: String(v.vendedor_username ?? "").trim() || "—",
    tiendaLabel: String(v.sucursal_nombre ?? "").trim(),
  };
}

export type RegistrarEntregaCreditoResult =
  | { ok: true; ventaId: number; creditoId: number; nota: NotaEntregaData }
  | { ok: false; message: string };

export async function registrarEntregaCreditoCajero(input: {
  ventaId: number;
  sucursalId: number;
  cajeroUsuarioId: number;
  observacion?: string | null;
}): Promise<RegistrarEntregaCreditoResult> {
  await ensureCreditosSchema();
  await sincronizarCreditosVencidosYBloqueos();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [vrows] = await conn.execute<RowDataPacket[]>(
      `SELECT v.id, v.cliente_id, v.total_bs, v.tipo_pago, v.estado_cobro, v.numero_documento
       FROM ventas v
       WHERE v.id = ? AND v.sucursal_id = ? AND v.estado = 'confirmada'
       FOR UPDATE`,
      [input.ventaId, input.sucursalId]
    );
    const v = vrows[0] as RowDataPacket | undefined;
    if (!v) {
      await conn.rollback();
      return { ok: false, message: "Venta no encontrada en tu sucursal." };
    }
    if (String(v.tipo_pago) !== "credito") {
      await conn.rollback();
      return { ok: false, message: "Esta venta no es a crédito." };
    }
    if (String(v.estado_cobro) !== "pendiente") {
      await conn.rollback();
      return { ok: false, message: "La venta ya fue entregada o cobrada." };
    }
    const clienteId = Number(v.cliente_id);
    if (!Number.isFinite(clienteId) || clienteId < 1) {
      await conn.rollback();
      return { ok: false, message: "La venta a crédito debe tener cliente registrado." };
    }

    const chkCli = await assertClientePuedeRecibirCredito(clienteId);
    if (!chkCli.ok) {
      await conn.rollback();
      return chkCli;
    }

    const [exist] = await conn.execute<RowDataPacket[]>(
      `SELECT id FROM creditos WHERE venta_id = ? LIMIT 1`,
      [input.ventaId]
    );
    if (exist.length > 0) {
      await conn.rollback();
      return { ok: false, message: "Esta venta ya fue entregada a crédito." };
    }

    const entregadoEn = formatDateTimeMysqlBolivia(new Date());
    const fechaInicio = entregadoEn.slice(0, 10);
    const fechaLimite = addMesCalendario(fechaInicio);
    const totalBs = round2(Number(v.total_bs ?? 0));
    const obs = input.observacion?.trim().slice(0, 255) || null;

    let numeroDoc = v.numero_documento != null ? String(v.numero_documento).trim() : "";
    if (!numeroDoc) {
      numeroDoc = String(input.ventaId);
      await conn.execute(`UPDATE ventas SET numero_documento = ? WHERE id = ?`, [
        numeroDoc,
        input.ventaId,
      ]);
    }

    await conn.execute(
      `UPDATE ventas SET tipo_nota = 'nota_entrega', cajero_cobro_usuario_id = ? WHERE id = ?`,
      [input.cajeroUsuarioId, input.ventaId]
    );

    const [ins] = await conn.execute<ResultSetHeader>(
      `INSERT INTO creditos (
        venta_id, cliente_id, sucursal_id,
        monto_total_bs, saldo_pendiente_bs,
        fecha_inicio, fecha_limite, estado, entregado_en, observacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
      [
        input.ventaId,
        clienteId,
        input.sucursalId,
        totalBs,
        totalBs,
        fechaInicio,
        fechaLimite,
        entregadoEn,
        obs,
      ]
    );

    await conn.commit();

    const nota = await getNotaEntregaData(input.ventaId, input.sucursalId);
    if (!nota) return { ok: false, message: "No se pudo armar la nota de entrega." };

    return { ok: true, ventaId: input.ventaId, creditoId: ins.insertId, nota };
  } catch (e) {
    await conn.rollback();
    console.error("registrarEntregaCreditoCajero", e);
    return { ok: false, message: "No se pudo registrar la entrega a crédito." };
  } finally {
    conn.release();
  }
}

const TIPOS_PAGO_COBRO: TipoPagoVenta[] = ["efectivo", "qr", "tarjeta"];

export function isTipoPagoCobroCredito(s: string): s is "efectivo" | "qr" | "tarjeta" {
  return (TIPOS_PAGO_COBRO as string[]).includes(s);
}

export type RegistrarPagoCreditoResult =
  | { ok: true; creditoId: number; montoBs: number }
  | { ok: false; message: string };

/** Registra el cobro único del crédito (total de la venta, sin abonos parciales). */
export async function registrarPagoCreditoCajero(input: {
  creditoId: number;
  sucursalId: number;
  cajeroUsuarioId: number;
  tipoPago: "efectivo" | "qr" | "tarjeta";
  nota?: string | null;
}): Promise<RegistrarPagoCreditoResult> {
  await ensureCreditosSchema();
  const { ensureVentasCobroCajaColumns } = await import("@/lib/data/ventas-cobro-cajero");
  await ensureVentasCobroCajaColumns();
  if (!isTipoPagoCobroCredito(input.tipoPago)) {
    return { ok: false, message: "Forma de pago inválida." };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT cr.id, cr.venta_id, cr.cliente_id, cr.saldo_pendiente_bs, cr.estado
       FROM creditos cr
       WHERE cr.id = ? AND cr.sucursal_id = ?
       FOR UPDATE`,
      [input.creditoId, input.sucursalId]
    );
    const cr = rows[0] as RowDataPacket | undefined;
    if (!cr) {
      await conn.rollback();
      return { ok: false, message: "Crédito no encontrado en tu sucursal." };
    }
    const monto = round2(Number(cr.saldo_pendiente_bs ?? 0));
    if (monto <= 0 || String(cr.estado) === "pagado") {
      await conn.rollback();
      return { ok: false, message: "Este crédito ya está saldado." };
    }

    const fechaPago = formatDateTimeMysqlBolivia(new Date());
    await conn.execute(
      `INSERT INTO pagos_credito (credito_id, monto_bs, tipo_pago, cajero_usuario_id, fecha, nota)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.creditoId,
        monto,
        input.tipoPago,
        input.cajeroUsuarioId,
        fechaPago,
        input.nota?.trim().slice(0, 255) || null,
      ]
    );

    await conn.execute(
      `UPDATE creditos SET saldo_pendiente_bs = 0, estado = 'pagado' WHERE id = ?`,
      [input.creditoId]
    );

    await conn.execute(
      `UPDATE ventas SET estado_cobro = 'cobrado', tipo_pago = ?, cajero_cobro_usuario_id = ?, fecha_cobro = ?
       WHERE id = ?`,
      [input.tipoPago, input.cajeroUsuarioId, fechaPago, Number(cr.venta_id)]
    );

    const clienteId = Number(cr.cliente_id);
    const hoy = fechaPago.slice(0, 10);
    const [pend] = await conn.execute<RowDataPacket[]>(
      `SELECT COUNT(*) AS n FROM creditos
       WHERE cliente_id = ? AND saldo_pendiente_bs > 0
         AND fecha_limite < ? AND estado IN ('pendiente','vencido')`,
      [clienteId, hoy]
    );
    const nPend = Number((pend[0] as RowDataPacket | undefined)?.n ?? 0);
    if (nPend === 0) {
      await conn.execute(
        `UPDATE clientes SET activo = 1, bloqueado_credito = 0 WHERE id = ?`,
        [clienteId]
      );
    }

    await conn.commit();
    return { ok: true, creditoId: input.creditoId, montoBs: monto };
  } catch (e) {
    await conn.rollback();
    console.error("registrarPagoCreditoCajero", e);
    return { ok: false, message: "No se pudo registrar el pago." };
  } finally {
    conn.release();
  }
}
