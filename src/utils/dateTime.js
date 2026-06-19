// src/utils/dateTime.js
export const HN_TZ = "America/Tegucigalpa";
const HN_OFFSET = "-06:00"; // Honduras no usa DST actualmente

function normalizeInput(value) {
  if (typeof value !== "string") return value;
  const s = value.trim();

  // "YYYY-MM-DD HH:mm:ss" (sin zona) -> asumir Honduras
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
    return s.replace(" ", "T") + HN_OFFSET;
  }

  // "YYYY-MM-DD" -> asumir medianoche Honduras (evita que JS lo trate como UTC)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return `${s}T00:00:00${HN_OFFSET}`;
  }

  return s;
}

export function fmtHN(value) {
  if (!value) return "—";
  const d = new Date(normalizeInput(value));
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