import { useMemo, useState } from 'react';

export default function CierreCajaEgresoModal({
  open,
  saving,
  sesion,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState({
    monto: '',
    observacion: '',
    referencia: ''
  });

  const isValid = useMemo(() => {
    const monto = Number(form.monto);
    return Number.isFinite(monto) && monto > 0 && form.observacion.trim().length > 0;
  }, [form]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || saving) return;
    await onSubmit({
      monto: Number(form.monto),
      observacion: form.observacion.trim(),
      referencia: form.referencia.trim() || null
    });
  };

  return (
    <div className="ventas-modal-backdrop">
      <section
        className="ventas-modal cierres-caja-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-caja-egreso-title"
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-cash-coin" />
            </span>
            <div>
              <h3 id="cierre-caja-egreso-title">Registrar egreso</h3>
              <p>
                {sesion?.id_sesion_caja
                  ? `Sesion SES-${String(sesion.id_sesion_caja).padStart(5, '0')}`
                  : 'Salida de efectivo'}
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

        <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={handleSubmit}>
          <article className="ventas-page__stat-card is-warning">
            <div className="ventas-page__stat-icon text-warning border-0 bg-white">
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
              rows="4"
              value={form.observacion}
              onChange={(event) => setForm((current) => ({ ...current, observacion: event.target.value }))}
              placeholder="Motivo del egreso..."
            />
          </label>

          <label className="ventas-create-modal__field">
            <span>Referencia opcional</span>
            <input
              value={form.referencia}
              onChange={(event) => setForm((current) => ({ ...current, referencia: event.target.value }))}
              placeholder="Recibo, proveedor o comprobante"
            />
          </label>

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger" disabled={!isValid || saving}>
                {saving ? 'Guardando...' : 'Registrar egreso'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
