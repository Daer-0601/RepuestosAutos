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
