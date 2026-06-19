import { createPortal } from 'react-dom';
import AppSelect from '../../../../components/common/AppSelect';

const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PREFIX_RE = /^[A-Za-z0-9_-]+$/;
const TICKET_WIDTH_OPTIONS = [58, 80];
const TICKET_WIDTH_SELECT_OPTIONS = TICKET_WIDTH_OPTIONS.map((width) => ({
  value: String(width),
  label: `${width}mm`
}));

const normalizeText = (value) => String(value ?? '').trim();
const CONTENT_FLAGS = [
  ['mostrar_datos_fiscales', 'Mostrar datos fiscales'],
  ['mostrar_rtn', 'Mostrar RTN emisor'],
  ['mostrar_direccion', 'Mostrar dirección'],
  ['mostrar_telefono', 'Mostrar contacto'],
  ['mostrar_correo', 'Mostrar correo'],
  ['mostrar_cai_ticket', 'Mostrar CAI'],
  ['mostrar_numero_fiscal_ticket', 'Mostrar número fiscal'],
  ['mostrar_codigo_interno_ticket', 'Mostrar código interno']
];
const TAX_FLAGS = [
  ['aplicar_impuestos', 'Aplicar impuestos en venta'],
  ['mostrar_impuestos_ticket', 'Mostrar impuestos en ticket'],
  ['mostrar_importe_exento', 'Mostrar importe exento'],
  ['mostrar_importe_gravado_15', 'Mostrar importe gravado 15%'],
  ['mostrar_isv_15', 'Mostrar ISV 15%'],
  ['mostrar_importe_gravado_18', 'Mostrar importe gravado 18%'],
  ['mostrar_isv_18', 'Mostrar ISV 18%'],
  ['mostrar_total_isv', 'Mostrar total ISV']
];
const DISCOUNT_FLAGS = [
  ['mostrar_descuento_linea', 'Mostrar descuento por línea'],
  ['mostrar_descuento_porcentaje_linea', 'Mostrar porcentaje de descuento'],
  ['mostrar_descuento_total', 'Mostrar descuento total']
];
const REVERSION_FLAGS = [
  ['imprimir_comprobante_reversion', 'Imprimir comprobante de reversión'],
  ['mostrar_venta_original_reversion', 'Mostrar venta original'],
  ['mostrar_codigo_reversion', 'Mostrar código de reversión'],
  ['mostrar_usuario_reversion', 'Mostrar usuario que reversa'],
  ['mostrar_caja_sesion_reversion', 'Mostrar caja/sesión'],
  ['mostrar_motivo_reversion', 'Mostrar motivo'],
  ['mostrar_detalle_reversion', 'Mostrar detalle de productos'],
  ['mostrar_total_reversion', 'Mostrar total reversado']
];
const ALL_PRINT_FLAGS = [
  ...CONTENT_FLAGS,
  ...TAX_FLAGS,
  ...DISCOUNT_FLAGS,
  ...REVERSION_FLAGS
].map(([field]) => field);

const buildValidationErrors = (form) => {
  const errors = {};
  if (!normalizeText(form?.nombre_emisor)) errors.nombre_emisor = 'El nombre emisor es obligatorio.';

  const correo = normalizeText(form?.correo_emisor);
  if (correo && !VALID_EMAIL_RE.test(correo)) errors.correo_emisor = 'Ingresa un correo válido.';

  const ancho = Number(form?.ancho_ticket_mm);
  if (!TICKET_WIDTH_OPTIONS.includes(ancho)) errors.ancho_ticket_mm = 'Selecciona 58mm u 80mm.';

  const longitud = Number(form?.longitud_correlativo);
  if (!Number.isInteger(longitud) || longitud < 3 || longitud > 10) {
    errors.longitud_correlativo = 'La longitud debe estar entre 3 y 10.';
  }

  const prefijoVenta = normalizeText(form?.prefijo_venta);
  if (!prefijoVenta) errors.prefijo_venta = 'El prefijo de venta es obligatorio.';
  else if (prefijoVenta.length > 10 || !VALID_PREFIX_RE.test(prefijoVenta)) {
    errors.prefijo_venta = 'Usa máximo 10 caracteres: letras, números, guion o guion bajo.';
  }

  const prefijoReversion = normalizeText(form?.prefijo_reversion);
  if (!prefijoReversion) errors.prefijo_reversion = 'El prefijo de reversión es obligatorio.';
  else if (prefijoReversion.length > 10 || !VALID_PREFIX_RE.test(prefijoReversion)) {
    errors.prefijo_reversion = 'Usa máximo 10 caracteres: letras, números, guion o guion bajo.';
  }

  return errors;
};

const toPayload = (form) => ({
  nombre_emisor: normalizeText(form?.nombre_emisor),
  rtn_emisor: normalizeText(form?.rtn_emisor) || null,
  direccion_emisor: normalizeText(form?.direccion_emisor) || null,
  telefono_emisor: normalizeText(form?.telefono_emisor) || null,
  correo_emisor: normalizeText(form?.correo_emisor) || null,
  logo_url: normalizeText(form?.logo_url) || null,
  id_archivo_logo: Number(form?.id_archivo_logo ?? 0) > 0 ? Number(form.id_archivo_logo) : null,
  texto_encabezado_ticket: normalizeText(form?.texto_encabezado_ticket) || null,
  texto_pie_ticket: normalizeText(form?.texto_pie_ticket) || null,
  ancho_ticket_mm: Number(form?.ancho_ticket_mm),
  prefijo_venta: normalizeText(form?.prefijo_venta),
  prefijo_reversion: normalizeText(form?.prefijo_reversion),
  longitud_correlativo: Number(form?.longitud_correlativo),
  reinicio_diario: Boolean(form?.reinicio_diario),
  modo_fiscal: String(form?.modo_fiscal || ''),
  mostrar_logo_ticket: Boolean(form?.mostrar_logo_ticket),
  mostrar_rtn: Boolean(form?.mostrar_rtn),
  mostrar_direccion: Boolean(form?.mostrar_direccion),
  mostrar_telefono: Boolean(form?.mostrar_telefono),
  mostrar_correo: Boolean(form?.mostrar_correo),
  ...ALL_PRINT_FLAGS.reduce((acc, field) => ({
    ...acc,
    [field]: Boolean(form?.[field])
  }), {}),
  activo: Boolean(form?.activo)
});

export default function SucursalFacturacionConfigDrawer({
  open,
  sucursalNombre = '',
  form,
  onChange,
  saving = false,
  logoPreviewUrl = '',
  logoUploading = false,
  logoError = '',
  onLogoFileChange,
  onLogoRemove,
  onClose,
  onSubmit
}) {
  if (!open) return null;
  const errors = buildValidationErrors(form);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0) return;
    onSubmit?.(toPayload(form));
  };

  const setBooleanField = (event) => {
    const { name, checked } = event.target;
    onChange?.(name, checked);
  };

  const setValueField = (event) => {
    const { name, value } = event.target;
    onChange?.(name, value);
  };

  return createPortal(
    <>
      <div
        className="inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop show"
        onClick={saving || logoUploading ? undefined : onClose}
        aria-hidden="true"
      />
      <aside
        className="inv-prod-drawer inv-cat-v2__drawer suc-filters-drawer suc-facturacion-drawer show"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-receipt inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Configurar sucursal</div>
            <div className="inv-prod-drawer-sub">{sucursalNombre || 'Sucursal'}</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={onClose} disabled={saving || logoUploading} title="Cerrar">
                  <i className="bi bi-x-lg" />
                </button>
              </div>

        <form className="suc-facturacion-drawer__form" onSubmit={handleSubmit}>
          <div className="inv-prod-drawer-body inv-cat-v2__drawer-body suc-facturacion-drawer__body">
              <div className="inv-prod-pmodal__sections">
                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Datos del emisor</div>
                  <div className="row g-3 mt-1">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Nombre emisor</label>
                      <input className={`form-control ${errors.nombre_emisor ? 'is-invalid' : ''}`} name="nombre_emisor" value={form.nombre_emisor || ''} onChange={setValueField} />
                      {errors.nombre_emisor ? <div className="invalid-feedback">{errors.nombre_emisor}</div> : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">RTN</label>
                      <input className="form-control" name="rtn_emisor" value={form.rtn_emisor || ''} onChange={setValueField} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Dirección</label>
                      <input className="form-control" name="direccion_emisor" value={form.direccion_emisor || ''} onChange={setValueField} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Teléfono</label>
                      <input className="form-control" name="telefono_emisor" value={form.telefono_emisor || ''} onChange={setValueField} />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Correo</label>
                      <input type="email" className={`form-control ${errors.correo_emisor ? 'is-invalid' : ''}`} name="correo_emisor" value={form.correo_emisor || ''} onChange={setValueField} />
                      {errors.correo_emisor ? <div className="invalid-feedback">{errors.correo_emisor}</div> : null}
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Configuración fiscal</div>
                  <div className="row g-3 mt-1">
                    <div className="col-12 col-md-4">
                      <AppSelect
                        label="Ticket"
                        value={String(form.ancho_ticket_mm ?? 80)}
                        options={TICKET_WIDTH_SELECT_OPTIONS}
                        onChange={(value) => setValueField({ target: { name: 'ancho_ticket_mm', value } })}
                        placeholder="Selecciona ancho"
                        error={errors.ancho_ticket_mm || ''}
                        className="suc-app-select"
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Prefijo venta</label>
                      <input className={`form-control ${errors.prefijo_venta ? 'is-invalid' : ''}`} name="prefijo_venta" value={form.prefijo_venta || ''} onChange={setValueField} />
                      {errors.prefijo_venta ? <div className="invalid-feedback">{errors.prefijo_venta}</div> : null}
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Prefijo reversión</label>
                      <input className={`form-control ${errors.prefijo_reversion ? 'is-invalid' : ''}`} name="prefijo_reversion" value={form.prefijo_reversion || ''} onChange={setValueField} />
                      {errors.prefijo_reversion ? <div className="invalid-feedback">{errors.prefijo_reversion}</div> : null}
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Longitud correlativo</label>
                      <input type="number" min="3" max="10" className={`form-control ${errors.longitud_correlativo ? 'is-invalid' : ''}`} name="longitud_correlativo" value={String(form.longitud_correlativo ?? 5)} onChange={setValueField} />
                      {errors.longitud_correlativo ? <div className="invalid-feedback">{errors.longitud_correlativo}</div> : null}
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label">Modo fiscal</label>
                      <input className="form-control" value="No integrado" readOnly disabled />
                    </div>
                    <div className="col-12 col-md-4 d-flex align-items-end">
                      <div className="form-check">
                        <input id="fac_activo" className="form-check-input" type="checkbox" name="activo" checked={Boolean(form.activo)} onChange={setBooleanField} />
                        <label className="form-check-label" htmlFor="fac_activo">Configuración activa</label>
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label">Encabezado ticket</label>
                      <input className="form-control" name="texto_encabezado_ticket" value={form.texto_encabezado_ticket || ''} onChange={setValueField} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Pie ticket</label>
                      <input className="form-control" name="texto_pie_ticket" value={form.texto_pie_ticket || ''} onChange={setValueField} />
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Opciones visuales</div>
                  <div className="row g-2 mt-1">
                    {[
                      ['reinicio_diario', 'Reinicio diario'],
                      ['mostrar_logo_ticket', 'Mostrar logo'],
                      ['mostrar_rtn', 'Mostrar RTN'],
                      ['mostrar_direccion', 'Mostrar dirección'],
                      ['mostrar_telefono', 'Mostrar teléfono'],
                      ['mostrar_correo', 'Mostrar correo']
                    ].map(([field, label]) => (
                      <div className="col-12 col-md-6" key={field}>
                        <div className="form-check">
                          <input id={`fac_${field}`} className="form-check-input" type="checkbox" name={field} checked={Boolean(form[field])} onChange={setBooleanField} />
                          <label className="form-check-label" htmlFor={`fac_${field}`}>{label}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Imagen de factura</div>
                  <div className="suc-fact-logo-field">
                    <div className="suc-fact-logo-field__preview">
                      {logoPreviewUrl ? (
                        <img src={logoPreviewUrl} alt="Logo de facturación" />
                      ) : (
                        <div className="suc-fact-logo-field__placeholder">
                          <i className="bi bi-image" aria-hidden="true" />
                          <span>Sin imagen</span>
                        </div>
                      )}
                    </div>
                    <div className="suc-fact-logo-field__actions">
                      <input
                        id="fac_logo_file"
                        className="suc-image-file-input"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={onLogoFileChange}
                        disabled={saving || logoUploading}
                      />
                      <label
                        className={`suc-image-file-btn ${saving || logoUploading ? 'is-disabled' : ''}`}
                        htmlFor="fac_logo_file"
                      >
                        <i className={`bi ${logoUploading ? 'bi-arrow-repeat' : 'bi-upload'}`} aria-hidden="true" />
                        <span>{logoUploading ? 'Subiendo...' : logoPreviewUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}</span>
                      </label>
                      {form.id_archivo_logo || logoPreviewUrl ? (
                        <button
                          type="button"
                          className="btn inv-prod-btn-subtle suc-fact-logo-field__remove"
                          onClick={onLogoRemove}
                          disabled={saving || logoUploading}
                        >
                          <i className="bi bi-trash3" aria-hidden="true" />
                          <span>Quitar</span>
                        </button>
                      ) : null}
                    </div>
                    {logoError ? <div className="suc-app-select__error">{logoError}</div> : null}
                    <div className="suc-app-select__helper">JPG, PNG o WEBP. Máximo 10 MB.</div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Contenido del ticket</div>
                  <div className="row g-2 mt-1">
                    {CONTENT_FLAGS.map(([field, label]) => (
                      <div className="col-12 col-md-6" key={field}>
                        <div className="form-check">
                          <input id={`fac_${field}`} className="form-check-input" type="checkbox" name={field} checked={Boolean(form[field])} onChange={setBooleanField} />
                          <label className="form-check-label" htmlFor={`fac_${field}`}>{label}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Impuestos</div>
                  <div className="alert alert-warning py-2 mb-2">
                    Los impuestos siguen desactivados temporalmente aunque estos controles queden preparados.
                  </div>
                  <div className="row g-2 mt-1">
                    {TAX_FLAGS.map(([field, label]) => (
                      <div className="col-12 col-md-6" key={field}>
                        <div className="form-check">
                          <input id={`fac_${field}`} className="form-check-input" type="checkbox" name={field} checked={Boolean(form[field])} onChange={setBooleanField} />
                          <label className="form-check-label" htmlFor={`fac_${field}`}>{label}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Descuentos</div>
                  <div className="row g-2 mt-1">
                    {DISCOUNT_FLAGS.map(([field, label]) => (
                      <div className="col-12 col-md-6" key={field}>
                        <div className="form-check">
                          <input id={`fac_${field}`} className="form-check-input" type="checkbox" name={field} checked={Boolean(form[field])} onChange={setBooleanField} />
                          <label className="form-check-label" htmlFor={`fac_${field}`}>{label}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-title">Comprobante de reversión</div>
                  <div className="row g-2 mt-1">
                    {REVERSION_FLAGS.map(([field, label]) => (
                      <div className="col-12 col-md-6" key={field}>
                        <div className="form-check">
                          <input id={`fac_${field}`} className="form-check-input" type="checkbox" name={field} checked={Boolean(form[field])} onChange={setBooleanField} />
                          <label className="form-check-label" htmlFor={`fac_${field}`}>{label}</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions suc-facturacion-drawer__actions">
              <button type="button" className="btn inv-prod-btn-outline" onClick={onClose} disabled={saving || logoUploading}>Cancelar</button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={saving || logoUploading || Object.keys(errors).length > 0}>
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </form>
      </aside>
    </>,
    document.body
  );
}
