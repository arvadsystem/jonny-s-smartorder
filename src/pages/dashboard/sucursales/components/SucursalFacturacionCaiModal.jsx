import { createPortal } from 'react-dom';

const normalizeText = (value) => String(value ?? '').trim();
const toPositiveInt = (value) => Number.parseInt(String(value ?? ''), 10);
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
const today = () => new Date().toISOString().slice(0, 10);

const buildErrors = (form) => {
  const errors = {};
  const cai = normalizeText(form?.cai);
  const numeroDesde = toPositiveInt(form?.numero_desde);
  const numeroHasta = toPositiveInt(form?.numero_hasta);
  const fechaLimite = normalizeText(form?.fecha_limite_emision);
  const observacion = normalizeText(form?.observacion);

  if (!cai) errors.cai = 'El CAI es obligatorio.';
  if (!Number.isInteger(numeroDesde) || numeroDesde <= 0) errors.numero_desde = 'Ingresa un numero desde valido.';
  if (!Number.isInteger(numeroHasta) || numeroHasta <= 0) errors.numero_hasta = 'Ingresa un numero hasta valido.';
  if (Number.isInteger(numeroDesde) && Number.isInteger(numeroHasta) && numeroHasta < numeroDesde) {
    errors.numero_hasta = 'El numero hasta debe ser mayor o igual al numero desde.';
  }
  if (!fechaLimite || !isValidDate(fechaLimite)) {
    errors.fecha_limite_emision = 'La fecha limite es obligatoria.';
  } else if (fechaLimite < today()) {
    errors.fecha_limite_emision = 'La fecha limite no puede estar vencida.';
  }
  if (observacion && observacion.length > 250) errors.observacion = 'La observacion permite maximo 250 caracteres.';

  return errors;
};

const toPayload = (form) => ({
  cai: normalizeText(form?.cai),
  numero_desde: toPositiveInt(form?.numero_desde),
  numero_hasta: toPositiveInt(form?.numero_hasta),
  fecha_limite_emision: normalizeText(form?.fecha_limite_emision),
  observacion: normalizeText(form?.observacion) || null
});

const formatDate = (value) => {
  if (!value) return 'No definida';
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString('es-HN');
};

export default function SucursalFacturacionCaiModal({
  open,
  sucursalNombre = '',
  rangos = [],
  loading = false,
  saving = false,
  processingId = null,
  canManage = false,
  form = {},
  onChangeForm,
  onClose,
  onSubmit,
  onActivar,
  onDesactivar
}) {
  if (!open) return null;
  const errors = buildErrors(form);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (Object.keys(errors).length > 0 || !canManage) return;
    onSubmit?.(toPayload(form));
  };

  return createPortal(
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={saving ? undefined : onClose}>
      <div className="inv-pro-confirm-panel" style={{ maxWidth: 920 }} onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon"><i className="bi bi-upc-scan" /></div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Facturacion fiscal</div>
              <div className="inv-pro-confirm-title">Rangos CAI - {sucursalNombre || 'Sucursal'}</div>
              <div className="inv-pro-confirm-sub">Gestion de rangos autorizados por sucursal.</div>
            </div>
          </div>
          <button type="button" className="inv-pro-confirm-close" onClick={onClose} disabled={saving}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-pro-confirm-body">
          {loading ? (
            <div className="inv-catpro-loading my-3" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm me-2" />
              Cargando rangos CAI...
            </div>
          ) : (
            <>
              <div className="table-responsive mb-3">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>CAI</th>
                      <th>Desde</th>
                      <th>Hasta</th>
                      <th>Actual</th>
                      <th>Fecha limite</th>
                      <th>Estado</th>
                      <th>Observacion</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(rangos) && rangos.length > 0 ? rangos.map((item) => {
                      const id = Number(item?.id_rango_cai ?? 0);
                      const estado = String(item?.estado || 'INACTIVO').toUpperCase();
                      const isProcessing = Number(processingId) === id;
                      return (
                        <tr key={id}>
                          <td>{item?.cai || 'N/D'}</td>
                          <td>{Number(item?.numero_desde ?? 0)}</td>
                          <td>{Number(item?.numero_hasta ?? 0)}</td>
                          <td>{Number(item?.numero_actual ?? 0)}</td>
                          <td>{formatDate(item?.fecha_limite_emision)}</td>
                          <td>
                            <span className={`badge text-bg-${estado === 'ACTIVO' ? 'success' : 'secondary'}`}>{estado}</span>
                          </td>
                          <td>{item?.observacion || 'Sin observacion'}</td>
                          <td className="text-end">
                            <div className="d-inline-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success"
                                disabled={!canManage || isProcessing || estado === 'ACTIVO'}
                                onClick={() => onActivar?.(id)}
                              >
                                Activar
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-warning"
                                disabled={!canManage || isProcessing || estado !== 'ACTIVO'}
                                onClick={() => onDesactivar?.(id)}
                              >
                                Desactivar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-3">
                          No hay rangos CAI registrados para esta sucursal.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={handleSubmit}>
                <h6 className="mb-2">Crear nuevo rango CAI</h6>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">CAI</label>
                    <input
                      className={`form-control ${errors.cai ? 'is-invalid' : ''}`}
                      value={form?.cai || ''}
                      onChange={(e) => onChangeForm?.('cai', e.target.value)}
                      disabled={!canManage || saving}
                    />
                    {errors.cai ? <div className="invalid-feedback">{errors.cai}</div> : null}
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Numero desde</label>
                    <input
                      type="number"
                      min="1"
                      className={`form-control ${errors.numero_desde ? 'is-invalid' : ''}`}
                      value={String(form?.numero_desde ?? '')}
                      onChange={(e) => onChangeForm?.('numero_desde', e.target.value)}
                      disabled={!canManage || saving}
                    />
                    {errors.numero_desde ? <div className="invalid-feedback">{errors.numero_desde}</div> : null}
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label">Numero hasta</label>
                    <input
                      type="number"
                      min="1"
                      className={`form-control ${errors.numero_hasta ? 'is-invalid' : ''}`}
                      value={String(form?.numero_hasta ?? '')}
                      onChange={(e) => onChangeForm?.('numero_hasta', e.target.value)}
                      disabled={!canManage || saving}
                    />
                    {errors.numero_hasta ? <div className="invalid-feedback">{errors.numero_hasta}</div> : null}
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Fecha limite de emision</label>
                    <input
                      type="date"
                      className={`form-control ${errors.fecha_limite_emision ? 'is-invalid' : ''}`}
                      value={form?.fecha_limite_emision || ''}
                      onChange={(e) => onChangeForm?.('fecha_limite_emision', e.target.value)}
                      disabled={!canManage || saving}
                    />
                    {errors.fecha_limite_emision ? <div className="invalid-feedback">{errors.fecha_limite_emision}</div> : null}
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label">Observacion</label>
                    <input
                      className={`form-control ${errors.observacion ? 'is-invalid' : ''}`}
                      value={form?.observacion || ''}
                      onChange={(e) => onChangeForm?.('observacion', e.target.value)}
                      disabled={!canManage || saving}
                    />
                    {errors.observacion ? <div className="invalid-feedback">{errors.observacion}</div> : null}
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="submit"
                    className="btn btn-outline-primary"
                    disabled={!canManage || saving || Object.keys(errors).length > 0}
                  >
                    {saving ? 'Guardando...' : 'Crear rango'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        <div className="inv-pro-confirm-footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={onClose} disabled={saving}>Cerrar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
