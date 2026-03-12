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

const getPuntos = (cliente) => {
  const raw = cliente?.puntos ?? cliente?.puntos_acumulados ?? cliente?.total_puntos;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export default function ClienteCard({
  cliente,
  index,
  onOpenEdit,
  onOpenDelete,
  actionLoading = false,
  deletingId = null,
}) {
  const isActive = parseEstado(cliente);
  const idCliente = cliente?.id_cliente;
  const deleting = deletingId === idCliente;
  const codigoCliente = toDisplayValue(cliente?.codigo_cliente, `CLI-${String(idCliente ?? "-")}`);
  const origenTipo = String(cliente?.origen_cliente ?? "").trim().toLowerCase() === "empresa"
    ? "empresa"
    : "persona";
  const origenLabel = toDisplayValue(
    cliente?.origen_label,
    origenTipo === "empresa" ? "Cliente Empresa" : "Cliente Persona"
  );
  const nombrePrincipal = toDisplayValue(cliente?.nombre_principal, "Cliente sin nombre");
  const documentoLabel = toDisplayValue(
    cliente?.documento_label,
    origenTipo === "empresa" ? "RTN" : "DNI"
  );
  const documentoValor = toDisplayValue(cliente?.documento_valor, "N/D");
  const tipoClienteLabel = toDisplayValue(cliente?.tipo_cliente, "Sin tipo");
  const telefonoValue = toDisplayValue(cliente?.telefono, "Sin telefono");
  const correoValue = toDisplayValue(cliente?.correo, "Sin correo");
  const fechaIngresoLabel = formatDateLabel(cliente?.fecha_ingreso);

  return (
    <EntityCard
      index={index}
      iconClass="bi bi-person-lines-fill"
      titleIconClass="bi bi-person-vcard"
      title={`${index + 1}. ${nombrePrincipal}`}
      subtitle={origenLabel}
      badge={isActive ? "ACTIVO" : "INACTIVO"}
      badgeClass={isActive ? "is-ok" : "is-inactive"}
      inactive={!isActive}
      footerLeft={
        <>
          <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
          <span className="inv-catpro-code">{codigoCliente}</span>
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
      <div className="personas-page__card-row clientes-card__origin-row">
        <i className={origenTipo === "empresa" ? "bi bi-building-check" : "bi bi-person-check"} />
        <span className={`clientes-origin-chip ${origenTipo === "empresa" ? "is-empresa" : "is-persona"}`}>
          {origenLabel}
        </span>
      </div>
      <div className="personas-page__card-row">
        <i className={origenTipo === "empresa" ? "bi bi-buildings" : "bi bi-person-vcard"} />
        <span>{`${documentoLabel}: ${documentoValor}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-telephone" />
        <span>Telefono: {telefonoValue}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-envelope" />
        <span>Correo: {correoValue}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-person-badge" />
        <span>Tipo: {tipoClienteLabel}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-award" />
        <span>Puntos: {getPuntos(cliente)}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-calendar-event" />
        <span>Ingreso: {fechaIngresoLabel}</span>
      </div>
    </EntityCard>
  );
}
