import EntityCard from "../../../../../components/ui/EntityCard";

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
  onOpenEdit,
  onOpenDelete,
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

  return (
    <EntityCard
      index={index}
      iconClass="bi bi-person-badge"
      titleIconClass="bi bi-person-vcard"
      title={`${index + 1}. ${toDisplayValue(personaNombre, "Empleado sin nombre")}`}
      subtitle={`Sucursal: ${toDisplayValue(sucursalNombre)}`}
      badge={isActive ? "ACTIVO" : "INACTIVO"}
      badgeClass={isActive ? "is-ok" : "is-inactive"}
      inactive={!isActive}
      footerLeft={
        <>
          <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
          <span className="inv-catpro-code">EMP-{String(idEmpleado ?? "-")}</span>
        </>
      }
      footerActions={
        <>
          <button
            type="button"
            className="inv-catpro-action edit inv-catpro-action-compact"
            onClick={() => onOpenEdit(empleado)}
            title="Editar"
            disabled={actionLoading || deleting}
          >
            <i className="bi bi-pencil-square" />
            <span className="inv-catpro-action-label">Editar</span>
          </button>

          <button
            type="button"
            className="inv-catpro-action danger inv-catpro-action-compact"
            onClick={() => onOpenDelete(empleado)}
            title="Eliminar"
            disabled={actionLoading || deleting}
          >
            <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
            <span className="inv-catpro-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
          </button>
        </>
      }
    >
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
        <span>{toDisplayValue(getCargo(empleado), "Sin cargo")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-calendar-event" />
        <span>{formatDateLabel(empleado?.fecha_ingreso)}</span>
      </div>
    </EntityCard>
  );
}
