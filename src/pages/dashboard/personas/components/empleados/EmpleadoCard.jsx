import { useState } from "react";
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

const normalizeGeneroLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (["m", "masculino", "masculina", "male", "hombre", "1"].includes(normalized)) return "Masculino";
  if (["f", "femenino", "femenina", "female", "mujer", "2"].includes(normalized)) return "Femenino";
  if (["o", "otro", "otra", "others", "3"].includes(normalized)) return "Otro";

  return raw;
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

const getCorreo = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "correo",
      "texto_correo",
      "correo_texto",
      "direccion_correo",
      "email",
      "correo_electronico",
      "persona_correo",
      "correo_persona",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "correo",
      "texto_correo",
      "correo_texto",
      "direccion_correo",
      "email",
      "correo_electronico",
      "persona_correo",
      "correo_persona",
    ]),
  ]);

const getDireccion = (empleado) =>
  getFirstNonEmptyValue([
    getFirstNonEmptyField(empleado, [
      "direccion",
      "texto_direccion",
      "direccion_texto",
      "domicilio",
      "persona_direccion",
      "direccion_persona",
    ]),
    getFirstNonEmptyField(empleado?.persona, [
      "direccion",
      "texto_direccion",
      "direccion_texto",
      "domicilio",
      "persona_direccion",
      "direccion_persona",
    ]),
  ]);

const getGenero = (empleado) =>
  normalizeGeneroLabel(
    getFirstNonEmptyValue([
      getFirstNonEmptyField(empleado, [
        "genero",
        "sexo",
        "persona_genero",
        "genero_persona",
        "sexo_persona",
        "gender",
        "Genero",
        "Sexo",
      ]),
      getFirstNonEmptyField(empleado?.persona, [
        "genero",
        "sexo",
        "persona_genero",
        "genero_persona",
        "sexo_persona",
        "gender",
        "Genero",
        "Sexo",
      ]),
    ])
  );

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
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) || "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : "";
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
  canEdit = true,
  canInactivate = true,
  canDelete = false,
  canView = true,
  getPersonaNombre,
  getSucursalNombre,
  getGeneroLabel,
}) {
  void canDelete;
  const isActive = parseEstado(empleado);
  const idEmpleado = empleado?.id_empleado;
  const deleting = deletingId === idEmpleado;
  const isActivating = !isActive;
  const statusActionLabel = deleting
    ? (isActivating ? "Activando..." : "Inactivando...")
    : (isActivating ? "Activar" : "Inactivar");
  const statusActionIcon = deleting
    ? "bi-hourglass-split"
    : (isActivating ? "bi-check-circle" : "bi-slash-circle");
  const personaNombre = typeof getPersonaNombre === "function" ? getPersonaNombre(empleado) : "No registrado";
  const sucursalNombre = typeof getSucursalNombre === "function" ? getSucursalNombre(empleado) : "No registrado";
  const telefono = getTelefono(empleado);
  const correo = getCorreo(empleado);
  const direccion = getDireccion(empleado);
  const genero =
    typeof getGeneroLabel === "function"
      ? String(getGeneroLabel(empleado) ?? "").trim()
      : getGenero(empleado);
  const cargo = getCargo(empleado);
  const salario = getSalario(empleado);
  const codeLabel = `EMP-${String(idEmpleado ?? "-")}`;
  const initials = getInitials(personaNombre);
  const [hasImageError, setHasImageError] = useState(false);
  const hasImage = Boolean(String(imageSrc || "").trim()) && !hasImageError;

  return (
    <EntityCard
      index={index}
      iconClass="bi bi-person-lines-fill"
      titleIconClass="bi bi-person-vcard"
      titleIconClassName="empleados-title-avatar"
      titleIconNode={
        hasImage ? (
          <img
            src={imageSrc}
            alt={toDisplayValue(personaNombre, "Empleado")}
            loading="eager"
            decoding="async"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <span className="empleados-title-avatar__initials">{initials}</span>
        )
      }
      title={`${index + 1}. ${toDisplayValue(personaNombre, "Empleado sin nombre")}`}
      subtitle={toDisplayValue(cargo, "Sin cargo")}
      badge={isActive ? "ACTIVO" : "INACTIVO"}
      badgeClass={isActive ? "is-ok" : "is-inactive"}
      inactive={!isActive}
      footerLeft={
        <>
          <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
          <span className="inv-catpro-code">{codeLabel}</span>
        </>
      }
      footerActions={
        <>
          {canView ? (
            <button
              type="button"
              className="inv-catpro-action inv-catpro-action-compact"
              onClick={() => onOpenDetail?.(empleado)}
              title="Detalle"
              disabled={actionLoading || deleting || !canView}
            >
              <i className="bi bi-eye" />
              <span className="inv-catpro-action-label">Detalle</span>
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              className="inv-catpro-action edit inv-catpro-action-compact"
              onClick={() => onOpenEdit(empleado)}
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
              onClick={() => onOpenDelete(empleado)}
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
        <i className="bi bi-shop" />
        <span>{`Sucursal: ${toDisplayValue(sucursalNombre, "Sin sucursal")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-briefcase" />
        <span>{`Cargo: ${toDisplayValue(cargo, "Sin cargo")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-person-vcard" />
        <span>{`DNI: ${toDisplayValue(getDni(empleado), "N/D")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-telephone" />
        <span>{`Telefono: ${toDisplayValue(telefono, "Sin telefono")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-envelope" />
        <span>{`Correo: ${toDisplayValue(correo, "Sin correo")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-geo-alt" />
        <span>{`Direccion: ${toDisplayValue(direccion, "Sin direccion")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-gender-ambiguous" />
        <span>{`Genero: ${toDisplayValue(genero, "No disponible")}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-cash-stack" />
        <span>{`Sueldo: ${formatSalaryLabel(salario)}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-calendar-event" />
        <span>{`Ingreso: ${formatDateLabel(empleado?.fecha_ingreso)}`}</span>
      </div>
    </EntityCard>
  );
}
