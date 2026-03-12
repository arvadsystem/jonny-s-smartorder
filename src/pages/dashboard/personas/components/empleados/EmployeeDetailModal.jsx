import { useEffect, useMemo } from "react";
import brandLogo from "../../../../../assets/images/logo-jonnys.png";

const toDisplayValue = (value, fallback = "—") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatDateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toDisplayValue(value);
  return date.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const detectEstado = (record) => {
  if (Object.prototype.hasOwnProperty.call(record || {}, "estado")) return Boolean(record.estado);
  if (Object.prototype.hasOwnProperty.call(record || {}, "activo")) return Boolean(record.activo);
  if (Object.prototype.hasOwnProperty.call(record || {}, "habilitado")) return Boolean(record.habilitado);
  return null;
};

const getDni = (empleado) => empleado?.persona_dni ?? empleado?.dni;

const getTelefono = (empleado) =>
  empleado?.telefono ??
  empleado?.telefono_numero ??
  empleado?.numero_telefono ??
  empleado?.persona_telefono ??
  empleado?.telefono_persona;

const getCargo = (empleado) =>
  empleado?.cargo ??
  empleado?.nombre_cargo ??
  empleado?.cargo_nombre ??
  empleado?.puesto ??
  empleado?.rol;

const getCorreo = (empleado) =>
  empleado?.correo ??
  empleado?.direccion_correo ??
  empleado?.email ??
  empleado?.persona_correo ??
  empleado?.correo_persona;

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
  imageSrc,
  fechaImpresion,
  leftRows,
  rightRows,
}) => `<!doctype html>
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
        padding: 16px 18px 14px 120px;
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
        left: 10px;
        top: 2px;
        width: 100px;
        height: 100px;
        border-radius: 0;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
        z-index: 2;
      }
      .header-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 1.5px 1px rgba(24, 9, 6, 0.22));
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
        <div class="header-logo">
          ${logoSrc ? `<img src="${escapeHtml(logoSrc)}" alt="Jonny's SmartOrder" />` : ""}
        </div>
        <div class="header-copy">
          <h1>Detalle de Empleado</h1>
          <p>Ficha individual de recurso humano</p>
        </div>
      </header>
      <section class="content">
        <div class="eyebrow">Empleado</div>
        <h2 class="employee-name">${escapeHtml(nombre)}</h2>
        <div class="image-wrap">
          ${
            imageSrc
              ? `<img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(nombre)}" />`
              : `<div class="image-placeholder"><span>Sin imagen</span><strong>Sin imagen</strong></div>`
          }
        </div>
        <div class="separator"></div>
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
      window.onafterprint = function () { window.close(); };
    </script>
  </body>
</html>`;

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

  const handlePrintFicha = () => {
    if (!empleado) return;

    const safeNombre = toDisplayValue(personaNombre, "Empleado sin nombre");
    const safeSucursal = toDisplayValue(sucursalNombre, "-");
    const safeDni = toDisplayValue(getDni(empleado), "-");
    const safeTelefono = toDisplayValue(getTelefono(empleado), "-");
    const safeCargo = toDisplayValue(getCargo(empleado), "-");
    const safeCorreo = toDisplayValue(getCorreo(empleado), "-");
    const safeEstado = estadoValue === null ? "-" : estadoValue ? "Activo" : "Inactivo";
    const safeFechaIngreso = formatPrintDateLabel(empleado?.fecha_ingreso);
    const safeFechaImpresion = formatPrintDateTime();

    const leftRows = [
      { label: "Nombre completo", value: safeNombre },
      { label: "DNI", value: safeDni },
      { label: "Cargo / Puesto", value: safeCargo },
      { label: "Fecha de ingreso", value: safeFechaIngreso },
    ];

    const rightRows = [
      { label: "Sucursal", value: safeSucursal },
      { label: "Telefono", value: safeTelefono },
      {
        label: "Estado",
        value: safeEstado,
        valueClass: safeEstado === "Activo" ? "state-active" : safeEstado === "Inactivo" ? "state-inactive" : "",
      },
      { label: "Correo", value: safeCorreo },
    ];

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) return;

    const printDocument = buildEmployeePrintTemplate({
      logoSrc: brandLogo,
      nombre: safeNombre,
      imageSrc: imageSrc || "",
      fechaImpresion: safeFechaImpresion,
      leftRows,
      rightRows,
    });

    printWindow.document.open();
    printWindow.document.write(printDocument);
    printWindow.document.close();
  };

  const detailFields = useMemo(
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
        value: sucursalNombre,
      },
      {
        key: "dni",
        icon: "bi-card-text",
        label: "DNI",
        value: toDisplayValue(getDni(empleado)),
      },
      {
        key: "telefono",
        icon: "bi-telephone",
        label: "Telefono",
        value: toDisplayValue(getTelefono(empleado)),
      },
      {
        key: "cargo",
        icon: "bi-briefcase",
        label: "Cargo / Puesto",
        value: toDisplayValue(getCargo(empleado)),
      },
      {
        key: "estado",
        icon: "bi-toggle-on",
        label: "Estado",
        value:
          estadoValue === null
            ? "—"
            : estadoValue
              ? "Activo"
              : "Inactivo",
      },
      {
        key: "fecha_ingreso",
        icon: "bi-calendar-event",
        label: "Fecha de ingreso",
        value: formatDateLabel(empleado?.fecha_ingreso),
      },
      {
        key: "correo",
        icon: "bi-envelope",
        label: "Correo",
        value: toDisplayValue(getCorreo(empleado)),
      },
    ],
    [empleado, estadoValue, personaNombre, sucursalNombre]
  );

  if (!open || !empleado) return null;

  return (
    <div
      className="modal fade show inv-prod-modal-backdrop personas-emp-detail-backdrop"
      style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 2550 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable inv-prod-modal-dialog inv-ins-detail-modal-dialog personas-emp-detail-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-content shadow inv-prod-modal-content inv-ins-detail-modal inv-ins-detail-modal--editorial personas-emp-detail-modal">
          <div className="modal-header inv-ins-detail-modal__header">
            <div className="inv-ins-detail-modal__title-wrap">
              <div className="inv-ins-detail-modal__icon">
                <i className="bi bi-person-badge" />
              </div>
              <div>
                <div className="fw-semibold">Detalle de empleado</div>
                <div className="small text-muted">{personaNombre}</div>
              </div>
            </div>

            <div className="inv-ins-detail-modal__header-actions">
              <button
                type="button"
                className="btn btn-sm inv-prod-btn-subtle"
                onClick={handlePrintFicha}
                aria-label="Imprimir ficha"
              >
                <i className="bi bi-printer me-1" />
                Imprimir ficha
              </button>
              <button
                type="button"
                className="btn btn-sm inv-ins-detail-modal__close"
                onClick={onClose}
                aria-label="Cerrar detalle"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </div>

          <div className="modal-body inv-prod-modal-body inv-ins-detail-modal__body inv-ins-detail-modal__body--editorial">
            <div className="inv-ins-detail-modal__ambient" aria-hidden="true">
              <span className="is-one" />
              <span className="is-two" />
              <span className="is-three" />
            </div>

            <div className="inv-ins-detail-modal__editorial-grid">
              <section className="inv-ins-detail-modal__lead personas-emp-detail__lead">
                <span className="inv-ins-detail-modal__eyebrow">Empleado</span>
                <strong className="inv-ins-detail-modal__lead-price personas-emp-detail__lead-price">{personaNombre}</strong>

                <div className={`inv-prod-image-preview personas-emp-detail__image ${imageSrc ? "has-image" : ""}`}>
                  {imageSrc ? (
                    <img src={imageSrc} alt={personaNombre} />
                  ) : (
                    <div className="inv-prod-image-placeholder">
                      <i className="bi bi-image" />
                      <span>Sin imagen</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="inv-ins-detail-modal__list" aria-label="Datos del empleado">
                {detailFields.map((item, index) => (
                  <article
                    key={item.key}
                    className="inv-ins-detail-modal__line"
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="inv-ins-detail-modal__line-icon" aria-hidden="true">
                      <i className={`bi ${item.icon}`} />
                    </div>
                    <div className="inv-ins-detail-modal__line-copy">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  </article>
                ))}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
