import { createPortal } from 'react-dom';

const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PREFIX_RE = /^[A-Za-z0-9_-]+$/;
const TICKET_WIDTH_OPTIONS = [58, 80];

const normalizeText = (value) => String(value ?? '').trim();

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
  activo: Boolean(form?.activo)
});

export default function SucursalFacturacionConfigDrawer({
  open,
  sucursalNombre = '',
  form,
  onChange,
  saving = false,
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
    <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!open}>
      <div className="inv-prod-pmodal__overlay" onClick={saving ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create fidelizacion-config-modal" role="dialog" aria-modal="true">
          <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create" onSubmit={handleSubmit}>
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero">
                <div className="inv-ins-create-hero__icon suc-form-hero__icon" aria-hidden="true">
                  <i className="bi bi-receipt" />
                </div>
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__eyebrow">Facturación</div>
                  <h3 className="mb-1">Configurar sucursal</h3>
                  <p className="mb-0">{sucursalNombre || 'Sucursal'}</p>
                </div>
                <button type="button" className="inv-prod-drawer-close inv-ins-create-hero__close" onClick={onClose} disabled={saving}>
                  <i className="bi bi-x-lg" />
                </button>
              </div>

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
                      <label className="form-label">Ticket</label>
                      <select className={`form-select ${errors.ancho_ticket_mm ? 'is-invalid' : ''}`} name="ancho_ticket_mm" value={String(form.ancho_ticket_mm ?? 80)} onChange={setValueField}>
                        {TICKET_WIDTH_OPTIONS.map((width) => <option key={width} value={String(width)}>{width}mm</option>)}
                      </select>
                      {errors.ancho_ticket_mm ? <div className="invalid-feedback">{errors.ancho_ticket_mm}</div> : null}
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
              </div>
            </div>
            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-outline" onClick={onClose} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={saving || Object.keys(errors).length > 0}>
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
