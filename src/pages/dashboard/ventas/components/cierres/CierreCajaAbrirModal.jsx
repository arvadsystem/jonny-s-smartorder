import { useMemo, useState } from 'react';

const initialForm = Object.freeze({
  id_caja: '',
  monto_apertura: '',
  observacion_apertura: ''
});

export default function CierreCajaAbrirModal({
  open,
  cajasDisponibles,
  saving,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => initialForm);

  const isValid = useMemo(() => {
    const monto = Number(form.monto_apertura);
    return Boolean(form.id_caja) && Number.isFinite(monto) && monto >= 0;
  }, [form.id_caja, form.monto_apertura]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || saving) return;

    await onSubmit({
      id_caja: Number(form.id_caja),
      monto_apertura: Number(form.monto_apertura),
      observacion_apertura: form.observacion_apertura.trim() || null
    });
  };

  return (
    <div className="ventas-modal-backdrop" onClick={onClose}>
      <section
        className="ventas-modal cierres-caja-action-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-safe2-fill" />
            </span>
            <div>
              <h3>Nueva caja operativa</h3>
              <p>Abre sesion sobre una caja existente.</p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={handleSubmit}>
          <div className="cierres-caja-open-note">
            <i className="bi bi-info-circle" />
            <span>
              El backend actual no expone alta de entidad <code>caja</code>. Esta accion abre una sesion para una
              caja ya registrada en catalogo.
            </span>
          </div>

          <label className="ventas-create-modal__field">
            <span>Caja existente</span>
            <select
              className="ventas-create-modal__select"
              value={form.id_caja}
              onChange={(event) =>
                setForm((current) => ({ ...current, id_caja: event.target.value }))
              }
            >
              <option value="">Selecciona una caja</option>
              {cajasDisponibles.map((caja) => (
                <option key={caja.id_caja} value={caja.id_caja}>
                  {caja.nombre_caja} ({caja.codigo_caja || 'Sin codigo'})
                </option>
              ))}
            </select>
          </label>

          <label className="ventas-create-modal__field">
            <span>Monto de apertura</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monto_apertura}
              onChange={(event) =>
                setForm((current) => ({ ...current, monto_apertura: event.target.value }))
              }
              placeholder="0.00"
            />
          </label>

          <label className="ventas-create-modal__field">
            <span>Observacion de apertura</span>
            <textarea
              className="ventas-create-modal__note-input"
              rows="4"
              value={form.observacion_apertura}
              onChange={(event) =>
                setForm((current) => ({ ...current, observacion_apertura: event.target.value }))
              }
              placeholder="Detalle operativo opcional..."
            />
          </label>

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger" disabled={!isValid || saving}>
                {saving ? 'Guardando...' : 'Abrir sesion'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
