import EntityCard from "../../../../../components/ui/EntityCard";

const parseEstado = (record) => {
  const raw = record?.estado;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "t", "si", "activo"].includes(normalized)) return true;
    if (["false", "0", "f", "no", "inactivo"].includes(normalized)) return false;
  }
  return false;
};

const toDisplayValue = (value, fallback = "No registrado") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const formatRtnDisplay = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "N/D";

  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length !== 14) return raw;

  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 14)}`;
};

export default function EmpresaCard({
  empresa,
  index,
  onOpenEdit,
  onOpenDelete,
  actionLoading = false,
  deletingId = null,
}) {
  const isActive = parseEstado(empresa);
  const idEmpresa = empresa?.id_empresa;
  const deleting = deletingId === idEmpresa;
  const telefono = empresa?.telefono ?? empresa?.telefono_numero ?? empresa?.numero_telefono;
  const correo = empresa?.correo ?? empresa?.direccion_correo ?? empresa?.email;
  const direccion = empresa?.direccion ?? empresa?.direccion_detalle;

  return (
    <EntityCard
      index={index}
      iconClass="bi bi-buildings"
      titleIconClass="bi bi-building"
      title={`${index + 1}. ${toDisplayValue(empresa?.nombre_empresa, "Empresa sin nombre")}`}
      subtitle={`RTN: ${formatRtnDisplay(empresa?.rtn)}`}
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
            disabled={actionLoading || deleting}
          >
            <i className="bi bi-pencil-square" />
            <span className="inv-catpro-action-label">Editar</span>
          </button>

          <button
            type="button"
            className="inv-catpro-action danger inv-catpro-action-compact"
            onClick={() => onOpenDelete(empresa)}
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
