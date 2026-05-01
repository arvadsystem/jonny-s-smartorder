import { useState } from "react";
import EntityCard from "../../../../../components/ui/EntityCard";
import { resolveUserImageSrc } from "./imageSourcePolicy";

const toDisplayValue = (value, fallback = "No registrado") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const isActivo = (usuario) => {
  if (Object.prototype.hasOwnProperty.call(usuario || {}, "estado")) return Boolean(usuario.estado);
  if (Object.prototype.hasOwnProperty.call(usuario || {}, "activo")) return Boolean(usuario.activo);
  if (Object.prototype.hasOwnProperty.call(usuario || {}, "habilitado")) return Boolean(usuario.habilitado);
  return true;
};

const getNombreCompleto = (usuario) =>
  usuario?.empleado?.nombre_completo
  || usuario?.nombre_completo
  || usuario?.cliente?.nombre_completo
  || usuario?.nombre_usuario;

const getSucursal = (usuario) => usuario?.empleado?.sucursal_nombre || usuario?.sucursal_nombre;
const getRolNombre = (usuario) => {
  if (Array.isArray(usuario?.roles) && usuario.roles.length > 0) {
    return usuario.roles
      .map((role) => String(role?.nombre || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return usuario?.rol?.nombre || usuario?.rol_nombre || usuario?.nombre_rol;
};

const getInitials = (fullName) => {
  const clean = String(fullName ?? "").trim();
  if (!clean) return "U";

  const parts = clean
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const first = parts[0]?.charAt(0) || "";
  const second = (parts.length > 1 ? parts[parts.length - 1]?.charAt(0) : "") || "";
  const initials = `${first}${second}`.toUpperCase();
  return initials || first.toUpperCase() || "U";
};

export default function UsuarioCard({
  usuario,
  index,
  onOpenEdit,
  onOpenDelete,
  onOpenDetail,
  canEdit = true,
  canDelete = true,
  canViewDetail = true,
  actionLoading = false,
  deletingId = null,
}) {
  const active = isActivo(usuario);
  const idUsuario = usuario?.id_usuario;
  const deleting = deletingId === idUsuario;
  const nombre = toDisplayValue(getNombreCompleto(usuario), "Usuario sin nombre");
  const sucursal = toDisplayValue(getSucursal(usuario));
  const username = toDisplayValue(usuario?.nombre_usuario, "Sin usuario");
  const foto = String(usuario?.foto_perfil || "").trim();
  const initials = getInitials(nombre);
  const rolNombre = toDisplayValue(getRolNombre(usuario), "-");
  const rolIcon = /admin/i.test(rolNombre) ? "bi-shield-lock" : "bi-person-badge";
  const resolvedPhotoSrc = resolveUserImageSrc(foto);
  const [failedImageSrc, setFailedImageSrc] = useState("");
  const showPhoto = Boolean(resolvedPhotoSrc) && failedImageSrc !== resolvedPhotoSrc;

  return (
    <EntityCard
      index={index}
      iconClass="bi bi-person-badge"
      titleIconClass="bi bi-person-circle"
      titleIconClassName="empleados-title-avatar"
      titleIconNode={
        showPhoto ? (
          <img
            src={resolvedPhotoSrc}
            alt={nombre}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedImageSrc(resolvedPhotoSrc)}
          />
        ) : (
          <span className="empleados-title-avatar__initials">{initials}</span>
        )
      }
      title={`${index + 1}. ${nombre}`}
      subtitle="Registro de usuario"
      badge={active ? "ACTIVO" : "INACTIVO"}
      badgeClass={active ? "is-ok" : "is-inactive"}
      inactive={!active}
      footerLeft={
        <>
          <span className={`inv-catpro-state-dot ${active ? "ok" : "off"}`} />
          <span className="inv-catpro-code">{`USR-${String(idUsuario ?? "-")}`}</span>
        </>
      }
      footerActions={
        <>
          {canViewDetail ? (
            <button
              type="button"
              className="inv-catpro-action inv-catpro-action-compact"
              onClick={() => onOpenDetail?.(usuario)}
              disabled={actionLoading || deleting}
              title="Detalle"
            >
              <i className="bi bi-eye" />
              <span className="inv-catpro-action-label">Detalle</span>
            </button>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              className="inv-catpro-action edit inv-catpro-action-compact"
              onClick={() => onOpenEdit?.(usuario)}
              disabled={actionLoading || deleting}
              title="Editar"
            >
              <i className="bi bi-pencil-square" />
              <span className="inv-catpro-action-label">Editar</span>
            </button>
          ) : null}

          {canDelete ? (
            <button
              type="button"
              className="inv-catpro-action danger inv-catpro-action-compact"
              onClick={() => onOpenDelete?.(usuario)}
              disabled={actionLoading || deleting || !active}
              title={active ? "Inactivar" : "Inactivo"}
              aria-label={deleting ? "Inactivando..." : "Inactivar"}
            >
              <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-slash-circle"}`} />
              <span className="inv-catpro-action-label">{deleting ? "Inactivando..." : "Inactivar"}</span>
            </button>
          ) : null}
        </>
      }
    >
      <div className="personas-page__card-row">
        <i className="bi bi-at" />
        <span>{`Usuario: ${username}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className={`bi ${rolIcon}`} />
        <span>{`Rol: ${rolNombre}`}</span>
      </div>
      <div className="personas-page__card-row">
        <i className="bi bi-shop" />
        <span>{`Sucursal: ${sucursal}`}</span>
      </div>
    </EntityCard>
  );
}
