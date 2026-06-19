import { useEffect, useMemo, useRef, useState } from 'react';

const INITIAL_FORM = {
  monto_apertura: '',
  observacion_apertura: ''
};

const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
};

export default function VentaCajaAbrirSesionModal({
  open,
  assignment,
  saving,
  errorMessage,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [localError, setLocalError] = useState('');
  const [localSaving, setLocalSaving] = useState(false);
  const submitRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setLocalError('');
      setLocalSaving(false);
      submitRef.current = false;
    }
  }, [open]);

  const montoApertura = useMemo(() => toMoneyNumber(form.monto_apertura), [form.monto_apertura]);
  const isSubmitting = saving || localSaving;
  const canSubmit = montoApertura !== null && !isSubmitting;

  if (!open || !assignment) return null;

  const cajaLabel = assignment.nombre_caja || assignment.codigo_caja || `Caja #${assignment.id_caja}`;

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setLocalError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitRef.current || saving) return;
    if (montoApertura === null) {
      setLocalError('Monto de apertura debe ser un número mayor o igual a 0.');
      return;
    }

    submitRef.current = true;
    setLocalSaving(true);
    try {
      await onSubmit({
        monto_apertura: montoApertura,
        observacion_apertura: form.observacion_apertura.trim() || null
      });
    } finally {
      submitRef.current = false;
      setLocalSaving(false);
    }
  };

  return (
    <div className="ventas-modal-backdrop ventas-caja-apertura-backdrop" role="presentation">
      <section
        className="ventas-modal-card ventas-caja-apertura-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-caja-apertura-title"
      >
        <header className="ventas-modal-header ventas-caja-apertura-modal__header">
          <div>
            <h5 id="ventas-caja-apertura-title">Abrir sesión</h5>
            <p>Tienes asignada la caja {cajaLabel}.</p>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={isSubmitting} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <form className="ventas-modal-body ventas-caja-apertura-modal__body" onSubmit={handleSubmit}>
          <div className="ventas-caja-apertura-modal__assigned">
            <div>
              <span>Código / número</span>
              <strong>{assignment.codigo_caja || `Caja #${assignment.id_caja}`}</strong>
            </div>
            <div>
              <span>Nombre de caja</span>
              <strong>{assignment.nombre_caja || 'Caja asignada'}</strong>
            </div>
            <div>
              <span>Sucursal</span>
              <strong>{assignment.nombre_sucursal || 'Sucursal asignada'}</strong>
            </div>
          </div>

          <label className="ventas-create-modal__field">
            <span>Monto de apertura</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monto_apertura}
              onChange={(event) => setField('monto_apertura', event.target.value)}
              placeholder="0.00"
              disabled={isSubmitting}
              autoFocus
            />
          </label>

          <label className="ventas-create-modal__field">
            <span>Observación de apertura</span>
            <textarea
              className="ventas-create-modal__note-input"
              rows="3"
              value={form.observacion_apertura}
              onChange={(event) => setField('observacion_apertura', event.target.value)}
              placeholder="Detalle operativo opcional..."
              disabled={isSubmitting}
            />
          </label>

          {localError || errorMessage ? (
            <div className="ventas-create-modal__error">{localError || errorMessage}</div>
          ) : null}

          <footer className="ventas-modal-footer d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {isSubmitting ? 'Abriendo...' : 'Abrir sesión'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
