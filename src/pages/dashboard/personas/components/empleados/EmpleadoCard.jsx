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

const getDni = (empleado) => empleado?.persona_dni ?? empleado?.dni;

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
  const cargo = getCargo(empleado);

  return (
    <article
      className={`inv-prod-catalog-card personas-emp-card inv-anim-in ${isActive ? "is-ok" : "is-inactive"} ${
        isActive ? "" : "is-inactive-state"
      }`.trim()}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-prod-thumb-wrap personas-emp-card__thumb">
        {imageSrc ? (
          <img src={imageSrc} alt={toDisplayValue(personaNombre, "Empleado")} className="inv-prod-thumb" loading="lazy" />
        ) : (
          <div className="inv-prod-thumb placeholder">
            <i className="bi bi-image" />
            <span>Sin imagen</span>
          </div>
        )}
        <span className={`inv-prod-card-state ${isActive ? "is-ok" : "is-inactive"}`}>
          {isActive ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="inv-prod-card-body personas-emp-card__body">
        <div className="inv-prod-card-bg-icon" aria-hidden="true">
          <i className="bi bi-person-badge" />
        </div>

        <div className="inv-prod-card-name">{`${index + 1}. ${toDisplayValue(personaNombre, "Empleado sin nombre")}`}</div>
        <div className="inv-prod-card-category">{`Sucursal: ${toDisplayValue(sucursalNombre)}`}</div>

        <div className="personas-emp-card__meta">
          <div className="personas-page__card-row">
            <i className="bi bi-person-vcard" />
            <span>DNI: {toDisplayValue(getDni(empleado), "N/D")}</span>
          </div>
          <div className="personas-page__card-row">
            <i className="bi bi-telephone" />
            <span>{toDisplayValue(getTelefono(empleado), "Sin telefono")}</span>
          </div>
          <div className="personas-page__card-row">
            <i className="bi bi-briefcase" />
            <span>{toDisplayValue(cargo, "Sin cargo")}</span>
          </div>
          <div className="personas-page__card-row">
            <i className="bi bi-calendar-event" />
            <span>{formatDateLabel(empleado?.fecha_ingreso)}</span>
          </div>
        </div>

        <div className="inv-prod-stock-line personas-emp-card__footer">
          <div className="inv-prod-stock-meta personas-emp-card__stock-meta">
            <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
            <div className="inv-prod-stock-copy personas-emp-card__stock-copy">
              <span>{toDisplayValue(cargo, isActive ? "Empleado activo" : "Empleado inactivo")}</span>
              <small className="personas-emp-card__code">{`EMP-${String(idEmpleado ?? "-")}`}</small>
            </div>
          </div>

          <div className="personas-emp-card__actions">
            <button
              type="button"
              className="btn inv-prod-btn-subtle personas-emp-card__action"
              onClick={() => onOpenDetail?.(empleado)}
              disabled={actionLoading || deleting}
              title="Ver detalle"
            >
              <i className="bi bi-eye" />
              <span>Ver detalle</span>
            </button>

            <button
              type="button"
              className="btn inv-prod-btn-outline personas-emp-card__action"
              onClick={() => onOpenEdit(empleado)}
              disabled={actionLoading || deleting}
              title="Editar"
            >
              <i className="bi bi-pencil-square" />
              <span>Editar</span>
            </button>

            <button
              type="button"
              className="btn inv-prod-card-action danger inv-prod-card-action-compact personas-emp-card__action personas-emp-card__action--danger"
              onClick={() => onOpenDelete(empleado)}
              disabled={actionLoading || deleting}
              title="Eliminar"
            >
              <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
              <span className="inv-prod-card-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
