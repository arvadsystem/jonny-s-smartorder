import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatCajaCurrency } from '../../utils/cajasHelpers';

const STEP_ORDER = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'RESUMEN'];

const buildInitialState = () => ({
  EFECTIVO: { monto: '', cantidad_referencias: '', observacion: '' },
  TARJETA: { monto: '', cantidad_referencias: '', observacion: '' },
  TRANSFERENCIA: { monto: '', cantidad_referencias: '', observacion: '' },
  observacion_cierre: ''
});

const normalizeMethodCode = (value) => String(value || '').trim().toUpperCase();

const resolveObservationError = (error) => {
  const code = normalizeMethodCode(error?.code || error?.data?.code);
  if (code !== 'VENTAS_CAJAS_ARQUEO_OBSERVACION_REQUIRED') return null;

  const details = error?.data?.details || error?.details || {};
  const focusMethod = String(details.focus_target || '').split('.')[1] || '';
  const methodCode = normalizeMethodCode(details.metodo_pago_codigo || details.step || focusMethod || 'EFECTIVO');
  if (!STEP_ORDER.includes(methodCode) || methodCode === 'RESUMEN') return null;

  return {
    methodCode,
    message: `Existe diferencia en ${methodCode}. Agrega una observación para continuar.`
  };
};

export default function CierreCajaCerrarModal({
  open,
  sesion,
  saving,
  canViewCajaTheoreticalAmounts = true,
  onClose,
  onSubmit,
  onPreview
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(buildInitialState);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [inlineMethodErrors, setInlineMethodErrors] = useState({});

  const efectivoObservacionRef = useRef(null);
  const tarjetaObservacionRef = useRef(null);
  const transferenciaObservacionRef = useRef(null);
  const previewLoadingRef = useRef(false);
  const previewRequestIdRef = useRef(0);

  const observationRefs = useMemo(() => ({
    EFECTIVO: efectivoObservacionRef,
    TARJETA: tarjetaObservacionRef,
    TRANSFERENCIA: transferenciaObservacionRef
  }), []);

  const step = STEP_ORDER[stepIndex];

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
  }, [form.EFECTIVO.monto, form.TARJETA.monto, form.TRANSFERENCIA.monto]);

  const calculationPayloadKey = useMemo(() => JSON.stringify({
    EFECTIVO: { monto: form.EFECTIVO.monto },
    TARJETA: {
      monto: form.TARJETA.monto,
      cantidad_referencias: form.TARJETA.cantidad_referencias
    },
    TRANSFERENCIA: {
      monto: form.TRANSFERENCIA.monto,
      cantidad_referencias: form.TRANSFERENCIA.cantidad_referencias
    }
  }), [
    form.EFECTIVO.monto,
    form.TARJETA.cantidad_referencias,
    form.TARJETA.monto,
    form.TRANSFERENCIA.cantidad_referencias,
    form.TRANSFERENCIA.monto
  ]);

  const stepValid = useMemo(() => {
    if (step === 'RESUMEN') return true;
    const target = form[step];
    const monto = Number(target.monto);
    if (!Number.isFinite(monto) || monto < 0) return false;

    if (step === 'TARJETA' || step === 'TRANSFERENCIA') {
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

  const buildArqueosPayload = useCallback(() => ({
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
  }), [form]);

  const focusMethodObservation = useCallback((methodCode) => {
    const targetIndex = STEP_ORDER.indexOf(methodCode);
    if (targetIndex >= 0) setStepIndex(targetIndex);
    window.setTimeout(() => {
      const targetRef = observationRefs[methodCode];
      targetRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRef?.current?.focus();
    }, 0);
  }, [observationRefs]);

  const handleExpectedValidationError = useCallback((error, focusOnError = true) => {
    const observationError = resolveObservationError(error);
    if (!observationError) return false;

    setPreviewError('');
    setInlineMethodErrors((current) => ({
      ...current,
      [observationError.methodCode]: observationError.message
    }));
    if (focusOnError) focusMethodObservation(observationError.methodCode);
    return true;
  }, [focusMethodObservation]);

  const runPreview = useCallback(async ({ focusOnError = true } = {}) => {
    if (!canSubmit || typeof onPreview !== 'function' || previewLoadingRef.current) return false;

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    previewLoadingRef.current = true;
    setPreviewLoading(true);
    setPreviewError('');

    try {
      const response = await onPreview(buildArqueosPayload(), { silent: true });
      if (previewRequestIdRef.current !== requestId) return false;
      setPreviewData(response || null);
      setInlineMethodErrors({});
      return true;
    } catch (error) {
      if (previewRequestIdRef.current !== requestId) return false;
      setPreviewData(null);
      if (!handleExpectedValidationError(error, focusOnError)) {
        setPreviewError(error?.message || 'No se pudo calcular la comparación de cierre.');
      }
      return false;
    } finally {
      if (previewRequestIdRef.current === requestId) {
        previewLoadingRef.current = false;
        setPreviewLoading(false);
      }
    }
  }, [buildArqueosPayload, canSubmit, handleExpectedValidationError, onPreview]);

  useEffect(() => {
    if (!open) return;
    previewRequestIdRef.current += 1;
    previewLoadingRef.current = false;
    setPreviewLoading(false);
    setPreviewData(null);
    setPreviewError('');
  }, [calculationPayloadKey, open]);

  useEffect(() => {
    if (!open) {
      previewLoadingRef.current = false;
      previewRequestIdRef.current += 1;
    }
  }, [open]);

  if (!open) return null;

  const setMethodField = (methodCode, field, value) => {
    setForm((current) => ({
      ...current,
      [methodCode]: {
        ...current[methodCode],
        [field]: value
      }
    }));

    if (field === 'observacion') {
      setInlineMethodErrors((current) => {
        if (!current[methodCode]) return current;
        const next = { ...current };
        delete next[methodCode];
        return next;
      });
    }
  };

  const goNext = () => {
    if (!stepValid || stepIndex >= STEP_ORDER.length - 1 || saving || previewLoading) return;
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    if (STEP_ORDER[nextIndex] === 'RESUMEN') {
      void runPreview({ focusOnError: true });
    }
  };

  const goBack = () => {
    if (stepIndex <= 0 || saving || previewLoading) return;
    setStepIndex((current) => current - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || saving || previewLoading) return;

    try {
      if (!previewData) {
        const previewOk = await runPreview({ focusOnError: true });
        if (!previewOk) return;
      }
      await onSubmit(buildArqueosPayload());
    } catch (error) {
      if (!handleExpectedValidationError(error, true)) {
        setPreviewError(error?.message || 'No se pudo registrar el cierre de caja.');
      }
    }
  };

  const requiredObservationCount = Object.keys(inlineMethodErrors).length;

  return (
    <div className="ventas-modal-backdrop">
      <section
        className="ventas-modal cierres-caja-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-caja-title"
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-lock-fill" />
            </span>
            <div>
              <h3 id="cierre-caja-title">Cierre por pasos</h3>
              <p>
                {sesion?.id_sesion_caja
                  ? `Sesión SES-${String(sesion.id_sesion_caja).padStart(5, '0')}`
                  : 'Registro de cierre'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="ventas-modal__close-btn"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={saving || previewLoading}
          >
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
                <span>Observación ({step})</span>
                <textarea
                  ref={observationRefs[step]}
                  className="ventas-create-modal__note-input"
                  rows="3"
                  value={form[step].observacion}
                  onChange={(event) => setMethodField(step, 'observacion', event.target.value)}
                  placeholder={`Observación para ${step.toLowerCase()}...`}
                />
              </label>
              {inlineMethodErrors[step] ? (
                <div className="cierres-caja-inline-error" role="alert">
                  {inlineMethodErrors[step]}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {previewLoading ? (
                <div className="alert alert-info mb-0">Validando cierre...</div>
              ) : null}
              {previewError ? (
                <div className="alert alert-danger mb-0">{previewError}</div>
              ) : null}

              {canViewCajaTheoreticalAmounts && !previewLoading && !previewError && previewData?.arqueos_metodos ? (
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
                          <small className="text-muted fw-semibold">Completado automático en 0</small>
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
                <>
                  <article className="ventas-page__stat-card is-accent">
                    <div className="inv-prod-kpi-content">
                      <span>Total declarado</span>
                      <strong>L. {formatCajaCurrency(previewData?.resumen?.total_declarado ?? declaredSummary.total)}</strong>
                    </div>
                  </article>
                  {!canViewCajaTheoreticalAmounts ? (
                    <>
                      <article className="ventas-page__stat-card is-warning">
                        <div className="inv-prod-kpi-content">
                          <span>Estado</span>
                          <strong>Pendiente de revisión</strong>
                        </div>
                      </article>
                      <article className="ventas-page__stat-card">
                        <div className="inv-prod-kpi-content">
                          <span>Observaciones</span>
                          <strong>{requiredObservationCount > 0 ? 'Faltantes' : 'Completas'}</strong>
                        </div>
                      </article>
                    </>
                  ) : null}
                </>
              )}

              <label className="ventas-create-modal__field">
                <span>Observación general de cierre</span>
                <textarea
                  className="ventas-create-modal__note-input"
                  rows="3"
                  value={form.observacion_cierre}
                  onChange={(event) => setForm((current) => ({ ...current, observacion_cierre: event.target.value }))}
                  placeholder="Observación general opcional..."
                />
              </label>
            </>
          )}

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving || previewLoading}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={saving || previewLoading || stepIndex === 0}>
                Atrás
              </button>
              {step !== 'RESUMEN' ? (
                <button type="button" className="btn btn-danger" onClick={goNext} disabled={!stepValid || saving || previewLoading}>
                  Siguiente
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => void runPreview({ focusOnError: true })}
                    disabled={!canSubmit || saving || previewLoading}
                  >
                    {previewLoading ? 'Validando...' : 'Validar cierre'}
                  </button>
                  <button type="submit" className="btn btn-danger" disabled={!canSubmit || saving || previewLoading}>
                    {saving ? 'Guardando...' : 'Enviar a revisión'}
                  </button>
                </>
              )}
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
