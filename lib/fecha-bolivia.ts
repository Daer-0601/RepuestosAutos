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
