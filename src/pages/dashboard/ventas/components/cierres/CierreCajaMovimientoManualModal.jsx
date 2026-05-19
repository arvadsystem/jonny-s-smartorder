import { useEffect, useMemo, useState } from 'react';

const MOVEMENT_TYPES = {
  INGRESO: {
    title: 'Registrar ingreso',
    subtitle: 'Entrada de efectivo',
    button: 'Registrar ingreso',
    icon: 'bi bi-cash-stack',
    cardClass: 'is-success',
    iconClass: 'text-success',
    buttonClass: 'btn btn-success',
    placeholder: 'Motivo del ingreso...'
  },
  EGRESO: {
    title: 'Registrar egreso',
    subtitle: 'Salida de efectivo',
    button: 'Registrar egreso',
    icon: 'bi bi-cash-coin',
    cardClass: 'is-warning',
    iconClass: 'text-warning',
    buttonClass: 'btn btn-danger',
    placeholder: 'Motivo del egreso...'
  }
};

const normalizeTipo = (value) => (value === 'EGRESO' ? 'EGRESO' : 'INGRESO');

export default function CierreCajaMovimientoManualModal({
  open,
  saving,
  sesion,
  tipoInicial = 'INGRESO',
  lockedTipo = false,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState({
    tipo: normalizeTipo(tipoInicial),
    monto: '',
    observacion: '',
    referencia: ''
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      tipo: normalizeTipo(tipoInicial),
      monto: '',
      observacion: '',
      referencia: ''
    });
  }, [open, tipoInicial]);

  const config = MOVEMENT_TYPES[form.tipo] || MOVEMENT_TYPES.INGRESO;
  const isValid = useMemo(() => {
    const monto = Number(form.monto);
    return Number.isFinite(monto) && monto > 0 && form.observacion.trim().length > 0;
  }, [form]);

  if (!open) return null;

  const handleTipoChange = (tipo) => {
    if (lockedTipo || saving) return;
    setForm((current) => ({ ...current, tipo: normalizeTipo(tipo) }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || saving) return;
    await onSubmit({
      tipo: form.tipo,
      monto: Number(form.monto),
      observacion: form.observacion.trim(),
      referencia: form.referencia.trim() || null
    });
  };

  return (
    <div className="ventas-modal-backdrop">
      <section
        className="ventas-modal cierres-caja-action-modal cierres-caja-movement-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-caja-movimiento-title"
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className={config.icon} />
            </span>
            <div>
              <h3 id="cierre-caja-movimiento-title">{config.title}</h3>
              <p>
                {sesion?.id_sesion_caja
                  ? `Sesión SES-${String(sesion.id_sesion_caja).padStart(5, '0')} - ${config.subtitle}`
                  : config.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ventas-modal__close-btn"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={saving}
          >
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <form className="ventas-modal__body cierres-caja-action-modal__body cierres-caja-movement-modal__body" onSubmit={handleSubmit}>
          <div className="cierres-caja-movement-switch" role="group" aria-label="Tipo de movimiento manual">
            {Object.keys(MOVEMENT_TYPES).map((tipo) => (
              <button
                key={tipo}
                type="button"
                className={`cierres-caja-movement-switch__option ${form.tipo === tipo ? 'is-active' : ''}`}
                onClick={() => handleTipoChange(tipo)}
                disabled={lockedTipo || saving}
                aria-pressed={form.tipo === tipo}
              >
                {tipo === 'INGRESO' ? 'Ingreso' : 'Egreso'}
              </button>
            ))}
          </div>

          <article className={`ventas-page__stat-card cierres-caja-movement-summary ${config.cardClass}`}>
            <div className={`ventas-page__stat-icon ${config.iconClass} border-0 bg-white`}>
              <i className="bi bi-safe2" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Caja</span>
              <strong>{sesion?.nombre_caja || sesion?.codigo_caja || 'Caja activa'}</strong>
              <small className="text-muted">
                No se permite elegir otra caja desde este flujo.
              </small>
            </div>
          </article>

          <label className="ventas-create-modal__field">
            <span>Monto</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.monto}
              onChange={(event) => setForm((current) => ({ ...current, monto: event.target.value }))}
            />
          </label>

          <label className="ventas-create-modal__field">
            <span>Observación</span>
            <textarea
              className="ventas-create-modal__note-input"
              rows="3"
              value={form.observacion}
              onChange={(event) => setForm((current) => ({ ...current, observacion: event.target.value }))}
              placeholder={config.placeholder}
            />
          </label>

          <label className="ventas-create-modal__field">
            <span>Referencia opcional</span>
            <input
              value={form.referencia}
              onChange={(event) => setForm((current) => ({ ...current, referencia: event.target.value }))}
              placeholder="Recibo, comprobante o referencia"
            />
          </label>

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className={config.buttonClass} disabled={!isValid || saving}>
                {saving ? 'Guardando...' : config.button}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
