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

  const nombreError = fieldErrors.nombre_sucursal || duplicateErrors.nombre_sucursal || '';
  const direccionError = fieldErrors.texto_direccion || duplicateErrors.texto_direccion || '';

  return createPortal(
    <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!open}>
      <div className="inv-prod-pmodal__overlay" onClick={saving ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create fidelizacion-config-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suc-form-title"
        >
          <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create" onSubmit={onSubmit}>
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero">
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__eyebrow">Sucursales</div>
                  <h3 id="suc-form-title">{mode === 'create' ? 'Nueva sucursal' : 'Editar sucursal'}</h3>
                  <p>Completa los datos generales, horario e imagen de la sucursal.</p>
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
                    <div className="inv-prod-pmodal__section-title">Datos principales</div>
                    <div className="inv-prod-pmodal__section-sub">Identificacion y contacto base de la sucursal.</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-md-6">
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

                    <div className="col-12 col-md-6">
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
                    <div className="inv-prod-pmodal__section-sub">Horario de atencion y fecha base.</div>
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="suc_hora_inicio">Hora inicio</label>
                      <input
                        id="suc_hora_inicio"
                        type="time"
                        name="hora_inicio"
                        className={`form-control ${fieldErrors.hora_inicio ? 'is-invalid' : ''}`}
                        value={form.hora_inicio || ''}
                        onChange={onFieldChange}
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label" htmlFor="suc_hora_final">Hora final</label>
                      <input
                        id="suc_hora_final"
                        type="time"
                        name="hora_final"
                        className={`form-control ${fieldErrors.hora_final ? 'is-invalid' : ''}`}
                        value={form.hora_final || ''}
                        onChange={onFieldChange}
                      />
                      {fieldErrors.hora_final ? <div className="invalid-feedback d-block">{fieldErrors.hora_final}</div> : null}
                    </div>
                    <div className="col-12 col-md-4">
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
                    <div className="col-12">
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
                    <div className="inv-prod-pmodal__section-sub">La imagen se guarda en Supabase Storage (bucket jonnys-assets).</div>
                  </div>
                  <div className="row g-3">
                    <div className="col-12 col-lg-6">
                      <label className="form-label" htmlFor="suc_imagen">Imagen de sucursal (opcional)</label>
                      <input
                        id="suc_imagen"
                        type="file"
                        className="form-control"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={onImageUpload}
                        disabled={uploadingImage || saving}
                      />
                      {uploadingImage ? <div className="text-muted small mt-1">Subiendo imagen...</div> : null}
                    </div>
                    <div className="col-12 col-lg-6">
                      {form.imagen_url_publica ? (
                        <div className="border rounded-3 p-2 bg-white">
                          <img
                            src={form.imagen_url_publica}
                            alt="Sucursal"
                            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }}
                          />
                        </div>
                      ) : (
                        <div className="border rounded-3 p-3 bg-light text-muted small h-100 d-flex align-items-center">
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
