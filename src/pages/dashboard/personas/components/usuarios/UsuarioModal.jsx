import { useMemo } from 'react';
import './usuarios-modal.css';

const toDisplayValue = (value, fallback = 'No registrado') => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

export default function UsuarioModal({
  open = false,
  mode = 'create',
  form,
  errors,
  onFieldChange,
  onSubmit,
  onClose,
  onResetPassword,
  createCredentialsResult,
  actionLoading = false,
  resetPasswordLoading = false,
  deletingId = null,
  catalogLoading = false,
  rolesLoading = false,
  filteredEmpleadoOptions = [],
  empleadosConUsuario,
  generatedUsernamePreview = '',
  empleadoDisplayName = '',
  usernameDisplay = '',
  sortedRoles = [],
  formImage,
  formImageUrl = '',
  imageInputRef,
  onFormImageChange,
  onFormImageUrlChange,
  onRemoveImage,
  canCreate = true,
  canEdit = true,
  canResetPassword = true,
  canEditPhoto = true,
}) {
  const isCreate = mode === 'create';
  const isOpen = Boolean(open);

  const employeeOptions = useMemo(
    () => (Array.isArray(filteredEmpleadoOptions) ? filteredEmpleadoOptions : []),
    [filteredEmpleadoOptions]
  );

  const roleOptions = useMemo(
    () => (Array.isArray(sortedRoles) ? sortedRoles : []),
    [sortedRoles]
  );

  const createDisabled =
    actionLoading
    || !!deletingId
    || catalogLoading
    || rolesLoading
    || !form?.id_empleado
    || !form?.id_rol
    || !canCreate;

  const handleClose = () => {
    if (typeof document !== 'undefined') {
      const activeElement = document.activeElement;
      if (activeElement && typeof activeElement.blur === 'function') {
        activeElement.blur();
      }
    }
    onClose?.();
  };

  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer usuarios-modal ${isOpen ? 'show' : ''} ${isCreate ? 'is-create' : 'is-edit'}`}
      id="usr-form-drawer"
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen ? 'true' : undefined}
      inert={!isOpen ? '' : undefined}
    >
      <div className="inv-prod-drawer-head usuarios-modal__header">
        <div className="usuarios-modal__title-wrap">
          <div className="inv-prod-drawer-title usuarios-modal__title">{isCreate ? 'Nuevo Usuario' : 'Editar Usuario'}</div>
          <div className="inv-prod-drawer-sub usuarios-modal__subtitle">Completa los campos y guarda los cambios.</div>
        </div>
        <button type="button" className="inv-prod-drawer-close usuarios-modal__close" onClick={handleClose} title="Cerrar">
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite usuarios-modal__body" onSubmit={onSubmit}>
        <div className="row g-3 mt-0 usuarios-modal__grid">
          {isCreate ? (
            <>
              <div className="col-12 usuarios-modal__section usuarios-modal__section--first">
                <label className="form-label fw-semibold usuarios-modal__label">Empleado</label>
                <select
                  className={`form-select usuarios-modal__input ${errors?.id_empleado ? 'is-invalid' : ''}`}
                  value={form?.id_empleado || ''}
                  onChange={(e) => onFieldChange?.('id_empleado', e.target.value)}
                  disabled={catalogLoading}
                >
                  <option value="">Seleccione empleado</option>
                  {employeeOptions.map((item) => {
                    const linked = empleadosConUsuario?.has?.(String(item.id));
                    return (
                      <option key={item.id} value={item.id} disabled={linked}>
                        {item.nombre_completo} {item.dni ? `| DNI: ${item.dni}` : ''} | {item.correo || 'Sin correo'}
                        {linked ? ' (ya tiene usuario)' : ''}
                      </option>
                    );
                  })}
                </select>
                {errors?.id_empleado ? <div className="invalid-feedback d-block">{errors.id_empleado}</div> : null}
              </div>

              <div className="col-12 usuarios-modal__section">
                <label className="form-label fw-semibold usuarios-modal__label">Nombre de usuario (Autogenerado)</label>
                <input
                  type="text"
                  className="form-control usuarios-modal__input"
                  value={generatedUsernamePreview || 'Se generará al seleccionar un empleado'}
                  readOnly
                />
              </div>

              <div className="col-12 usuarios-modal__section">
                <label className="form-label fw-semibold usuarios-modal__label">Rol</label>
                <select
                  className={`form-select usuarios-modal__input ${errors?.id_rol ? 'is-invalid' : ''}`}
                  value={form?.id_rol || ''}
                  onChange={(e) => onFieldChange?.('id_rol', e.target.value)}
                  disabled={rolesLoading || !canCreate}
                >
                  <option value="">Seleccione rol</option>
                  {roleOptions.map((rol) => (
                    <option key={rol.id_rol} value={rol.id_rol}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
                {errors?.id_rol ? <div className="invalid-feedback d-block">{errors.id_rol}</div> : null}
              </div>
            </>
          ) : (
            <>
              <div className="col-12 usuarios-modal__section usuarios-modal__section--first">
                <label className="form-label fw-semibold usuarios-modal__label">Empleado</label>
                <input
                  type="text"
                  className="form-control usuarios-modal__input"
                  value={toDisplayValue(empleadoDisplayName)}
                  readOnly
                />
              </div>
              <div className="col-12 usuarios-modal__section">
                <label className="form-label fw-semibold usuarios-modal__label">Nombre de usuario</label>
                <input
                  type="text"
                  className="form-control usuarios-modal__input"
                  value={toDisplayValue(usernameDisplay, 'Sin usuario')}
                  readOnly
                />
              </div>
              <div className="col-12 usuarios-modal__section">
                <label className="form-label fw-semibold usuarios-modal__label">Rol</label>
                <select
                  className={`form-select usuarios-modal__input ${errors?.id_rol ? 'is-invalid' : ''}`}
                  value={form?.id_rol || ''}
                  onChange={(e) => onFieldChange?.('id_rol', e.target.value)}
                  disabled={rolesLoading || !canEdit}
                >
                  <option value="">Seleccione rol</option>
                  {roleOptions.map((rol) => (
                    <option key={rol.id_rol} value={rol.id_rol}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
                {errors?.id_rol ? <div className="invalid-feedback d-block">{errors.id_rol}</div> : null}
              </div>
            </>
          )}

          {!isCreate ? (
            <div className="col-12 usuarios-modal__section">
              <div className="usuarios-modal__switch-row">
                <label className="usuarios-modal__switch-label fw-semibold" htmlFor="usuario_estado_modal">
                  Usuario Activo
                </label>
                <label className="usuarios-modal__switch" htmlFor="usuario_estado_modal">
                  <input
                    className="usuarios-modal__switch-input"
                    type="checkbox"
                    id="usuario_estado_modal"
                    checked={Boolean(form?.estado)}
                    onChange={(e) => onFieldChange?.('estado', e.target.checked)}
                    disabled={!canEdit}
                  />
                  <span className="usuarios-modal__switch-track">
                    <span className="usuarios-modal__switch-thumb">
                      <i className="bi bi-check-lg" />
                    </span>
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          <div className="col-12 usuarios-modal__section">
            <label className="form-label fw-semibold usuarios-modal__label">Imagen de perfil</label>
            <div className={`inv-prod-image-field personas-emp-form-image usuarios-modal__image-box ${formImage?.loading ? 'is-loading' : ''}`}>
              <div className={`inv-prod-image-preview usuarios-modal__image-preview ${formImage?.previewUrl ? 'has-image' : ''}`} aria-live="polite">
                {formImage?.loading ? (
                  <div className="inv-prod-image-loading" role="status">
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                    <span>Procesando imagen...</span>
                  </div>
                ) : formImage?.previewUrl ? (
                  <img src={formImage.previewUrl} alt="Vista previa del usuario" referrerPolicy="no-referrer" />
                ) : (
                  <div className="inv-prod-image-placeholder usuarios-modal__image-placeholder">
                    <i className="bi bi-image" />
                    <span>Sin imagen seleccionada</span>
                  </div>
                )}
              </div>

              <div className="inv-prod-image-actions usuarios-modal__image-actions">
                <label className="btn inv-prod-btn-subtle inv-prod-image-picker usuarios-modal__btn-upload">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onFormImageChange}
                    disabled={actionLoading || resetPasswordLoading || !canEditPhoto}
                  />
                  <i className="bi bi-upload" />
                  <span>{formImage?.previewUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
                </label>
                <button
                  type="button"
                  className="btn inv-prod-btn-outline usuarios-modal__btn-remove"
                  onClick={onRemoveImage}
                  disabled={!formImage?.previewUrl && !formImage?.error && !formImage?.loading || !canEditPhoto}
                >
                  Quitar
                </button>
              </div>

              <div className="mt-2 usuarios-modal__url-wrap">
                <label className="form-label usuarios-modal__url-label">URL de imagen (opcional)</label>
                <input
                  type="url"
                  className="form-control usuarios-modal__input"
                  placeholder="/uploads/... o https://tu-backend/uploads/..."
                  value={formImageUrl}
                  onChange={onFormImageUrlChange}
                  disabled={formImage?.loading || actionLoading || resetPasswordLoading || !canEditPhoto}
                />
              </div>

              {formImage?.error ? (
                <div className="inv-prod-image-feedback is-error">{formImage.error}</div>
              ) : (
                <div className="inv-prod-image-feedback usuarios-modal__hint">
                  JPG, PNG o WEBP hasta 20 MB.
                </div>
              )}
            </div>
          </div>

          {isCreate && createCredentialsResult?.nombre_usuario ? (
            <div className="col-12 usuarios-modal__section">
              <div className="usuarios-modal__result-box is-success">
                <div className="usuarios-modal__result-row">
                  <span>Usuario generado:</span>
                  <strong>{createCredentialsResult.nombre_usuario}</strong>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="d-flex gap-2 mt-4 usuarios-modal__footer">
          <button
            type="button"
            className="btn inv-prod-btn-subtle flex-fill usuarios-modal__btn-cancel"
            onClick={handleClose}
            disabled={actionLoading || resetPasswordLoading || !!deletingId}
          >
            Cancelar
          </button>

          {!isCreate && canResetPassword ? (
            <button
              type="button"
              className="btn inv-prod-btn-outline flex-fill usuarios-modal__btn-reset"
              onClick={onResetPassword}
              disabled={actionLoading || resetPasswordLoading || !!deletingId}
            >
              {resetPasswordLoading ? 'Reseteando...' : 'Generar nueva contraseña temporal'}
            </button>
          ) : null}

          <button
            type="submit"
            className="btn inv-prod-btn-primary flex-fill usuarios-modal__btn-submit"
            disabled={
              isCreate
                ? createDisabled
                : (actionLoading || resetPasswordLoading || !!deletingId || catalogLoading || rolesLoading || !canEdit)
            }
          >
            {actionLoading
              ? (isCreate ? 'Generando...' : 'Guardando...')
              : (isCreate ? 'Generar usuario y contraseña temporal' : 'Guardar')}
          </button>
        </div>
      </form>
    </aside>
  );
}
