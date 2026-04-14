import { useMemo, useState } from 'react';
import { formatCajaCurrency } from '../../utils/cajasHelpers';

const initialForm = Object.freeze({
  monto_declarado_cierre: '',
  id_resolucion_cierre_caja: '',
  observacion_cierre: ''
});

export default function CierreCajaCerrarModal({
  open,
  sesion,
  detalle,
  resoluciones,
  saving,
  canResolveDifference,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => initialForm);
  const montoTeorico = detalle?.resumen_operativo?.efectivo_teorico ?? sesion?.efectivo_teorico ?? 0;

  const previewDifference = useMemo(() => {
    const monto = Number(form.monto_declarado_cierre);
    if (!Number.isFinite(monto)) return null;
    return Number((monto - Number(montoTeorico || 0)).toFixed(2));
  }, [form.monto_declarado_cierre, montoTeorico]);

  const requiresResolution = previewDifference !== null && previewDifference !== 0;
  const isValid = useMemo(() => {
    const monto = Number(form.monto_declarado_cierre);
    if (!Number.isFinite(monto) || monto < 0) return false;
    if (requiresResolution && !form.id_resolucion_cierre_caja) return false;
    if (requiresResolution && !canResolveDifference) return false;
    return true;
  }, [canResolveDifference, form.id_resolucion_cierre_caja, form.monto_declarado_cierre, requiresResolution]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || saving) return;

    await onSubmit({
      monto_declarado_cierre: Number(form.monto_declarado_cierre),
      id_resolucion_cierre_caja: form.id_resolucion_cierre_caja
        ? Number(form.id_resolucion_cierre_caja)
        : null,
      observacion_cierre: form.observacion_cierre.trim() || null
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
              <i className="bi bi-lock-fill" />
            </span>
            <div>
              <h3>Cerrar caja</h3>
              <p>
                {sesion?.id_sesion_caja
                  ? `Sesion SES-${String(sesion.id_sesion_caja).padStart(5, '0')}`
                  : 'Registro de cierre'}
              </p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={handleSubmit}>
          <div className="cierres-caja-action-modal__grid">
            <article className="ventas-page__stat-card is-warning">
              <div className="ventas-page__stat-icon text-warning border-0 bg-white">
                <i className="bi bi-calculator" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Monto teorico</span>
                <strong>L. {formatCajaCurrency(montoTeorico)}</strong>
              </div>
            </article>

            <article className="ventas-page__stat-card is-accent">
              <div className="ventas-page__stat-icon text-danger border-0 bg-white">
                <i className="bi bi-activity" />
              </div>
              <div className="inv-prod-kpi-content">
                <span>Diferencia preliminar</span>
                <strong>
                  {previewDifference === null ? 'Completa el monto' : `L. ${formatCajaCurrency(previewDifference)}`}
                </strong>
              </div>
            </article>
          </div>

          <label className="ventas-create-modal__field">
            <span>Monto declarado de cierre</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.monto_declarado_cierre}
              onChange={(event) =>
                setForm((current) => ({ ...current, monto_declarado_cierre: event.target.value }))
              }
            />
          </label>

          <label className="ventas-create-modal__field">
            <span>Resolucion</span>
            <select
              className="ventas-create-modal__select"
              value={form.id_resolucion_cierre_caja}
              onChange={(event) =>
                setForm((current) => ({ ...current, id_resolucion_cierre_caja: event.target.value }))
              }
              disabled={!requiresResolution}
            >
              <option value="">{requiresResolution ? 'Selecciona una resolucion' : 'No requerida si cuadra'}</option>
              {resoluciones.map((resolucion) => (
                <option key={resolucion.id_resolucion_cierre_caja} value={resolucion.id_resolucion_cierre_caja}>
                  {resolucion.nombre}
                </option>
              ))}
            </select>
          </label>

          {!canResolveDifference && requiresResolution ? (
            <div className="alert alert-warning mb-0">
              El backend exige permiso para resolver diferencias cuando el cierre no cuadra.
            </div>
          ) : null}

          <label className="ventas-create-modal__field">
            <span>Observacion de cierre</span>
            <textarea
              className="ventas-create-modal__note-input"
              rows="4"
              value={form.observacion_cierre}
              onChange={(event) =>
                setForm((current) => ({ ...current, observacion_cierre: event.target.value }))
              }
              placeholder="Observacion opcional del cierre..."
            />
          </label>

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger" disabled={!isValid || saving}>
                {saving ? 'Guardando...' : 'Confirmar cierre'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
