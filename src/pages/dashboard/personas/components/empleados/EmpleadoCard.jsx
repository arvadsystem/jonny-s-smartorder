import { useState } from "react";
import "./empleados-card.css";

const parseEstado = (record) => {
  if (Object.prototype.hasOwnProperty.call(record || {}, "estado")) return Boolean(record.estado);
  if (Object.prototype.hasOwnProperty.call(record || {}, "activo")) return Boolean(record.activo);
  if (Object.prototype.hasOwnProperty.call(record || {}, "habilitado")) return Boolean(record.habilitado);
  return true;
};

const toDisplayValue = (value, fallback = "No registrado") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatDateLabel = (value) => {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-HN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
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

const getDni = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, ["persona_dni", "dni"]),
    getFirstNonEmptyField(empleado?.persona, ["dni", "persona_dni"]),
  ]);

const getSalario = (empleado) =>
  getFirstNonEmptyField(empleado, ["salario_base", "sueldo", "salario", "salarioBase"]);

const formatSalaryLabel = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return "Sin sueldo";
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(parsed)) return String(value);
  return parsed.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getInitials = (fullName) => {
  const clean = String(fullName ?? "").trim();
  if (!clean) return "EM";

  const parts = clean
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const first = parts[0]?.charAt(0) || "";
  const second = (parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : "") || "";
  const initials = `${first}${second}`.toUpperCase();
  return initials || first.toUpperCase() || "EM";
};

export default function EmpleadoCard({
  empleado,
  index,
  imageSrc = "",
  onOpenEdit,
  onOpenDelete,
  onOpenDetail,
  actionLoading = false,
  deletingId = null,
  getPersonaNombre,
  getSucursalNombre,
}) {
  const isActive = parseEstado(empleado);
  const idEmpleado = empleado?.id_empleado;
  const deleting = deletingId === idEmpleado;
  const personaNombre = typeof getPersonaNombre === "function" ? getPersonaNombre(empleado) : "No registrado";
  const sucursalNombre = typeof getSucursalNombre === "function" ? getSucursalNombre(empleado) : "No registrado";
  const telefono = getTelefono(empleado);
  const cargo = getCargo(empleado);
  const salario = getSalario(empleado);
  const initials = getInitials(personaNombre);
  const codeLabel = `EMP-${String(idEmpleado ?? "-")}`;
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = Boolean(imageSrc) && !hasImageError;

  return (
    <article
      className={`inv-prod-catalog-card personas-emp-card empleados-card inv-anim-in ${isActive ? "is-ok" : "is-inactive"} ${
        isActive ? "" : "is-inactive-state"
      }`.trim()}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-prod-card-body personas-emp-card__body empleados-card__body">
        <header className="empleados-card__header">
          <div className="empleados-card__identity">
            <div className={`empleados-card__avatar ${showImage ? "has-image" : ""}`}>
              {showImage ? (
                <img
                  src={imageSrc}
                  alt={toDisplayValue(personaNombre, "Empleado")}
                  loading="lazy"
                  onError={() => setHasImageError(true)}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="empleados-card__title-wrap">
              <div className="inv-prod-card-name empleados-card__name">{`${index + 1}. ${toDisplayValue(personaNombre, "Empleado sin nombre")}`}</div>
              <small className="empleados-card__code">{codeLabel}</small>
            </div>
          </div>

          <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"} empleados-card__badge`}>
            <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
            <span>{isActive ? "Activo" : "Inactivo"}</span>
          </span>
        </header>

        <div className="empleados-card__meta" aria-label="Datos del empleado">
          <div className="empleados-card__meta-item">
            <span className="empleados-card__meta-label">
              <i className="bi bi-shop" />
              Sucursal
            </span>
            <span className="empleados-card__meta-value">{toDisplayValue(sucursalNombre, "Sin sucursal")}</span>
          </div>

          <div className="empleados-card__meta-item">
            <span className="empleados-card__meta-label">
              <i className="bi bi-person-vcard" />
              DNI
            </span>
            <span className="empleados-card__meta-value">{toDisplayValue(getDni(empleado), "N/D")}</span>
          </div>

          <div className="empleados-card__meta-item">
            <span className="empleados-card__meta-label">
              <i className="bi bi-calendar-event" />
              Ingreso
            </span>
            <span className="empleados-card__meta-value">{formatDateLabel(empleado?.fecha_ingreso)}</span>
          </div>

          <div className="empleados-card__meta-item">
            <span className="empleados-card__meta-label">
              <i className="bi bi-briefcase" />
              Cargo
            </span>
            <span className="empleados-card__meta-value">{toDisplayValue(cargo, "Sin cargo")}</span>
          </div>

          <div className="empleados-card__meta-item">
            <span className="empleados-card__meta-label">
              <i className="bi bi-cash-stack" />
              Sueldo
            </span>
            <span className="empleados-card__meta-value">{formatSalaryLabel(salario)}</span>
          </div>

          <div className="empleados-card__meta-item">
            <span className="empleados-card__meta-label">
              <i className="bi bi-telephone" />
              Telefono
            </span>
            <span className="empleados-card__meta-value">{toDisplayValue(telefono, "Sin telefono")}</span>
          </div>
        </div>

        <div className="inv-prod-stock-line personas-emp-card__footer empleados-card__footer">
          <div className="inv-prod-stock-meta personas-emp-card__stock-meta">
            <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
            <div className="inv-prod-stock-copy personas-emp-card__stock-copy empleados-card__summary">
              <span>{isActive ? "Empleado activo" : "Empleado inactivo"}</span>
              <small>{toDisplayValue(cargo, "Sin cargo")}</small>
            </div>
          </div>

          <div className="personas-emp-card__actions empleados-card__actions">
            <button
              type="button"
              className="empleados-card__icon-action empleados-card__icon-action--detail"
              onClick={() => onOpenDetail?.(empleado)}
              disabled={actionLoading || deleting}
              title="Ver detalle"
              aria-label="Ver detalle"
            >
              <i className="bi bi-eye" />
              <span className="empleados-card__icon-action-label">Detalle</span>
            </button>

            <button
              type="button"
              className="empleados-card__icon-action empleados-card__icon-action--edit"
              onClick={() => onOpenEdit(empleado)}
              disabled={actionLoading || deleting}
              title="Editar"
              aria-label="Editar"
            >
              <i className="bi bi-pencil-square" />
              <span className="empleados-card__icon-action-label">Editar</span>
            </button>

            <button
              type="button"
              className="empleados-card__icon-action empleados-card__icon-action--delete"
              onClick={() => onOpenDelete(empleado)}
              disabled={actionLoading || deleting}
              title="Eliminar"
              aria-label={deleting ? "Eliminando..." : "Eliminar"}
            >
              <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
              <span className="empleados-card__icon-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
