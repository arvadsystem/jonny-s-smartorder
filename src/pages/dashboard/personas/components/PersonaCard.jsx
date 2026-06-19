const parseEstado = (persona) => {
  if (Object.prototype.hasOwnProperty.call(persona || {}, "estado")) return Boolean(persona.estado);
  if (Object.prototype.hasOwnProperty.call(persona || {}, "activo")) return Boolean(persona.activo);
  if (Object.prototype.hasOwnProperty.call(persona || {}, "habilitado")) return Boolean(persona.habilitado);
  return true;
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

const toDisplayValue = (value, fallback = "No registrado") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const getRegistroDate = (persona) =>
  persona?.created_at || persona?.fecha_registro || persona?.fecha_ingreso || null;

const getTiempoSistema = (persona) => {
  const value = getRegistroDate(persona);
  if (!value) return "No disponible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "No disponible";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days} dia${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mes${months === 1 ? "" : "es"}`;
  const years = Math.floor(months / 12);
  return `${years} ano${years === 1 ? "" : "s"}`;
};

export default function PersonaCard({
  persona,
  index,
  onOpenEdit,
  onOpenDelete,
  actionLoading = false,
  deletingId = null,
}) {
  const isActive = parseEstado(persona);
  const dotClass = isActive ? "ok" : "off";
  const idPersona = persona?.id_persona;
  const deleting = deletingId === idPersona;
  const nombreCompleto = `${persona?.nombre || ""} ${persona?.apellido || ""}`.trim() || "Persona sin nombre";
  const telefono = persona?.telefono ?? persona?.telefono_numero ?? persona?.numero_telefono;
  const correo = persona?.correo ?? persona?.direccion_correo ?? persona?.email;

  return (
    <div
      className={`inv-catpro-item inv-cat-card inv-anim-in ${isActive ? "" : "is-inactive-state"}`}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-cat-card__halo" aria-hidden="true">
        <i className="bi bi-people" />
      </div>

      <div className="inv-catpro-item-top">
        <div className="inv-cat-card__title-wrap">
          <span className="inv-cat-card__icon" aria-hidden="true">
            <i className="bi bi-person-vcard" />
          </span>
          <div>
            <div className="fw-bold">
              {index + 1}. {nombreCompleto}
            </div>
            <div className="text-muted small">DNI: {toDisplayValue(persona?.dni, "N/D")}</div>
          </div>
        </div>

        <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"}`}>
          {isActive ? "ACTIVO" : "INACTIVO"}
        </span>
      </div>

      <div className="suc-page__card-details">
        <div className="suc-page__card-row">
          <i className="bi bi-geo-alt" />
          <span>{toDisplayValue(persona?.direccion)}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-telephone" />
          <span>{toDisplayValue(telefono, "Sin telefono")}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-envelope" />
          <span>{toDisplayValue(correo, "Sin correo")}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-calendar-event" />
          <span>{formatDateLabel(getRegistroDate(persona))}</span>
        </div>
        <div className="suc-page__card-row">
          <i className="bi bi-clock-history" />
          <span>{getTiempoSistema(persona)}</span>
        </div>
      </div>

      <div className="inv-catpro-meta inv-catpro-item-footer">
        <div className="inv-catpro-code-wrap">
          <span className={`inv-catpro-state-dot ${dotClass}`} />
          <span className="inv-catpro-code">PER-{String(idPersona ?? "-")}</span>
        </div>

        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
          <button
            type="button"
            className="inv-catpro-action edit inv-catpro-action-compact"
            onClick={() => onOpenEdit(persona)}
            title="Editar"
            disabled={actionLoading || deleting}
          >
            <i className="bi bi-pencil-square" />
            <span className="inv-catpro-action-label">Editar</span>
          </button>

          <button
            type="button"
            className="inv-catpro-action danger inv-catpro-action-compact"
            onClick={() => onOpenDelete(persona)}
            title="Eliminar"
            disabled={actionLoading || deleting}
          >
            <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
            <span className="inv-catpro-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
