import { createPortal } from 'react-dom';

export default function SucursalFormDrawer({
  open,
  mode,
  form,
  saving,
  onClose,
  onSubmit,
  onFieldChange,
  onImageUpload,
  uploadingImage = false,
  fieldErrors = {},
  duplicateErrors = {},
  disableSubmit = false
}) {
  if (!open) return null;

  const handleImageChange = (event) => {
    onImageUpload?.(event);
  };

  const nombreError = fieldErrors.nombre_sucursal || duplicateErrors.nombre_sucursal || '';
  const direccionError = fieldErrors.texto_direccion || duplicateErrors.texto_direccion || '';

  return createPortal(
    <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!open}>
      <div className="inv-prod-pmodal__overlay" onClick={saving ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create fidelizacion-config-modal suc-form-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suc-form-title"
        >
          <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create" onSubmit={onSubmit}>
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero">
                <div className="inv-ins-create-hero__icon suc-form-hero__icon" aria-hidden="true">
                  <i className="bi bi-shop-window" />
                </div>
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__eyebrow">Sucursales</div>
                  <h3 id="suc-form-title">{mode === 'create' ? 'Nueva sucursal' : 'Editar sucursal'}</h3>
                  <p>Registra la información general, contacto, operación e imagen de la sucursal.</p>
                </div>
                <button
                  type="button"
                  className="inv-prod-drawer-close inv-ins-create-hero__close"
                  onClick={onClose}
                  title="Cerrar"
                  disabled={saving}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              <div className="inv-prod-pmodal__sections">
                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Datos generales</div>
                    <div className="inv-prod-pmodal__section-sub">Identificación base de la sucursal.</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label" htmlFor="suc_nombre">Nombre</label>
                      <input
                        id="suc_nombre"
                        name="nombre_sucursal"
                        className={`form-control ${nombreError ? 'is-invalid' : ''}`}
                        value={form.nombre_sucursal}
                        onChange={onFieldChange}
                        placeholder="Ej: Sucursal Centro"
                      />
                      {nombreError ? <div className="invalid-feedback d-block">{nombreError}</div> : null}
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Ubicación</div>
                    <div className="inv-prod-pmodal__section-sub">Dirección principal de la sucursal.</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label" htmlFor="suc_direccion">Direccion</label>
                      <input
                        id="suc_direccion"
                        name="texto_direccion"
                        className={`form-control ${direccionError ? 'is-invalid' : ''}`}
                        value={form.texto_direccion}
                        onChange={onFieldChange}
                        placeholder="Ej: Siguatepeque, Honduras"
                      />
                      {direccionError ? <div className="invalid-feedback d-block">{direccionError}</div> : null}
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Contacto</div>
                    <div className="inv-prod-pmodal__section-sub">Medios de contacto básicos de la sucursal.</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="suc_telefono">Telefono (opcional)</label>
                      <input
                        id="suc_telefono"
                        name="texto_telefono"
                        className={`form-control ${fieldErrors.texto_telefono ? 'is-invalid' : ''}`}
                        value={form.texto_telefono}
                        onChange={onFieldChange}
                        placeholder="Ej: 33445566"
                      />
                      {fieldErrors.texto_telefono ? <div className="invalid-feedback">{fieldErrors.texto_telefono}</div> : null}
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="suc_correo">Correo (opcional)</label>
                      <input
                        id="suc_correo"
                        name="texto_correo"
                        type="email"
                        className={`form-control ${fieldErrors.texto_correo ? 'is-invalid' : ''}`}
                        value={form.texto_correo}
                        onChange={onFieldChange}
                        placeholder="Ej: admin@sucursal.com"
                      />
                      {fieldErrors.texto_correo ? <div className="invalid-feedback">{fieldErrors.texto_correo}</div> : null}
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Operacion</div>
                    <div className="inv-prod-pmodal__section-sub">Estado y fecha de inauguración.</div>
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="suc_fecha">Fecha de inauguracion (opcional)</label>
                      <input
                        id="suc_fecha"
                        type="date"
                        name="fecha_inauguracion"
                        className={`form-control ${fieldErrors.fecha_inauguracion ? 'is-invalid' : ''}`}
                        value={form.fecha_inauguracion}
                        onChange={onFieldChange}
                      />
                      {fieldErrors.fecha_inauguracion ? <div className="invalid-feedback">{fieldErrors.fecha_inauguracion}</div> : null}
                    </div>
                    <div className="col-12 col-md-6 d-flex align-items-end">
                      <div className="form-check mt-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="suc_estado"
                          name="estado"
                          checked={!!form.estado}
                          onChange={onFieldChange}
                        />
                        <label className="form-check-label" htmlFor="suc_estado">
                          Activo
                        </label>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Imagen</div>
                    <div className="inv-prod-pmodal__section-sub">Carga una imagen.</div>
                  </div>
                  <div className="suc-image-block">
                    <div className="suc-image-block__upload">
                      <label className="form-label" htmlFor="suc_imagen">Imagen de sucursal (opcional)</label>
                      <label className={`suc-image-file-btn ${uploadingImage || saving ? 'is-disabled' : ''}`} htmlFor="suc_imagen">
                        <i className="bi bi-upload" />
                        <span>Seleccionar archivo</span>
                      </label>
                      <input
                        id="suc_imagen"
                        type="file"
                        className="suc-image-file-input"
                        accept="image/png,image/jpeg"
                        onChange={handleImageChange}
                        disabled={uploadingImage || saving}
                      />
                      {uploadingImage ? <div className="text-muted small mt-1">Subiendo imagen...</div> : null}
                    </div>

                    <div className="suc-image-block__preview">
                      {form.imagen_url_publica ? (
                        <div className="suc-form-image-preview">
                          <img
                            src={form.imagen_url_publica}
                            alt="Sucursal"
                            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }}
                          />
                        </div>
                      ) : (
                        <div className="suc-form-image-placeholder h-100 d-flex align-items-center justify-content-center text-center px-3">
                          Sin imagen cargada.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-outline" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={saving || disableSubmit}>
                {saving ? 'Guardando...' : mode === 'create' ? 'Crear sucursal' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
