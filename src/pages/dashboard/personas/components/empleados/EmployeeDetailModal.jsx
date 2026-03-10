import { useEffect, useMemo } from "react";

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
