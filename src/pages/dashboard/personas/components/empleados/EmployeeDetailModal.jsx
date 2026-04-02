import { useEffect, useMemo } from "react";
import brandLogo from "../../../../../assets/images/logo-jonnys.png";
import "./employee-detail-modal.css";

const toDisplayValue = (value, fallback = "-") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatLongDateLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDisplayValue(value);
  return date.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
};

const detectEstado = (record) => {
  if (Object.prototype.hasOwnProperty.call(record || {}, "estado")) return Boolean(record.estado);
  if (Object.prototype.hasOwnProperty.call(record || {}, "activo")) return Boolean(record.activo);
  if (Object.prototype.hasOwnProperty.call(record || {}, "habilitado")) return Boolean(record.habilitado);
  return null;
};

const getFirstNonEmptyField = (record, keys) => {
  if (!record || !Array.isArray(keys)) return "";
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const getFirstNonEmptyValue = (values) => {
  if (!Array.isArray(values)) return "";
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const getDni = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, ["persona_dni", "dni"]),
    getFirstNonEmptyField(empleado?.persona, ["dni", "persona_dni"]),
  ]);

const getTelefono = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "telefono",
      "texto_telefono",
      "telefono_texto",
      "telefono_numero",
      "numero_telefono",
      "persona_telefono",
      "telefono_persona",
      "celular",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "telefono",
      "texto_telefono",
      "telefono_texto",
      "telefono_numero",
      "numero_telefono",
      "persona_telefono",
      "telefono_persona",
      "celular",
    ]),
  ]);

const getCargo = (empleado) =>
  getFirstNonEmptyField(empleado, [
    "cargo",
    "nombre_cargo",
    "cargo_nombre",
    "puesto",
    "rol",
    "cargo_puesto",
    "cargo_descripcion",
  ]);

const getCorreo = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "correo",
      "texto_correo",
      "correo_texto",
      "direccion_correo",
      "email",
      "correo_electronico",
      "persona_correo",
      "correo_persona",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "correo",
      "texto_correo",
      "correo_texto",
      "direccion_correo",
      "email",
      "correo_electronico",
      "persona_correo",
      "correo_persona",
    ]),
  ]);

const getDireccion = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "direccion",
      "texto_direccion",
      "direccion_texto",
      "direccion_persona",
      "persona_direccion",
      "direccion_residencia",
      "direccion_completa",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "direccion",
      "texto_direccion",
      "direccion_texto",
      "direccion_persona",
      "persona_direccion",
      "direccion_residencia",
      "direccion_completa",
    ]),
  ]);

const getNombreReferencia = (empleado) =>
  getFirstNonEmptyField(empleado, ["nombre_referencia", "referencia_nombre", "nombre_contacto_referencia"]);

const getTelefonoReferencia = (empleado) =>
  getFirstNonEmptyField(empleado, ["telefono_referencia", "referencia_telefono", "telefono_contacto_referencia"]);

const getSalario = (empleado) =>
  getFirstNonEmptyField(empleado, ["salario_base", "sueldo", "salario", "salarioBase"]);

const formatSalaryLabel = (value, fallback = "Sin sueldo") => {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatPrintDateLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDisplayValue(value, "-");
  return date.toLocaleDateString("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatPrintDateTime = () =>
  new Date().toLocaleString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const loadImageFromSrc = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar el logo"));
    image.src = src;
  });

const isLightNeutralPixel = (r, g, b, a) => {
  if (a <= 10) return true;
  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const chroma = maxChannel - minChannel;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance >= 172 && chroma <= 22;
};

const buildSheetLogoSrc = async (src) => {
  if (!src || typeof document === "undefined") return src;

  try {
    const image = await loadImageFromSrc(src);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return src;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return src;

    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    const visited = new Uint8Array(width * height);
    const queue = [];

    const pushPixel = (x, y) => {
      const pixelIndex = y * width + x;
      if (visited[pixelIndex]) return;

      const offset = pixelIndex * 4;
      if (!isLightNeutralPixel(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) return;

      visited[pixelIndex] = 1;
      queue.push(pixelIndex);
    };

    for (let x = 0; x < width; x += 1) {
      pushPixel(x, 0);
      pushPixel(x, height - 1);
    }

    for (let y = 1; y < height - 1; y += 1) {
      pushPixel(0, y);
      pushPixel(width - 1, y);
    }

    while (queue.length) {
      const pixelIndex = queue.pop();
      const offset = pixelIndex * 4;
      data[offset + 3] = 0;

      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      if (x > 0) pushPixel(x - 1, y);
      if (x < width - 1) pushPixel(x + 1, y);
      if (y > 0) pushPixel(x, y - 1);
      if (y < height - 1) pushPixel(x, y + 1);
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return src;
  }
};

const renderPrintRows = (rows) =>
  rows
    .map(
      (row) => `
        <div class="detail-row">
          <div class="detail-label">${escapeHtml(row.label)}</div>
          <div class="detail-value ${row.valueClass || ""}">${escapeHtml(row.value)}</div>
        </div>
      `
    )
    .join("");

const buildEmployeePrintTemplate = ({
  logoSrc,
  nombre,
  employeeCode,
  imageSrc,
  fechaImpresion,
  leftRows,
  rightRows,
  intent = "print",
}) => {
  const isPdfIntent = intent === "pdf";
  const sheetIntentTitle = isPdfIntent ? "Exportacion PDF" : "Impresion";
  const sheetIntentHint = isPdfIntent
    ? "Use el dialogo del navegador y seleccione Guardar como PDF."
    : "Documento listo para impresion.";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Detalle de Empleado</title>
    <style>
      :root {
        --ink: #2f1a10;
        --brown: #6d3a26;
        --brown-soft: #8a563a;
        --paper: #f7f4ef;
        --card: #f3efe8;
        --line: #dccfbe;
        --ok: #3f7d35;
        --warn: #8d2d2d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        color: var(--ink);
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .sheet {
        width: calc(210mm - 12mm);
        min-height: calc(297mm - 12mm);
        margin: 0 auto;
        background: var(--paper);
        border: 1px solid #ece4d8;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .header {
        position: relative;
        display: flex;
        align-items: center;
        min-height: 102px;
        padding: 16px 18px 14px 124px;
        background: #fff;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .header::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 25px;
        height: 56px;
        background: linear-gradient(135deg, #4d2214 0%, #7a452c 45%, #5f2c1a 100%);
      }
      .header-logo {
        position: absolute;
        left: 16px;
        top: 23px;
        z-index: 2;
        display: block;
        width: auto;
        height: 56px;
        max-width: 96px;
        max-height: 56px;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        object-fit: contain;
        object-position: center;
      }
      .header-copy {
        position: relative;
        z-index: 2;
        color: #fff;
      }
      .header-copy h1 {
        margin: 0;
        font-size: 31px;
        line-height: 1.1;
        letter-spacing: 0.2px;
      }
      .header-copy p {
        margin: 4px 0 0;
        font-size: 16px;
        opacity: 0.96;
      }
      .content {
        padding: 16px 18px 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
      }
      .eyebrow {
        margin: 0 auto;
        width: 170px;
        text-align: center;
        padding: 6px 12px;
        border-radius: 999px;
        border: 1px solid #d9cdbf;
        background: #f5eee3;
        color: #6e3f29;
        font-weight: 700;
        font-size: 18px;
      }
      .employee-name {
        margin: 2px 0 0;
        text-align: center;
        font-size: 42px;
        line-height: 1.06;
        color: #2f1710;
        font-weight: 800;
      }
      .employee-code {
        margin: 4px auto 0;
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.4px;
        color: #6f4c3b;
      }
      .image-wrap {
        margin: 6px auto 10px;
        width: 170px;
        height: 204px;
        border: 1.5px dashed #d7c9b7;
        border-radius: 14px;
        background: #fcfaf6;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .image-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .image-placeholder {
        text-align: center;
        color: #8b6c5a;
        font-size: 13px;
      }
      .image-placeholder strong {
        display: block;
        margin-top: 4px;
        font-size: 20px;
      }
      .separator {
        width: 360px;
        max-width: 100%;
        height: 2px;
        margin: 0 auto 10px;
        background: linear-gradient(90deg, transparent 0%, #9f5d3d 20%, #9f5d3d 80%, transparent 100%);
      }
      .intent-badge {
        margin: -2px auto 8px;
        max-width: 86%;
        text-align: center;
        font-size: 12px;
        line-height: 1.35;
        color: #5f4334;
        background: #f0e5d8;
        border: 1px solid #dbc9b6;
        border-radius: 10px;
        padding: 6px 10px;
      }
      .intent-badge strong {
        font-weight: 800;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .column {
        background: var(--card);
        border: 1px solid #eadfce;
        border-radius: 12px;
        padding: 6px 12px;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .detail-row {
        padding: 8px 0;
        border-bottom: 1px solid var(--line);
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .detail-row:last-child { border-bottom: none; }
      .detail-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--brown);
        font-weight: 700;
        margin-bottom: 2px;
      }
      .detail-value {
        font-size: 16px;
        font-weight: 600;
        color: #2f1a10;
      }
      .detail-value.state-active { color: var(--ok); }
      .detail-value.state-inactive { color: var(--warn); }
      .footer {
        margin-top: auto;
        background: #f2ece3;
        border: 1px solid #e7dbc9;
        border-radius: 12px;
        padding: 10px 14px;
        break-inside: avoid-page;
        page-break-inside: avoid;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 10px;
      }
      .sign-item h3 {
        margin: 0 0 7px;
        font-size: 14px;
        color: #3b2318;
      }
      .sign-line {
        border-bottom: 1.5px dashed #bda690;
        height: 16px;
      }
      .meta {
        border-top: 1px solid #d8c8b4;
        padding-top: 8px;
        font-size: 12px;
        line-height: 1.3;
        color: #5b4337;
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .meta span:last-child { white-space: nowrap; }
      @page {
        size: A4;
        margin: 6mm;
      }
      @media print {
        html, body {
          width: 210mm;
          height: 297mm;
          margin: 0;
          background: #fff;
        }
        .sheet {
          width: calc(210mm - 12mm);
          min-height: calc(297mm - 12mm);
          height: calc(297mm - 12mm);
          border: none;
          margin: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="header">
        ${logoSrc ? `<img class="header-logo" src="${escapeHtml(logoSrc)}" alt="Jonny's SmartOrder" />` : ""}
        <div class="header-copy">
          <h1>Detalle de Empleado</h1>
          <p>Informacion completa del colaborador</p>
        </div>
      </header>
      <section class="content">
        <div class="eyebrow">Empleado</div>
        <h2 class="employee-name">${escapeHtml(nombre)}</h2>
        <p class="employee-code">${escapeHtml(employeeCode)}</p>
        <div class="image-wrap">
          ${
            imageSrc
              ? `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(nombre)}" />`
              : `<div class="image-placeholder"><span>Sin imagen</span><strong>Sin imagen</strong></div>`
          }
        </div>
        <div class="separator"></div>
        <div class="intent-badge"><strong>${escapeHtml(sheetIntentTitle)}:</strong> ${escapeHtml(sheetIntentHint)}</div>
        <section class="grid" aria-label="Datos del empleado">
          <div class="column">${renderPrintRows(leftRows)}</div>
          <div class="column">${renderPrintRows(rightRows)}</div>
        </section>
        <footer class="footer">
          <div class="signatures">
            <div class="sign-item">
              <h3>Firma del responsable</h3>
              <div class="sign-line"></div>
            </div>
            <div class="sign-item">
              <h3>Firma del empleado</h3>
              <div class="sign-line"></div>
            </div>
          </div>
          <div class="meta">
            <span><strong>Jonny's SmartOrder</strong> - Documento generado por el sistema.</span>
            <span><strong>Fecha de impresion:</strong> ${escapeHtml(fechaImpresion)}</span>
          </div>
        </footer>
      </section>
    </main>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 220);
      });
      window.onafterprint = function () {
        ${isPdfIntent ? "" : "window.close();"}
      };
    </script>
  </body>
</html>`;
};

export default function EmployeeDetailModal({
  open = false,
  empleado = null,
  onClose,
  getPersonaNombre,
  getSucursalNombre,
  getImageSrc,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape" && typeof onClose === "function") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const personaNombre =
    typeof getPersonaNombre === "function"
      ? toDisplayValue(getPersonaNombre(empleado), "Empleado sin nombre")
      : toDisplayValue(
          `${empleado?.persona_nombre || ""} ${empleado?.persona_apellido || ""}`.trim(),
          "Empleado sin nombre"
        );

  const sucursalNombre =
    typeof getSucursalNombre === "function"
      ? toDisplayValue(getSucursalNombre(empleado))
      : toDisplayValue(empleado?.sucursal_nombre ?? empleado?.nombre_sucursal ?? empleado?.sucursal);

  const imageSrc = typeof getImageSrc === "function" ? toDisplayValue(getImageSrc(empleado), "") : "";
  const estadoValue = detectEstado(empleado);

  const openFichaWindow = async (intent = "print") => {
    if (!empleado) return;
    const safeNombre = toDisplayValue(personaNombre, "Empleado sin nombre");
    const safeCode = `EMP-${String(empleado?.id_empleado ?? "-")}`;
    const safeSucursal = toDisplayValue(sucursalNombre, "Sin sucursal");
    const safeDni = toDisplayValue(getDni(empleado), "Sin DNI");
    const safeTelefono = toDisplayValue(getTelefono(empleado), "Sin telefono");
    const safeCargo = toDisplayValue(getCargo(empleado), "Sin cargo");
    const safeSalario = formatSalaryLabel(getSalario(empleado), "Sin sueldo");
    const safeCorreo = toDisplayValue(getCorreo(empleado), "Sin correo");
    const safeDireccion = toDisplayValue(getDireccion(empleado), "Sin direccion");
    const safeNombreRef = toDisplayValue(getNombreReferencia(empleado), "Sin referencia");
    const safeTelRef = toDisplayValue(getTelefonoReferencia(empleado), "Sin referencia");
    const safeEstado = estadoValue === null ? "No definido" : estadoValue ? "Activo" : "Inactivo";
    const safeFechaIngreso = formatPrintDateLabel(empleado?.fecha_ingreso);
    const safeFechaImpresion = formatPrintDateTime();

    const leftRows = [
      { label: "Codigo de empleado", value: safeCode },
      { label: "Nombre completo", value: safeNombre },
      { label: "Sucursal", value: safeSucursal },
      { label: "DNI", value: safeDni },
      { label: "Cargo / Puesto", value: safeCargo },
      { label: "Sueldo", value: safeSalario },
      { label: "Fecha de ingreso", value: safeFechaIngreso },
    ];

    const rightRows = [
      { label: "Telefono", value: safeTelefono },
      { label: "Correo", value: safeCorreo },
      { label: "Direccion", value: safeDireccion },
      {
        label: "Estado",
        value: safeEstado,
        valueClass: safeEstado === "Activo" ? "state-active" : safeEstado === "Inactivo" ? "state-inactive" : "",
      },
      { label: "Nombre referencia", value: safeNombreRef },
      { label: "Telefono referencia", value: safeTelRef },
    ];

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) return;

    const sheetLogoSrc = await buildSheetLogoSrc(brandLogo);
    if (printWindow.closed) return;

    const printDocument = buildEmployeePrintTemplate({
      logoSrc: sheetLogoSrc || brandLogo,
      nombre: safeNombre,
      employeeCode: safeCode,
      imageSrc: imageSrc || "",
      fechaImpresion: safeFechaImpresion,
      leftRows,
      rightRows,
      intent,
    });

    printWindow.document.open();
    printWindow.document.write(printDocument);
    printWindow.document.close();
  };

  const handlePrintFicha = () => {
    void openFichaWindow("print");
  };

  const infoCards = useMemo(
    () => [
      {
        key: "nombre",
        icon: "bi-person-vcard",
        label: "Nombre completo",
        value: personaNombre,
      },
      {
        key: "sucursal",
        icon: "bi-shop",
        label: "Sucursal",
        value: toDisplayValue(sucursalNombre, "Sin sucursal"),
      },
      {
        key: "dni",
        icon: "bi-card-text",
        label: "DNI",
        value: toDisplayValue(getDni(empleado)),
      },
      {
        key: "fecha_ingreso",
        icon: "bi-calendar-event",
        label: "Fecha de ingreso",
        value: formatLongDateLabel(empleado?.fecha_ingreso),
      },
      {
        key: "telefono",
        icon: "bi-telephone",
        label: "Telefono",
        value: toDisplayValue(getTelefono(empleado), "Sin telefono"),
      },
      {
        key: "cargo",
        icon: "bi-briefcase",
        label: "Cargo / Puesto",
        value: toDisplayValue(getCargo(empleado), "Sin cargo"),
      },
      {
        key: "salario",
        icon: "bi-cash-stack",
        label: "Sueldo",
        value: formatSalaryLabel(getSalario(empleado), "Sin sueldo"),
      },
      {
        key: "estado",
        icon: "bi-patch-check",
        label: "Estado",
        value: estadoValue === null ? "No definido" : estadoValue ? "Activo" : "Inactivo",
      },
      {
        key: "correo",
        icon: "bi-envelope",
        label: "Correo",
        value: toDisplayValue(getCorreo(empleado), "Sin correo"),
      },
      {
        key: "direccion",
        icon: "bi-geo-alt",
        label: "Direccion",
        value: toDisplayValue(getDireccion(empleado), "Sin direccion"),
      },
      {
        key: "nombre_referencia",
        icon: "bi-person-lines-fill",
        label: "Nombre referencia",
        value: toDisplayValue(getNombreReferencia(empleado), "Sin referencia"),
      },
      {
        key: "telefono_referencia",
        icon: "bi-telephone-forward",
        label: "Telefono referencia",
        value: toDisplayValue(getTelefonoReferencia(empleado), "Sin referencia"),
      },
    ],
    [empleado, estadoValue, personaNombre, sucursalNombre]
  );

  if (!open || !empleado) return null;

  const empleadoCode = `EMP-${String(empleado?.id_empleado ?? "-")}`;
  const estadoLabel = estadoValue === null ? "No definido" : estadoValue ? "Activo" : "Inactivo";
  const estadoTone = estadoValue === true ? "is-active" : estadoValue === false ? "is-inactive" : "is-neutral";
  const avatarInitials =
    personaNombre
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk.charAt(0).toUpperCase())
      .join("") || "EM";

  return (
    <div
      className="modal fade show inv-prod-modal-backdrop personas-emp-detail-backdrop"
      style={{ display: "block", zIndex: 2550 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable inv-prod-modal-dialog personas-emp-detail-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-content personas-emp-detail-modal">
          <div className="modal-header personas-emp-detail__header">
            <div className="personas-emp-detail__header-left">
              <span className="personas-emp-detail__header-icon" aria-hidden="true">
                <i className="bi bi-person-vcard" />
              </span>
              <div className="personas-emp-detail__header-copy">
                <h3>Detalle de empleado</h3>
                <p>Informacion completa del colaborador</p>
              </div>
            </div>

            <div className="personas-emp-detail__header-actions">
              <button type="button" className="personas-emp-detail__close-btn" onClick={onClose} aria-label="Cerrar detalle">
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </div>

          <div className="modal-body personas-emp-detail__body">
            <section className="personas-emp-detail__summary">
              <section className="personas-emp-detail__hero">
                <div className="personas-emp-detail__avatar-wrap">
                  <div className="personas-emp-detail__avatar">{imageSrc ? <img src={imageSrc} alt={personaNombre} /> : <span>{avatarInitials}</span>}</div>
                  <span className="personas-emp-detail__avatar-chip" aria-hidden="true">
                    <i className="bi bi-camera" />
                  </span>
                </div>

                <span className="personas-emp-detail__hero-divider" aria-hidden="true" />

                <div className="personas-emp-detail__hero-copy">
                  <h2>{personaNombre}</h2>

                  <div className="personas-emp-detail__hero-meta">
                    <span className="personas-emp-detail__code-pill">
                      <i className="bi bi-person-badge" />
                      <span>{empleadoCode}</span>
                    </span>

                    <span className={`personas-emp-detail__status-pill ${estadoTone}`}>
                      <span className="personas-emp-detail__status-dot" />
                      {estadoLabel}
                    </span>
                  </div>

                  <p className="personas-emp-detail__branch">
                    <i className="bi bi-shop" />
                    <span>
                      Sucursal <strong>{sucursalNombre}</strong>
                    </span>
                  </p>
                </div>
              </section>

              <section className="personas-emp-detail__panel">
                <header className="personas-emp-detail__panel-head">
                  <h4>Informacion personal y laboral</h4>
                  <span className="personas-emp-detail__panel-line" aria-hidden="true" />
                </header>

                <div className="personas-emp-detail__grid" aria-label="Datos del empleado">
                  {infoCards.map((item) => (
                    <article key={item.key} className="personas-emp-detail__info-card">
                      <div className="personas-emp-detail__info-icon" aria-hidden="true">
                        <i className={`bi ${item.icon}`} />
                      </div>
                      <div className="personas-emp-detail__info-copy">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>
          </div>

          <div className="modal-footer personas-emp-detail__footer">
            <div className="personas-emp-detail__footer-code">
              <i className="bi bi-person-badge" />
              <span>{empleadoCode}</span>
            </div>
            <div className="personas-emp-detail__footer-actions">
              <button type="button" className="personas-emp-detail__ghost-btn" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="personas-emp-detail__print-btn personas-emp-detail__print-btn--footer"
                onClick={handlePrintFicha}
                aria-label="Imprimir ficha"
              >
                <i className="bi bi-printer" />
                <span>Imprimir ficha</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
