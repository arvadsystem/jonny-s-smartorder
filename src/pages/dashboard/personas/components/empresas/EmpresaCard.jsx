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
    <EntityCard
      index={index}
      iconClass="bi bi-buildings"
      titleIconClass="bi bi-building"
      title={`${index + 1}. ${toDisplayValue(empresa?.nombre_empresa, "Empresa sin nombre")}`}
      subtitle={`RTN: ${toDisplayValue(empresa?.rtn, "N/D")}`}
      badge={isActive ? "ACTIVO" : "INACTIVO"}
      badgeClass={isActive ? "is-ok" : "is-inactive"}
      inactive={!isActive}
      footerLeft={
        <>
          <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
          <span className="inv-catpro-code">EMP-{String(idEmpresa ?? "-")}</span>
        </>
      }
      footerActions={
        <>
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
        </>
      }
    >
      <div className="personas-page__card-row">
        <i className="bi bi-file-earmark-text" />
        <span>RTN: {toDisplayValue(empresa?.rtn, "N/D")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-telephone" />
        <span>{toDisplayValue(telefono, "Sin telefono")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-envelope" />
        <span>{toDisplayValue(correo, "Sin correo")}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-geo-alt" />
        <span>{toDisplayValue(direccion, "Sin direccion")}</span>
      </div>
    </EntityCard>
  );
}
