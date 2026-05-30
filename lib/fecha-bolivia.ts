/** Zona horaria del negocio (Bolivia). La Paz = UTC−4 todo el año. */
export const ZONA_HORARIA_NEGOCIO = "America/La_Paz";

/**
 * Offset fijo para `SET SESSION time_zone` en MySQL sin depender de tablas IANA
 * (`mysql_tzinfo_to_sql`).
 */
export const MYSQL_SESSION_OFFSET = "-04:00";

/** `YYYY-MM-DD HH:mm:ss` en hora Bolivia, para columnas DATETIME/TIMESTAMP en MySQL. */
export function formatDateTimeMysqlBolivia(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

/** Mostrar fecha y hora en listados (SSR o cliente). */
export const formatoMostrarFechaHoraBo: Intl.DateTimeFormatOptions = {
  timeZone: ZONA_HORARIA_NEGOCIO,
  dateStyle: "short",
  timeStyle: "short",
};

/** Solo fecha corta en Bolivia. */
export const formatoMostrarFechaBo: Intl.DateTimeFormatOptions = {
  timeZone: ZONA_HORARIA_NEGOCIO,
  dateStyle: "short",
};

/**
 * Valida `YYYY-MM-DD` (calendario) y devuelve el mismo string o `null`.
 * Útil para query params de filtros por día / rango.
 */
export function parseIsoDateOnly(raw: string | undefined | null): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

/**
 * Normaliza un valor DATE/DATETIME de mysql2 (`Date` o string) a `YYYY-MM-DD`
 * en calendario Bolivia (evita `String(date).slice(0,10)` → "Wed May 28").
 */
export function mysqlValueToIsoDateOnly(raw: unknown): string | null {
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return formatDateTimeMysqlBolivia(raw).slice(0, 10);
  }
  if (typeof raw === "string") {
    const head = raw.trim().slice(0, 10);
    const parsed = parseIsoDateOnly(head);
    if (parsed) return parsed;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return formatDateTimeMysqlBolivia(d).slice(0, 10);
  }
  return null;
}

/**
 * Filtro inclusive por día calendario sobre `ventas.fecha` (DATETIME guardado en hora Bolivia).
 * Usar con `SET time_zone = MYSQL_SESSION_OFFSET` en la misma conexión.
 */
export function ventasRangoFechaSql(
  fechaDesde: string,
  fechaHasta: string,
  alias = "v"
): { clause: string; params: [string, string] } {
  const d1 = fechaDesde.trim();
  const d2 = fechaHasta.trim();
  return {
    clause: `AND ${alias}.fecha >= ? AND ${alias}.fecha < DATE_ADD(?, INTERVAL 1 DAY)`,
    params: [`${d1} 00:00:00`, `${d2} 00:00:00`],
  };
}

/** Muestra una fecha `YYYY-MM-DD` en formato corto Bolivia. */
export function formatIsoDateOnlyBo(iso: string): string {
  const p = parseIsoDateOnly(iso);
  if (!p) return iso;
  const [y, m, d] = p.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("es-BO", formatoMostrarFechaBo);
}
