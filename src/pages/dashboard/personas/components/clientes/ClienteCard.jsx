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

const firstNonEmptyValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
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

const formatRtnDisplay = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "----";
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length !== 14) return raw;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 14)}`;
};

const buildPersonaRtnDisplay = (dniValue, rtnValue) => {
  const dniDigits = String(dniValue ?? "").replace(/\D/g, "");
  const rawRtn = String(rtnValue ?? "").trim();
  if (!rawRtn) return "----";

  const rtnDigits = rawRtn.replace(/\D/g, "");
  if (rtnDigits.length === 14) {
    return formatRtnDisplay(rtnDigits);
  }

  if (dniDigits.length === 13 && rtnDigits.length === 1) {
    return formatRtnDisplay(`${dniDigits}${rtnDigits}`);
  }

  if (dniDigits.length === 13 && rtnDigits.length > 1 && rtnDigits.length < 14) {
    return formatRtnDisplay(`${dniDigits}${rtnDigits.slice(-1)}`);
  }

  return rawRtn;
};

export default function ClienteCard({
  cliente,
  index,
  onOpenEdit,
  onOpenDelete,
  canEdit = true,
  canInactivate = true,
  canDelete = false,
  canView = false,
  actionLoading = false,
  deletingId = null,
  personaRtnCatalog = "",
}) {
  // Reservados para habilitar acciones futuras sin romper la firma del componente.
  void canDelete;
  void canView;

  const isActive = parseEstado(cliente);
  const idCliente = cliente?.id_cliente;
  const deleting = deletingId === idCliente;
  const isActivating = !isActive;
  const statusActionLabel = deleting
    ? (isActivating ? "Activando..." : "Inactivando...")
    : (isActivating ? "Activar" : "Inactivar");
  const statusActionIcon = deleting
    ? "bi-hourglass-split"
    : (isActivating ? "bi-check-circle" : "bi-slash-circle");
  const codigoCliente = toDisplayValue(cliente?.codigo_cliente, `CLI-${String(idCliente ?? "-")}`);
  const origenTipo = String(cliente?.origen_cliente ?? "").trim().toLowerCase() === "empresa" ? "empresa" : "persona";
  const isPersonaCliente = origenTipo !== "empresa";
  const origenLabel = toDisplayValue(
    cliente?.origen_label,
    origenTipo === "empresa" ? "Cliente Empresa" : "Cliente Persona"
  );
  const nombrePrincipal = toDisplayValue(
    cliente?.nombre_completo ?? cliente?.nombre_principal,
    "Cliente sin nombre"
  );

  const personaDni = firstNonEmptyValue(
    cliente?.persona_dni,
    cliente?.dni,
    String(cliente?.documento_tipo ?? "").toLowerCase() === "dni" ? cliente?.documento_valor : null
  );
  const personaRtn = firstNonEmptyValue(
    personaRtnCatalog,
    cliente?.persona_rtn,
    cliente?.persona_rtn_complemento,
    cliente?.rtn_persona,
    cliente?.rtn_complemento,
    cliente?.complemento_rtn,
    cliente?.numero_rtn,
    cliente?.persona?.rtn,
    cliente?.persona?.RTN,
    cliente?.persona?.persona_rtn_complemento,
    cliente?.persona?.rtn_persona,
    cliente?.persona?.rtn_complemento,
    cliente?.persona?.complemento_rtn,
    cliente?.persona?.numero_rtn,
    cliente?.rtn,
    String(cliente?.documento_tipo ?? "").toLowerCase() === "rtn" ? cliente?.documento_valor : null
  );
  const empresaRtn = firstNonEmptyValue(
    cliente?.empresa_rtn,
    cliente?.empresa?.rtn,
    cliente?.rtn,
    String(cliente?.documento_tipo ?? "").toLowerCase() === "rtn" ? cliente?.documento_valor : null
  );
  const telefonoValue = toDisplayValue(
    firstNonEmptyValue(cliente?.telefono, cliente?.persona_telefono, cliente?.empresa_telefono),
    "Sin telefono"
  );
  const correoValue = toDisplayValue(
    firstNonEmptyValue(cliente?.correo, cliente?.persona_correo, cliente?.empresa_correo),
    "Sin correo"
  );
  const direccionValue = toDisplayValue(
    firstNonEmptyValue(cliente?.direccion, cliente?.persona_direccion, cliente?.empresa_direccion),
    "Sin direccion"
  );
  const tipoClienteValue = toDisplayValue(
    firstNonEmptyValue(cliente?.tipo_cliente, cliente?.tipo_cliente_nombre, cliente?.nombre_tipo_cliente),
    "Sin tipo"
  );
  const fechaPersonaValue = firstNonEmptyValue(
    cliente?.persona_fecha_nacimiento,
    cliente?.fecha_nacimiento
  );
  const fechaLabel = formatDateLabel(
    isPersonaCliente
      ? firstNonEmptyValue(fechaPersonaValue, cliente?.fecha_ingreso, cliente?.created_at, cliente?.fecha_registro)
      : firstNonEmptyValue(cliente?.fecha_ingreso, cliente?.created_at, cliente?.fecha_registro)
  );
  const generoValue = toDisplayValue(
    firstNonEmptyValue(cliente?.persona_genero, cliente?.genero, cliente?.sexo),
    "No disponible"
  );
  const entidadVinculadaCode = isPersonaCliente
    ? `PER-${String(cliente?.id_persona ?? "-")}`
    : `EMP-${String(cliente?.id_empresa_cliente ?? cliente?.id_empresa ?? "-")}`;
  const subtitle = isPersonaCliente
    ? `DNI: ${toDisplayValue(personaDni, "No disponible")}`
    : `RTN: ${formatRtnDisplay(empresaRtn)}`;
  const personaRtnDisplay = buildPersonaRtnDisplay(personaDni, personaRtn);

  return (
    <EntityCard
      index={index}
      iconClass={isPersonaCliente ? "bi bi-person-lines-fill" : "bi bi-buildings"}
      titleIconClass={isPersonaCliente ? "bi bi-person-vcard" : "bi bi-building"}
      title={`${index + 1}. ${nombrePrincipal}`}
      subtitle={subtitle}
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
          {canEdit ? (
            <button
              type="button"
              className="inv-catpro-action edit inv-catpro-action-compact"
              onClick={() => onOpenEdit(cliente)}
              title="Editar"
              disabled={actionLoading || deleting || !canEdit}
            >
              <i className="bi bi-pencil-square" />
              <span className="inv-catpro-action-label">Editar</span>
            </button>
          ) : null}

          {canInactivate ? (
            <button
              type="button"
              className={`inv-catpro-action ${isActive ? "danger" : ""} inv-catpro-action-compact`.trim()}
              onClick={() => onOpenDelete(cliente)}
              title={isActivating ? "Activar" : "Inactivar"}
              disabled={actionLoading || deleting || !canInactivate}
            >
              <i className={`bi ${statusActionIcon}`} />
              <span className="inv-catpro-action-label">{statusActionLabel}</span>
            </button>
          ) : null}
        </>
      }
    >
      <div className="personas-page__card-row">
        <i className={origenTipo === "empresa" ? "bi bi-buildings" : "bi bi-person-vcard"} />
        <span>{`Tipo: ${origenLabel}`}</span>
      </div>
      {isPersonaCliente ? (
        <div className="personas-page__card-row">
          <i className="bi bi-file-earmark-text" />
          <span>{`RTN: ${personaRtnDisplay}`}</span>
        </div>
      ) : null}
      <div className="personas-page__card-row">
        <i className="bi bi-geo-alt" />
        <span>{direccionValue}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-telephone" />
        <span>{telefonoValue}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-envelope" />
        <span>{correoValue}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-person-badge" />
        <span>{`Tipo cliente: ${tipoClienteValue}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-calendar-event" />
        <span>{fechaLabel}</span>
      </div>
      {isPersonaCliente ? (
        <div className="personas-page__card-row">
          <i className="bi bi-gender-ambiguous" />
          <span>{generoValue}</span>
        </div>
      ) : null}
      <div className="personas-page__card-row">
        <i className="bi bi-link-45deg" />
        <span>{`Vinculo: ${entidadVinculadaCode}`}</span>
      </div>
    </EntityCard>
  );
}

