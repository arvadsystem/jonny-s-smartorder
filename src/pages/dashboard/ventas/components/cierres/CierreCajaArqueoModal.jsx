import { useMemo, useState } from 'react';
import { formatCajaCurrency } from '../../utils/cajasHelpers';

export default function CierreCajaArqueoModal({
  open,
  sesion,
  detalle,
  tiposArqueo,
  saving,
  canViewCajaTheoreticalAmounts = true,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => ({
    id_tipo_arqueo_caja: tiposArqueo[0]?.id_tipo_arqueo_caja ? String(tiposArqueo[0].id_tipo_arqueo_caja) : '',
    monto_contado: '',
    observacion: ''
  }));
  const efectivoTeorico = detalle?.resumen_operativo?.efectivo_teorico ?? sesion?.efectivo_teorico ?? 0;

  const isValid = useMemo(() => {
    const monto = Number(form.monto_contado);
    return Number.isFinite(monto) && monto >= 0 && form.id_tipo_arqueo_caja;
  }, [form]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || saving) return;

    await onSubmit({
      id_tipo_arqueo_caja: Number(form.id_tipo_arqueo_caja),
      monto_contado: Number(form.monto_contado),
      observacion: form.observacion.trim() || null
    });
  };

  return (
    <div className="ventas-modal-backdrop">
      <section
        className="ventas-modal cierres-caja-action-modal"
        role="dialog"
        aria-modal="true"
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-calculator-fill" />
            </span>
            <div>
              <h3>Registrar arqueo</h3>
              <p>
                {sesion?.id_sesion_caja
                  ? `Sesion SES-${String(sesion.id_sesion_caja).padStart(5, '0')}`
                  : 'Arqueo de caja'}
              </p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={handleSubmit}>
          <div className="ventas-page__stat-card is-warning">
            <div className="ventas-page__stat-icon text-warning border-0 bg-white">
              <i className="bi bi-cash-stack" />
            </div>
            <div className="inv-prod-kpi-content">
              {canViewCajaTheoreticalAmounts ? (
                <>
                  <span>Efectivo teorico actual</span>
                  <strong>L. {formatCajaCurrency(efectivoTeorico)}</strong>
                </>
              ) : (
                <>
                  <span>Conteo de efectivo</span>
                  <strong>Registra el efectivo contado.</strong>
                  <small className="text-muted">La comparación será revisada según permisos.</small>
                </>
              )}
            </div>
          </div>

          <div className="cierres-caja-action-modal__grid">
            <label className="ventas-create-modal__field">
              <span>Tipo de arqueo</span>
              <select
                className="ventas-create-modal__select"
                value={form.id_tipo_arqueo_caja}
                onChange={(event) =>
                  setForm((current) => ({ ...current, id_tipo_arqueo_caja: event.target.value }))
                }
              >
                <option value="">Selecciona un tipo</option>
                {tiposArqueo.map((tipo) => (
                  <option key={tipo.id_tipo_arqueo_caja} value={tipo.id_tipo_arqueo_caja}>
                    {tipo.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="ventas-create-modal__field">
              <span>Monto contado</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.monto_contado}
                onChange={(event) =>
                  setForm((current) => ({ ...current, monto_contado: event.target.value }))
                }
              />
            </label>
          </div>

          <label className="ventas-create-modal__field">
            <span>Observacion</span>
            <textarea
              className="ventas-create-modal__note-input"
              rows="4"
              value={form.observacion}
              onChange={(event) =>
                setForm((current) => ({ ...current, observacion: event.target.value }))
              }
              placeholder="Detalle breve del arqueo..."
            />
          </label>

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger" disabled={!isValid || saving}>
                {saving ? 'Guardando...' : 'Registrar arqueo'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
