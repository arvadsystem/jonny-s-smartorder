import { useEffect, useMemo, useState } from 'react';
import { formatCajaCurrency } from '../../utils/cajasHelpers';

const STEP_ORDER = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'RESUMEN'];

const buildInitialState = () => ({
  EFECTIVO: { monto: '', cantidad_referencias: '', observacion: '' },
  TARJETA: { monto: '', cantidad_referencias: '', observacion: '' },
  TRANSFERENCIA: { monto: '', cantidad_referencias: '', observacion: '' },
  observacion_cierre: ''
});

export default function CierreCajaCerrarModal({
  open,
  sesion,
  saving,
  onClose,
  onSubmit,
  onPreview
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(buildInitialState);

  const step = STEP_ORDER[stepIndex];
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewData, setPreviewData] = useState(null);

  const declaredSummary = useMemo(() => {
    const efectivo = Number(form.EFECTIVO.monto || 0);
    const tarjeta = Number(form.TARJETA.monto || 0);
    const transferencia = Number(form.TRANSFERENCIA.monto || 0);
    const total = (Number.isFinite(efectivo) ? efectivo : 0)
      + (Number.isFinite(tarjeta) ? tarjeta : 0)
      + (Number.isFinite(transferencia) ? transferencia : 0);
    return {
      efectivo: Number.isFinite(efectivo) ? efectivo : 0,
      tarjeta: Number.isFinite(tarjeta) ? tarjeta : 0,
      transferencia: Number.isFinite(transferencia) ? transferencia : 0,
      total
    };
  }, [form]);

  const stepValid = useMemo(() => {
    if (step === 'RESUMEN') return true;
    const target = form[step];
    const monto = Number(target.monto);
    if (!Number.isFinite(monto) || monto < 0) return false;

    if ((step === 'TARJETA' || step === 'TRANSFERENCIA')) {
      const refs = Number.parseInt(String(target.cantidad_referencias ?? ''), 10);
      if (!Number.isInteger(refs) || refs < 0) return false;
    }

    return true;
  }, [form, step]);

  const canSubmit = useMemo(() => {
    const methodsValid = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA'].every((code) => {
      const target = form[code];
      const monto = Number(target.monto);
      if (!Number.isFinite(monto) || monto < 0) return false;
      if (code !== 'EFECTIVO') {
        const refs = Number.parseInt(String(target.cantidad_referencias ?? ''), 10);
        if (!Number.isInteger(refs) || refs < 0) return false;
      }
      return true;
    });
    return methodsValid;
  }, [form]);

  const buildArqueosPayload = () => ({
    arqueos: [
      {
        metodo_pago_codigo: 'EFECTIVO',
        monto_declarado: Number(form.EFECTIVO.monto || 0),
        cantidad_referencias: null,
        observacion: form.EFECTIVO.observacion.trim() || null
      },
      {
        metodo_pago_codigo: 'TARJETA',
        monto_declarado: Number(form.TARJETA.monto || 0),
        cantidad_referencias: Number.parseInt(String(form.TARJETA.cantidad_referencias ?? '0'), 10),
        observacion: form.TARJETA.observacion.trim() || null
      },
      {
        metodo_pago_codigo: 'TRANSFERENCIA',
        monto_declarado: Number(form.TRANSFERENCIA.monto || 0),
        cantidad_referencias: Number.parseInt(String(form.TRANSFERENCIA.cantidad_referencias ?? '0'), 10),
        observacion: form.TRANSFERENCIA.observacion.trim() || null
      }
    ],
    observacion_cierre: form.observacion_cierre.trim() || null
  });

  useEffect(() => {
    if (!open || step !== 'RESUMEN' || !canSubmit || typeof onPreview !== 'function') return;
    let cancelled = false;
    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const response = await onPreview(buildArqueosPayload());
        if (cancelled) return;
        setPreviewData(response || null);
      } catch (error) {
        if (cancelled) return;
        setPreviewData(null);
        setPreviewError(
          error?.message || 'No se pudo calcular la comparacion de cierre.'
        );
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [open, step, canSubmit, onPreview, form]);

  if (!open) return null;

  const setMethodField = (methodCode, field, value) => {
    setForm((current) => ({
      ...current,
      [methodCode]: {
        ...current[methodCode],
        [field]: value
      }
    }));
  };

  const goNext = () => {
    if (!stepValid || stepIndex >= STEP_ORDER.length - 1) return;
    setStepIndex((current) => current + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    setStepIndex((current) => current - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || saving) return;
    await onSubmit(buildArqueosPayload());
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
              <h3>Cierre por pasos</h3>
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
          <div className="d-flex align-items-center justify-content-between small text-muted">
            <span>Paso {stepIndex + 1} de {STEP_ORDER.length}</span>
            <span>{step}</span>
          </div>

          {step !== 'RESUMEN' ? (
            <>
              <label className="ventas-create-modal__field">
                <span>Monto declarado ({step})</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[step].monto}
                  onChange={(event) => setMethodField(step, 'monto', event.target.value)}
                />
              </label>

              {step !== 'EFECTIVO' ? (
                <label className="ventas-create-modal__field">
                  <span>{step === 'TARJETA' ? 'Cantidad de vouchers' : 'Cantidad de comprobantes'}</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form[step].cantidad_referencias}
                    onChange={(event) => setMethodField(step, 'cantidad_referencias', event.target.value)}
                  />
                </label>
              ) : null}

              <label className="ventas-create-modal__field">
                <span>Observacion ({step})</span>
                <textarea
                  className="ventas-create-modal__note-input"
                  rows="3"
                  value={form[step].observacion}
                  onChange={(event) => setMethodField(step, 'observacion', event.target.value)}
                  placeholder={`Observacion para ${step.toLowerCase()}...`}
                />
              </label>
            </>
          ) : (
            <>
              {previewLoading ? (
                <div className="alert alert-info mb-0">Calculando comparacion del cierre...</div>
              ) : null}
              {previewError ? (
                <div className="alert alert-danger mb-0">{previewError}</div>
              ) : null}
              {!previewLoading && !previewError && previewData?.arqueos_metodos ? (
                <>
                  {(Array.isArray(previewData.arqueos_metodos) ? previewData.arqueos_metodos : []).map((row) => (
                    <article key={row?.metodo_pago_codigo} className="ventas-page__stat-card is-warning">
                      <div className="inv-prod-kpi-content">
                        <span>{row?.metodo_pago_codigo}</span>
                        <strong>
                          Sistema: L. {formatCajaCurrency(Number(row?.monto_teorico || 0))}
                          {' | '}Declarado: L. {formatCajaCurrency(Number(row?.monto_declarado || 0))}
                          {' | '}Dif: L. {formatCajaCurrency(Number(row?.diferencia || 0))}
                        </strong>
                        {row?.completado_automaticamente ? (
                          <small className="text-muted fw-semibold">Completado automatico en 0</small>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  <article className="ventas-page__stat-card is-accent">
                    <div className="inv-prod-kpi-content">
                      <span>Totales generales</span>
                      <strong>
                        Sistema: L. {formatCajaCurrency(Number(previewData?.resumen?.total_teorico || 0))}
                        {' | '}Declarado: L. {formatCajaCurrency(Number(previewData?.resumen?.total_declarado || 0))}
                        {' | '}Dif: L. {formatCajaCurrency(Number(previewData?.resumen?.diferencia_total || 0))}
                      </strong>
                    </div>
                  </article>
                </>
              ) : (
                <article className="ventas-page__stat-card is-accent">
                  <div className="inv-prod-kpi-content">
                    <span>Total general declarado</span>
                    <strong>L. {formatCajaCurrency(declaredSummary.total)}</strong>
                  </div>
                </article>
              )}
              <label className="ventas-create-modal__field">
                <span>Observacion general de cierre</span>
                <textarea
                  className="ventas-create-modal__note-input"
                  rows="3"
                  value={form.observacion_cierre}
                  onChange={(event) => setForm((current) => ({ ...current, observacion_cierre: event.target.value }))}
                  placeholder="Observacion general opcional..."
                />
              </label>
            </>
          )}

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={saving || stepIndex === 0}>
                Atras
              </button>
              {step !== 'RESUMEN' ? (
                <button type="button" className="btn btn-danger" onClick={goNext} disabled={!stepValid || saving}>
                  Siguiente
                </button>
              ) : (
                <button type="submit" className="btn btn-danger" disabled={!canSubmit || saving || previewLoading}>
                  {saving ? 'Guardando...' : 'Enviar a revision'}
                </button>
              )}
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
