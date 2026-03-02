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

const getDni = (cliente) => cliente?.persona_dni ?? cliente?.dni;

const getTelefono = (cliente) =>
  cliente?.telefono ??
  cliente?.telefono_numero ??
  cliente?.numero_telefono ??
  cliente?.persona_telefono ??
  cliente?.telefono_persona;

const getCorreo = (cliente) =>
  cliente?.correo ??
  cliente?.direccion_correo ??
  cliente?.email ??
  cliente?.persona_correo ??
  cliente?.correo_persona;

const getFechaRegistro = (cliente) => cliente?.fecha_registro ?? cliente?.fecha_ingreso ?? cliente?.created_at;

export default function ClienteCard({
  cliente,
  index,
  onOpenEdit,
  onOpenDelete,
  actionLoading = false,
  deletingId = null,
  getPersonaNombre,
  getEmpresaNombre,
}) {
  const isActive = parseEstado(cliente);
  const idCliente = cliente?.id_cliente;
  const deleting = deletingId === idCliente;
  const personaNombre = typeof getPersonaNombre === "function" ? getPersonaNombre(cliente) : "No registrado";
  const empresaNombre = typeof getEmpresaNombre === "function" ? getEmpresaNombre(cliente) : "No registrado";

  return (
    <EntityCard
      index={index}
      iconClass="bi bi-person-lines-fill"
      titleIconClass="bi bi-person-vcard"
      title={`${index + 1}. ${toDisplayValue(personaNombre, "Cliente sin nombre")}`}
      subtitle={toDisplayValue(empresaNombre)}
      badge={isActive ? "ACTIVO" : "INACTIVO"}
      badgeClass={isActive ? "is-ok" : "is-inactive"}
      inactive={!isActive}
      footerLeft={
        <>
          <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
          <span className="inv-catpro-code">CLI-{String(idCliente ?? "-")}</span>
        </>
      }
      footerActions={
        <>
          <button
            type="button"
            className="inv-catpro-action edit inv-catpro-action-compact"
            onClick={() => onOpenEdit(cliente)}
            title="Editar"
            disabled={actionLoading || deleting}
          >
            <i className="bi bi-pencil-square" />
            <span className="inv-catpro-action-label">Editar</span>
          </button>

          <button
            type="button"
            className="inv-catpro-action danger inv-catpro-action-compact"
            onClick={() => onOpenDelete(cliente)}
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
        <span>DNI: {toDisplayValue(getDni(cliente), "N/D")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-telephone" />
        <span>{toDisplayValue(getTelefono(cliente), "Sin telefono")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-envelope" />
        <span>{toDisplayValue(getCorreo(cliente), "Sin correo")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-calendar-event" />
        <span>{formatDateLabel(getFechaRegistro(cliente))}</span>
      </div>
    </EntityCard>
  );
}
