// src/utils/dateTime.js
export const HN_TZ = "America/Tegucigalpa";

/**
 * Convierte timestamps a hora de Honduras.
 * Soporta:
 * - Date (si node-postgres ya devolvió Date)
 * - string ISO con Z (UTC)
 * - string ISO sin Z (lo asumimos UTC y le agregamos Z para evitar desfases)
 */
export function fmtHN(value) {
  if (!value) return "—";

  // Si viene como Date (posible desde backend) lo usamos directo
  if (value instanceof Date) {
    return value.toLocaleString("es-HN", {
      timeZone: HN_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  // Si viene como string sin zona (ej: "2026-02-18T04:28:39")
  // lo tratamos como UTC agregando "Z".
  let v = value;
  if (typeof v === "string") {
    const hasTZ = /Z$|[+-]\d{2}:\d{2}$/.test(v);
    const looksISOWithoutTZ =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(v);

    if (!hasTZ && looksISOWithoutTZ) v = `${v}Z`;
  }

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString("es-HN", {
    timeZone: HN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
