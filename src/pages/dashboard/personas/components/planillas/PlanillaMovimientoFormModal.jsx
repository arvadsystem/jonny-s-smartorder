import { useEffect, useState } from 'react';

export default function PlanillaMovimientoFormModal({
  open,
  tipo = 'bono',
  item,
  loading = false,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState({
    concepto: '',
    monto: '',
    observacion: ''
  });

  useEffect(() => {
    if (!open) return;
    setForm({ concepto: '', monto: '', observacion: '' });
  }, [open, tipo]);

  if (!open || !item) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const monto = Number(form.monto);
    if (!form.concepto.trim() || !Number.isFinite(monto) || monto <= 0) return;

    onSubmit?.({
      tipo,
      concepto: form.concepto.trim(),
      monto,
      observacion: form.observacion.trim() || null
    });
  };

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="planillas-modal" onClick={(event) => event.stopPropagation()}>
        <div className="planillas-modal__head">
          <div>
            <h5>{tipo === 'deduccion' ? 'Registrar deduccion' : 'Registrar bono'}</h5>
            <p>{item.nombre_completo || item.empleado_nombre || 'Empleado seleccionado'}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="planillas-form-grid" onSubmit={handleSubmit}>
          <div>
            <label className="form-label">Concepto</label>
            <input
              type="text"
              className="form-control"
              value={form.concepto}
              onChange={(event) => setForm((state) => ({ ...state, concepto: event.target.value }))}
              maxLength={120}
              required
            />
          </div>

          <div>
            <label className="form-label">Monto</label>
            <input
              type="number"
              className="form-control"
              value={form.monto}
              onChange={(event) => setForm((state) => ({ ...state, monto: event.target.value }))}
              min="0.01"
              step="0.01"
              required
            />
          </div>

          <div className="planillas-form-grid__full">
            <label className="form-label">Observacion</label>
            <textarea
              className="form-control"
              value={form.observacion}
              onChange={(event) => setForm((state) => ({ ...state, observacion: event.target.value }))}
              rows={3}
              maxLength={250}
            />
          </div>

          <div className="planillas-form-grid__actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
