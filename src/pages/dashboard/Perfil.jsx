import { useEffect, useMemo, useRef, useState } from "react";
import { perfilService } from "../../services/perfilService";
import { API_URL } from "../../utils/constants";
import { fmtHN } from "../../utils/dateTime";
import "./perfil-page.css";
import "./perfil-toast.css";

const PHOTO_URL_RE = /^(https?:\/\/|\/uploads\/|data:image\/)/i;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PROFILE_IMAGE_BYTES = 6 * 1024 * 1024;

const normalizeText = (value) => String(value ?? "").trim();

const getApiOrigin = () => {
  const clean = normalizeText(API_URL);
  if (!clean) return "";

  try {
    return new URL(clean).origin;
  } catch {
    return clean.replace(/\/+$/, "");
  }
};

const resolveProfilePhotoSrc = (value) => {
  const photo = normalizeText(value);
  if (!photo || !PHOTO_URL_RE.test(photo)) return "";
  if (/^data:image\//i.test(photo)) return photo;
  if (/^https?:\/\//i.test(photo)) return photo;
  if (/^\/uploads\//i.test(photo)) {
    const origin = getApiOrigin();
    return origin ? `${origin}${photo}` : photo;
  }
  return "";
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });

const Perfil = () => {
  const imageInputRef = useRef(null);
  const [roles, setRoles] = useState([]);
  const [ultimo, setUltimo] = useState(null);
  const [sesionesTotales, setSesionesTotales] = useState(0);
  const [usuarioSesion, setUsuarioSesion] = useState("");
  const [cuentaVerificada, setCuentaVerificada] = useState(true);
  const [fotoPerfil, setFotoPerfil] = useState("");
  const [fotoPerfilDraft, setFotoPerfilDraft] = useState("");
  const [fotoPerfilDirty, setFotoPerfilDirty] = useState(false);
  const [fotoProcesando, setFotoProcesando] = useState(false);
  const [fotoError, setFotoError] = useState("");
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // Form editar perfil
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    direccion: "",
  });
  const [perfilVisible, setPerfilVisible] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    direccion: "",
  });

  const cargar = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await perfilService.getPerfil();
      setRoles(res?.roles || []);
      setUltimo(res?.ultimo_acceso || null);
      setSesionesTotales(Number(res?.sesiones_totales) || 0);

      const p = res?.perfil || {};
      setUsuarioSesion(p.nombre_usuario || "");
      setCuentaVerificada(
        p.estado === undefined || p.estado === null ? true : Boolean(p.estado)
      );
      setFotoPerfil(p.foto_perfil || "");
      setPerfilVisible({
        nombre: p.nombre || "",
        apellido: p.apellido || "",
        telefono: p.telefono || "",
        email: p.email || "",
        direccion: p.direccion || "",
      });
      setForm({
        nombre: p.nombre || "",
        apellido: p.apellido || "",
        telefono: p.telefono || "",
        email: p.email || "",
        direccion: p.direccion || "",
      });
    } catch (e) {
      setError(e?.message || "Error cargando perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!showSaveConfirm) return undefined;
    const timer = setTimeout(() => setShowSaveConfirm(false), 3200);
    return () => clearTimeout(timer);
  }, [showSaveConfirm]);

  const avatarImageSrc = useMemo(() => resolveProfilePhotoSrc(fotoPerfil), [fotoPerfil]);
  const avatarDraftImageSrc = useMemo(() => resolveProfilePhotoSrc(fotoPerfilDraft), [fotoPerfilDraft]);

  const handleAvatarEditClick = () => {
    if (fotoProcesando) return;
    setFotoError("");
    setFotoPerfilDraft(fotoPerfil || "");
    setFotoPerfilDirty(false);
    setShowAvatarModal(true);
  };

  const handleCloseAvatarModal = () => {
    if (fotoProcesando) return;
    setFotoError("");
    setFotoPerfilDraft("");
    setFotoPerfilDirty(false);
    setShowAvatarModal(false);
  };

  const handleAvatarFileChange = async (event) => {
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;

    setFotoError("");

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setFotoError("Solo se permiten imagenes JPG, PNG o WEB.");
      if (input) input.value = "";
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_BYTES) {
      setFotoError("La imagen supera el limite de 6 MB.");
      if (input) input.value = "";
      return;
    }

    setFotoProcesando(true);
    try {
      const photoDataUrl = await readFileAsDataUrl(file);
      setFotoPerfilDraft(photoDataUrl);
      setFotoPerfilDirty(true);
    } catch (e) {
      setFotoError(e?.message || "No se pudo procesar la imagen de perfil.");
    } finally {
      setFotoProcesando(false);
      if (input) input.value = "";
    }
  };

  const handleRemoveAvatarImage = () => {
    if (fotoProcesando) return;
    setFotoError("");
    const hadStoredPhoto = normalizeText(fotoPerfil) !== "";
    const hasDraftPhoto = normalizeText(fotoPerfilDraft) !== "";
    if (!hadStoredPhoto && !hasDraftPhoto) return;
    setFotoPerfilDraft("");
    setFotoPerfilDirty(true);
  };

  const handleSaveAvatarChanges = async () => {
    if (fotoProcesando || !fotoPerfilDirty) return;
    setFotoError("");
    setFotoProcesando(true);
    try {
      const nextPhoto = normalizeText(fotoPerfilDraft);
      await perfilService.updatePerfil({ foto_perfil: nextPhoto });
      setFotoPerfil(nextPhoto);
      setShowAvatarModal(false);
      setFotoPerfilDraft("");
      setFotoPerfilDirty(false);
      setShowSaveConfirm(true);
      await cargar();
    } catch (e) {
      setFotoError(e?.message || "No se pudo actualizar la imagen de perfil.");
    } finally {
      setFotoProcesando(false);
    }
  };

  const onSavePerfil = async () => {
    try {
      await perfilService.updatePerfil(form);
      setShowSaveConfirm(true);
      await cargar();
    } catch (e) {
      alert(e?.message || "No se pudo actualizar el perfil");
    }
  };

  const nombreCompleto = useMemo(() => {
    const value = `${perfilVisible.nombre || ""} ${perfilVisible.apellido || ""}`.trim();
    return value || "Usuario";
  }, [perfilVisible.nombre, perfilVisible.apellido]);

  const iniciales = useMemo(() => {
    const parts = nombreCompleto
      .split(" ")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) return "US";
    return parts.map((value) => value[0]).join("").toUpperCase();
  }, [nombreCompleto]);

  const resumenCorreo = perfilVisible.email?.trim() ? perfilVisible.email.trim() : "Correo no registrado";
  const identidadEnLinea = useMemo(() => {
    const nombre = String(nombreCompleto || "").trim();
    if (nombre && nombre !== "Usuario") return nombre;
    return "Usuario conectado";
  }, [nombreCompleto]);

  if (loading) {
    return (
      <div className="p-4 perfil-page">
        <div className="perfil-page__shell">
          <div className="card shadow-sm perfil-panel">
            <div className="card-body perfil-page__state">
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              Cargando perfil...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 perfil-page">
        <div className="perfil-page__shell">
          <div className="card shadow-sm perfil-panel">
            <div className="card-body">
              <div className="alert alert-danger mb-3">{error}</div>
              <button className="btn btn-outline-danger btn-sm" onClick={cargar}>
                Reintentar carga
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 perfil-page">
      {showSaveConfirm && (
        <div className="perfil-save-toast" role="status" aria-live="polite">
          <div className="perfil-save-toast__body">
            <div className="perfil-save-toast__icon" aria-hidden="true">
              <i className="bi bi-check-circle-fill" />
            </div>
            <div className="perfil-save-toast__copy">
              <div className="perfil-save-toast__title">ACTUALIZADO</div>
              <div className="perfil-save-toast__subtitle">Perfil actualizado correctamente</div>
            </div>
            <button
              type="button"
              className="perfil-save-toast__close"
              onClick={() => setShowSaveConfirm(false)}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      )}

      {showAvatarModal && (
        <div
          className="perfil-avatar-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Editar imagen de perfil"
          onClick={handleCloseAvatarModal}
        >
          <div className="perfil-avatar-modal" onClick={(event) => event.stopPropagation()}>
            <div className="perfil-avatar-modal__head">
              <h4>Imagen de perfil</h4>
              <button
                type="button"
                className="perfil-avatar-modal__close"
                onClick={handleCloseAvatarModal}
                aria-label="Cerrar modal"
                disabled={fotoProcesando}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className={`perfil-avatar-modal__preview ${avatarDraftImageSrc ? "has-image" : ""}`}>
              {fotoProcesando ? (
                <div className="perfil-avatar-modal__loading" role="status">
                  <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  <span>Procesando imagen...</span>
                </div>
              ) : avatarDraftImageSrc ? (
                <img src={avatarDraftImageSrc} alt={`Foto de perfil de ${nombreCompleto}`} referrerPolicy="no-referrer" />
              ) : (
                <div className="perfil-avatar-modal__placeholder">
                  <i className="bi bi-image" />
                  <span>Sin imagen seleccionada</span>
                </div>
              )}
            </div>

            <div className="perfil-avatar-modal__actions">
              <label className="perfil-avatar-modal__btn perfil-avatar-modal__btn--primary">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarFileChange}
                  disabled={fotoProcesando}
                />
                <i className="bi bi-upload" />
                <span>{avatarDraftImageSrc ? "Cambiar imagen" : "Seleccionar imagen"}</span>
              </label>

              <button
                type="button"
                className="perfil-avatar-modal__btn perfil-avatar-modal__btn--danger"
                onClick={handleRemoveAvatarImage}
                disabled={fotoProcesando || !avatarDraftImageSrc}
              >
                Quitar
              </button>
            </div>

            <div className="perfil-avatar-modal__confirm-actions">
              <button
                type="button"
                className="perfil-avatar-modal__confirm-btn perfil-avatar-modal__confirm-btn--cancel"
                onClick={handleCloseAvatarModal}
                disabled={fotoProcesando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="perfil-avatar-modal__confirm-btn perfil-avatar-modal__confirm-btn--save"
                onClick={handleSaveAvatarChanges}
                disabled={fotoProcesando || !fotoPerfilDirty}
              >
                Guardar cambios
              </button>
            </div>

            {fotoError ? (
              <div className="perfil-avatar-modal__error">{fotoError}</div>
            ) : (
              <div className="perfil-avatar-modal__hint">JPG, PNG o WEB hasta 6 MB.</div>
            )}
          </div>
        </div>
      )}

      <div className="perfil-page__shell">
        <div className="card shadow-sm perfil-panel perfil-panel--total perfil-page__hero mb-3">
          <div className="card-body">
            <div className="perfil-page__hero-main">
              <div className="perfil-page__avatar-wrap">
                <div className="perfil-page__avatar" aria-hidden="true">
                  {avatarImageSrc ? (
                    <img
                      src={avatarImageSrc}
                      alt={`Foto de perfil de ${nombreCompleto}`}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    iniciales
                  )}
                </div>
                <button
                  type="button"
                  className="perfil-page__avatar-edit-btn"
                  onClick={handleAvatarEditClick}
                  disabled={fotoProcesando}
                  aria-label="Editar imagen de perfil"
                  title="Editar imagen"
                >
                  <i className={`bi ${fotoProcesando ? "bi-arrow-repeat" : "bi-pencil-fill"}`} />
                </button>
              </div>
              <div>
                <h3 className="mb-1">Mi perfil</h3>
                <p className="text-muted mb-0">
                  Administre su información.
                </p>
              </div>
            </div>

            <div className="perfil-page__hero-stats">
              <div className="perfil-page__hero-stat perfil-page__hero-stat--total">
                <div className="perfil-page__hero-stat-head">
                  <div className="perfil-page__hero-stat-label perfil-page__online-label">
                    <span className="perfil-page__online-dot" aria-hidden="true"></span>
                    EN LÍNEA
                  </div>
                  <i className="bi bi-wifi perfil-page__stat-icon perfil-page__stat-icon--online" aria-hidden="true" />
                </div>
                <div className="perfil-page__hero-stat-value">{identidadEnLinea}</div>
              </div>

              <div className="perfil-page__hero-stat perfil-page__hero-stat--ok">
                <div className="perfil-page__hero-stat-head">
                  <div className="perfil-page__hero-stat-label">Estado</div>
                  <i
                    className={`bi ${cuentaVerificada ? "bi-check-circle-fill" : "bi-x-circle-fill"} perfil-page__stat-icon ${cuentaVerificada ? "perfil-page__stat-icon--ok" : "perfil-page__stat-icon--off"}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="perfil-page__hero-stat-value">{cuentaVerificada ? "Activo" : "Inactivo"}</div>
                <div className="perfil-page__hero-stat-note">{cuentaVerificada ? "Cuenta verificada" : "Cuenta no verificada"}</div>
              </div>

              <div className="perfil-page__hero-stat perfil-page__hero-stat--warn">
                <div className="perfil-page__hero-stat-head">
                  <div className="perfil-page__hero-stat-label">Sesiones totales</div>
                  <i className="bi bi-clock-history perfil-page__stat-icon perfil-page__stat-icon--sessions" aria-hidden="true" />
                </div>
                <div className="perfil-page__hero-stat-number">{sesionesTotales}</div>
                <div className="perfil-page__hero-stat-note">Este mes</div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3 align-items-start">
          <div className="col-12 col-xl-8">
            <div className="card shadow-sm perfil-panel perfil-panel--total">
              <div className="card-body">
                <div className="perfil-panel__header">
                  <div>
                    <h5 className="mb-1">Información personal</h5>
                    <p className="text-muted mb-0 small">
                      Actualice sus datos de contacto y dirección para mantener la cuenta al día.
                    </p>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Nombre</label>
                    <input
                      className="form-control"
                      value={form.nombre}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, nombre: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Apellido</label>
                    <input
                      className="form-control"
                      value={form.apellido}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, apellido: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Teléfono</label>
                    <input
                      className="form-control"
                      value={form.telefono}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, telefono: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Email</label>
                    <input
                      className="form-control"
                      value={form.email}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, email: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Dirección</label>
                    <input
                      className="form-control"
                      value={form.direccion}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, direccion: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end mt-3">
                  <button className="btn btn-primary perfil-page__save-btn" onClick={onSavePerfil}>
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-4">
            <div className="d-grid gap-3">
              <div className="card shadow-sm perfil-panel perfil-panel--total">
                <div className="card-body">
                  <h6 className="perfil-side__title">Resumen de usuario</h6>
                  <div className="perfil-side__name">{nombreCompleto}</div>
                  <div className="perfil-side__email">{resumenCorreo}</div>

                  <div className="perfil-side__rows mt-3">
                    <div className="perfil-side__row">
                      <span>Teléfono</span>
                      <strong>{perfilVisible.telefono?.trim() || "-"}</strong>
                    </div>
                    <div className="perfil-side__row">
                      <span>Dirección</span>
                      <strong>{perfilVisible.direccion?.trim() || "-"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card shadow-sm perfil-panel perfil-panel--ok">
                <div className="card-body">
                  <h6 className="perfil-side__title">Roles asignados</h6>
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {roles.map((r) => (
                      <span className="badge rounded-pill perfil-page__role-badge" key={r.id_rol}>
                        {r.nombre}
                      </span>
                    ))}
                    {roles.length === 0 && <span className="text-muted small">Sin roles asignados.</span>}
                  </div>
                </div>
              </div>

              <div className="card shadow-sm perfil-panel perfil-panel--warn">
                <div className="card-body">
                  <h6 className="perfil-side__title">Sesión actual</h6>
                  {ultimo ? (
                    <ul className="list-unstyled mb-0 small perfil-side__access-list">
                      <li>
                        <span>Fecha:</span>
                        <strong>{fmtHN(ultimo.fecha_hora)}</strong>
                      </li>
                      <li>
                        <span>IP:</span>
                        <strong>{ultimo.ip_origen || "-"}</strong>
                      </li>
                      <li>
                        <span>Navegador:</span>
                        <strong>{ultimo.navegador || "-"}</strong>
                      </li>
                      <li>
                        <span>SO:</span>
                        <strong>{ultimo.sistema_operativo || "-"}</strong>
                      </li>
                      <li>
                        <span>Dispositivo:</span>
                        <strong>{ultimo.dispositivo || "-"}</strong>
                      </li>
                    </ul>
                  ) : (
                    <div className="text-muted small">No hay registros de acceso aún.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;


