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

export default function EmpresaCard({
  empresa,
  index,
  onOpenEdit,
  onOpenDelete,
  onToggleEstado,
  actionLoading = false,
  deletingId = null,
  togglingEstadoId = null,
}) {
  const isActive = parseEstado(empresa);
  const idEmpresa = empresa?.id_empresa;
  const deleting = deletingId === idEmpresa;
  const toggling = togglingEstadoId === idEmpresa;
  const telefono = empresa?.telefono ?? empresa?.telefono_numero ?? empresa?.numero_telefono;
  const correo = empresa?.correo ?? empresa?.direccion_correo ?? empresa?.email;
  const direccion = empresa?.direccion ?? empresa?.direccion_detalle;

  return (
    <div
      className={`inv-catpro-item inv-cat-card inv-anim-in ${isActive ? "" : "is-inactive-state"}`}
      style={{ animationDelay: `${Math.min(index * 40, 240)}ms` }}
    >
      <div className="inv-cat-card__halo" aria-hidden="true">
        <i className="bi bi-buildings" />
      </div>

      <div className="inv-catpro-item-top">
        <div className="inv-cat-card__title-wrap">
          <span className="inv-cat-card__icon" aria-hidden="true">
            <i className="bi bi-building" />
          </span>
          <div>
            <div className="fw-bold">
              {index + 1}. {toDisplayValue(empresa?.nombre_empresa, "Empresa sin nombre")}
            </div>
            <div className="text-muted small">RTN: {toDisplayValue(empresa?.rtn, "N/D")}</div>
          </div>
        </div>

        <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"}`}>
          {isActive ? "ACTIVO" : "INACTIVO"}
        </span>
      </div>

      <div className="suc-page__card-details">
        <div className="suc-page__card-row">
          <i className="bi bi-file-earmark-text" />
          <span>RTN: {toDisplayValue(empresa?.rtn, "N/D")}</span>
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
          <i className="bi bi-geo-alt" />
          <span>{toDisplayValue(direccion, "Sin direccion")}</span>
        </div>
      </div>

      <div className="inv-catpro-meta inv-catpro-item-footer">
        <div className="inv-catpro-code-wrap">
          <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
          <span className="inv-catpro-code">EMP-{String(idEmpresa ?? "-")}</span>
        </div>

        <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions">
          <button
            type="button"
            className="inv-catpro-action edit inv-catpro-action-compact"
            onClick={() => onOpenEdit(empresa)}
            title="Editar"
            disabled={actionLoading || deleting || toggling}
          >
            <i className="bi bi-pencil-square" />
            <span className="inv-catpro-action-label">Editar</span>
          </button>

          <button
            type="button"
            className={`inv-catpro-action ${isActive ? "state-off" : "state-on"} inv-catpro-action-compact`}
            onClick={() => onToggleEstado(empresa, !isActive)}
            title={isActive ? "Inactivar" : "Activar"}
            disabled={actionLoading || deleting || toggling}
          >
            <i className={`bi ${isActive ? "bi-slash-circle" : "bi-check-circle"}`} />
            <span className="inv-catpro-action-label">
              {toggling ? "Procesando" : isActive ? "Inactivar" : "Activar"}
            </span>
          </button>

          <button
            type="button"
            className="inv-catpro-action danger inv-catpro-action-compact"
            onClick={() => onOpenDelete(empresa)}
            title="Eliminar"
            disabled={actionLoading || deleting || toggling}
          >
            <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
            <span className="inv-catpro-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
