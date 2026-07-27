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
const resolveApiErrorCode = (error) => String(error?.data?.code || error?.code || '').trim();
const resolveApiErrorDetails = (error) => error?.data?.details || error?.details || {};
const resolveApiErrorMessage = (error, fallback) =>
  String(error?.data?.message || error?.message || fallback || '').trim() || fallback;

const formatApiError = (error, fallback) => {
  const code = resolveApiErrorCode(error);
  const message = resolveApiErrorMessage(error, fallback);
  return code ? `Código ${code}: ${message}` : message;
};

const STALE_FIELD_LABELS = Object.freeze({
  cantidad_cobros: 'cantidad de cobros',
  max_id_factura_cobro: 'último cobro',
  total_cobros: 'total cobrado',
  cantidad_movimientos: 'cantidad de movimientos',
  max_id_movimiento_caja: 'último movimiento',
  total_ingresos_manuales: 'ingresos manuales',
  total_egresos_manuales: 'egresos manuales',
  cantidad_reversiones: 'cantidad de reversiones',
  max_id_reversion: 'última reversión',
  total_reversado: 'total revertido',
  efectivo_teorico: 'efectivo del sistema',
  tarjeta_teorico: 'tarjeta del sistema',
  transferencia_teorico: 'transferencia del sistema',
  total_teorico: 'total del sistema'
});

const resolveStaleNotice = (error) => {
  const details = resolveApiErrorDetails(error);
  const changedFields = Array.isArray(details.campos_cambiados)
    ? details.campos_cambiados
    : (Array.isArray(details.campos) ? details.campos : []);
  const labels = [...new Set(changedFields.map((field) => {
    const normalized = String(field || '').trim();
    if (normalized.startsWith('catalogo_') || normalized.startsWith('CATALOGO.')) return 'catálogo financiero';
    return STALE_FIELD_LABELS[normalized] || null;
  }).filter(Boolean))];
  const suffix = labels.length > 0 ? ` Cambios detectados: ${labels.join(', ')}.` : '';
  return `Hubo actividad posterior a la revisión. Verifica los valores y genera una única revisión nueva.${suffix}`;
};

const resolveObservationError = (error) => {
  const code = normalizeMethodCode(error?.code || error?.data?.code);
  if (code !== 'VENTAS_CAJAS_ARQUEO_OBSERVACION_REQUIRED') return null;

  const details = error?.data?.details || error?.details || {};
  const focusMethod = String(details.focus_target || '').split('.')[1] || '';
  const methodCode = normalizeMethodCode(
    details.method || details.metodo_pago_codigo || details.step || focusMethod || 'EFECTIVO'
  );
  if (!STEP_ORDER.includes(methodCode) || methodCode === 'RESUMEN') return null;

  return {
    methodCode,
    message: `Existe diferencia en ${methodCode}. Agrega una observación para continuar.`
  };
};

const resolveResultBadgeClass = (resultado) => {
  const normalized = normalizeMethodCode(resultado);
  if (normalized === 'FALTANTE') return 'bg-danger border-danger text-white';
  if (normalized === 'SOBRANTE') return 'bg-warning border-warning text-dark';
  return 'bg-success border-success text-white';
};

export default function CierreCajaCerrarModal({
  open,
  sesion,
  currentUser = null,
  saving,
  canViewCajaTheoreticalAmounts = true,
  onClose,
  onSubmit,
  onValidate,
  onOpenMovimientoManual,
  externalInvalidationKey = 0,
  externalInvalidationMessage = 'Movimiento registrado. Revisa diferencias nuevamente.'
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(buildInitialState);
  const [validationLoading, setValidationLoading] = useState(false);
  const [operationInFlight, setOperationInFlight] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validationData, setValidationData] = useState(null);
  const [inlineMethodErrors, setInlineMethodErrors] = useState({});
  const [staleValidationNotice, setStaleValidationNotice] = useState('');

  const efectivoMontoRef = useRef(null);
  const tarjetaMontoRef = useRef(null);
  const tarjetaReferenciasRef = useRef(null);
  const transferenciaMontoRef = useRef(null);
  const transferenciaReferenciasRef = useRef(null);
  const efectivoObservacionRef = useRef(null);
  const tarjetaObservacionRef = useRef(null);
  const transferenciaObservacionRef = useRef(null);
  const validationOrCloseInFlightRef = useRef(false);
  const validationRequestIdRef = useRef(0);
  const validationPayloadKeyRef = useRef('');
  const pendingFocusTargetRef = useRef(null);

  const fieldRefs = useMemo(() => ({
    EFECTIVO: {
      monto: efectivoMontoRef,
      observacion: efectivoObservacionRef
    },
    TARJETA: {
      monto: tarjetaMontoRef,
      cantidad_referencias: tarjetaReferenciasRef,
      observacion: tarjetaObservacionRef
    },
    TRANSFERENCIA: {
      monto: transferenciaMontoRef,
      cantidad_referencias: transferenciaReferenciasRef,
      observacion: transferenciaObservacionRef
    }
  }), []);

  const step = STEP_ORDER[stepIndex];
  const currentUserId = Number.parseInt(String(currentUser?.id_usuario ?? ''), 10);
  const responsableId = Number.parseInt(String(sesion?.id_usuario_responsable ?? ''), 10);
  const isAdministrativeClose =
    Number.isInteger(currentUserId) &&
    currentUserId > 0 &&
    Number.isInteger(responsableId) &&
    responsableId > 0 &&
    currentUserId !== responsableId;
  const currentUserLabel =
    currentUser?.nombre_completo ||
    currentUser?.nombre_usuario ||
    currentUser?.email ||
    (currentUserId ? `Usuario #${currentUserId}` : 'Usuario actual');
  const responsableLabel =
    sesion?.responsable_nombre ||
    sesion?.responsable_usuario ||
    (responsableId ? `Usuario #${responsableId}` : 'Responsable original');

  const declaredSummary = useMemo(() => {
    const efectivo = Number(form.EFECTIVO.monto || 0);
    const tarjeta = Number(form.TARJETA.monto || 0);
    const transferencia = Number(form.TRANSFERENCIA.monto || 0);
    const total = (Number.isFinite(efectivo) ? efectivo : 0)
      + (Number.isFinite(tarjeta) ? tarjeta : 0)
      + (Number.isFinite(transferencia) ? transferencia : 0);
    return { total };
  }, [form.EFECTIVO.monto, form.TARJETA.monto, form.TRANSFERENCIA.monto]);

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
    if (isAdministrativeClose && !form.observacion_cierre.trim()) return false;
    return methodsValid;
  }, [form, isAdministrativeClose]);

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

  const focusMethodField = useCallback((methodCode, field = 'observacion') => {
    const normalizedMethod = normalizeMethodCode(methodCode);
    const targetIndex = STEP_ORDER.indexOf(normalizedMethod);
    if (targetIndex < 0) return;

    pendingFocusTargetRef.current = { methodCode: normalizedMethod, field };
    if (targetIndex === stepIndex) {
      const targetRef = fieldRefs[normalizedMethod]?.[field] || fieldRefs[normalizedMethod]?.observacion;
      pendingFocusTargetRef.current = null;
      targetRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRef?.current?.focus();
      return;
    }
    setStepIndex(targetIndex);
  }, [fieldRefs, stepIndex]);

  useEffect(() => {
    const pendingTarget = pendingFocusTargetRef.current;
    if (!pendingTarget || STEP_ORDER[stepIndex] !== pendingTarget.methodCode) return;

    const targetRef =
      fieldRefs[pendingTarget.methodCode]?.[pendingTarget.field] ||
      fieldRefs[pendingTarget.methodCode]?.observacion;
    pendingFocusTargetRef.current = null;
    targetRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRef?.current?.focus();
  }, [fieldRefs, stepIndex]);

  const handleExpectedValidationError = useCallback((error, focusOnError = true) => {
    const observationError = resolveObservationError(error);
    if (!observationError) return false;

    setValidationError('');
    setInlineMethodErrors((current) => ({
      ...current,
      [observationError.methodCode]: observationError.message
    }));
    if (focusOnError) focusMethodField(observationError.methodCode, 'observacion');
    return true;
  }, [focusMethodField]);

  const clearStaleValidation = useCallback((message) => {
    validationPayloadKeyRef.current = '';
    setValidationData(null);
    setStaleValidationNotice(message);
    setStepIndex(STEP_ORDER.indexOf('RESUMEN'));
  }, []);

  const runValidation = useCallback(async ({ focusOnError = true, flowLockHeld = false } = {}) => {
    if (!canSubmit || typeof onValidate !== 'function') return null;

    const payload = buildArqueosPayload();
    const payloadKey = JSON.stringify(payload);
    if (validationData && validationPayloadKeyRef.current === payloadKey) {
      setValidationError('');
      setStaleValidationNotice('');
      return validationData;
    }
    if (!flowLockHeld && validationOrCloseInFlightRef.current) return null;

    const requestId = validationRequestIdRef.current + 1;
    validationRequestIdRef.current = requestId;
    if (!flowLockHeld) {
      validationOrCloseInFlightRef.current = true;
      setOperationInFlight(true);
    }
    setValidationLoading(true);
    setValidationError('');
    setStaleValidationNotice('');

    try {
      const response = await onValidate(payload, { silent: true });
      if (validationRequestIdRef.current !== requestId) return null;
      if (payloadKey !== JSON.stringify(buildArqueosPayload())) {
        clearStaleValidation('El formulario cambió durante la revisión. Verifica los valores antes de intentarlo nuevamente.');
        return null;
      }
      validationPayloadKeyRef.current = payloadKey;
      setValidationData(response || null);
      setInlineMethodErrors({});
      if (!response?.id_validacion_cierre) {
        validationPayloadKeyRef.current = '';
        setValidationData(null);
        setValidationError('La revisión no devolvió un identificador válido. No se intentó cerrar la sesión.');
        return null;
      }
      return response || null;
    } catch (error) {
      if (validationRequestIdRef.current !== requestId) return null;
      const code = resolveApiErrorCode(error);
      if (code === 'VENTAS_CAJAS_CLOSE_VALIDATION_STALE') {
        clearStaleValidation(resolveStaleNotice(error));
      } else if (!handleExpectedValidationError(error, focusOnError)) {
        setValidationError(formatApiError(error, 'No se pudo revisar las diferencias.'));
      }
      return null;
    } finally {
      if (validationRequestIdRef.current === requestId) {
        setValidationLoading(false);
      }
      if (!flowLockHeld) {
        validationOrCloseInFlightRef.current = false;
        setOperationInFlight(false);
      }
    }
  }, [
    buildArqueosPayload,
    canSubmit,
    clearStaleValidation,
    handleExpectedValidationError,
    onValidate,
    validationData
  ]);

  useEffect(() => {
    if (!open) return;
    validationRequestIdRef.current += 1;
    validationOrCloseInFlightRef.current = false;
    setValidationLoading(false);
    setOperationInFlight(false);
    setValidationData(null);
    validationPayloadKeyRef.current = '';
    setValidationError('');
    setInlineMethodErrors({});
    setStaleValidationNotice('');
  }, [open]);

  useEffect(() => {
    if (!open) {
      validationOrCloseInFlightRef.current = false;
      validationRequestIdRef.current += 1;
      setOperationInFlight(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !externalInvalidationKey) return;
    validationRequestIdRef.current += 1;
    validationOrCloseInFlightRef.current = false;
    setValidationLoading(false);
    setOperationInFlight(false);
    setValidationData(null);
    validationPayloadKeyRef.current = '';
    setValidationError('');
    setStaleValidationNotice(externalInvalidationMessage || 'Movimiento registrado. Revisa diferencias nuevamente.');
  }, [externalInvalidationKey, externalInvalidationMessage, open]);

  if (!open) return null;

  const invalidateValidation = () => {
    validationRequestIdRef.current += 1;
    setValidationLoading(false);
    validationPayloadKeyRef.current = '';
    setValidationData((current) => {
      if (!current) return current;
      setStaleValidationNotice('Cambiaste el formulario después de la revisión. Verifica los valores y genera una revisión nueva.');
      return null;
    });
  };

  const setMethodField = (methodCode, field, value) => {
    setForm((current) => ({
      ...current,
      [methodCode]: {
        ...current[methodCode],
        [field]: value
      }
    }));

    invalidateValidation();
    setValidationError('');

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
    if (!stepValid || stepIndex >= STEP_ORDER.length - 1 || saving || operationInFlight) return;
    setStepIndex((current) => current + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0 || saving || operationInFlight) return;
    setStepIndex((current) => current - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || saving || validationOrCloseInFlightRef.current) return;

    validationOrCloseInFlightRef.current = true;
    setOperationInFlight(true);
    setValidationError('');
    try {
      const payload = buildArqueosPayload();
      const payloadKey = JSON.stringify(payload);
      const currentValidation = validationData && validationPayloadKeyRef.current === payloadKey
        ? validationData
        : await runValidation({ focusOnError: true, flowLockHeld: true });
      if (!currentValidation) return;
      if (validationPayloadKeyRef.current !== JSON.stringify(buildArqueosPayload())) {
        clearStaleValidation('El formulario cambió después de la revisión. Verifica los valores y genera una revisión nueva.');
        return;
      }
      await onSubmit({
        ...payload,
        id_validacion_cierre: currentValidation.id_validacion_cierre || null
      });
    } catch (error) {
      const code = resolveApiErrorCode(error);
      if (code === 'VENTAS_CAJAS_CLOSE_VALIDATION_STALE') {
        clearStaleValidation(resolveStaleNotice(error));
      } else if (!handleExpectedValidationError(error, true)) {
        setValidationError(formatApiError(error, 'No se pudo registrar el cierre de caja.'));
      }
    } finally {
      validationOrCloseInFlightRef.current = false;
      setOperationInFlight(false);
    }
  };

  const methodRows = Array.isArray(validationData?.metodos)
    ? validationData.metodos
    : Array.isArray(validationData?.arqueos_metodos)
      ? validationData.arqueos_metodos
      : [];
  const rowsWithDifference = methodRows.filter((row) => Number(row?.diferencia || 0) !== 0);
  const requiredObservationCount = methodRows.filter((row) => row?.observacion_requerida && !row?.observacion_presente).length;
  const controlsDisabled = saving || operationInFlight;

  const renderMethodActions = (row) => {
    const methodCode = normalizeMethodCode(row?.metodo_pago_codigo);
    const diferencia = Number(row?.diferencia || 0);
    return (
      <div className="cierres-caja-review-card__actions">
        {methodCode === 'EFECTIVO' ? (
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => focusMethodField('EFECTIVO', 'monto')} disabled={controlsDisabled}>
              Volver a contar efectivo
            </button>
            {diferencia < 0 ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => onOpenMovimientoManual?.({ source: 'cierre', methodCode, tipoInicial: 'EGRESO' })}
                disabled={controlsDisabled}
              >
                Registrar egreso
              </button>
            ) : null}
            {diferencia > 0 ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => onOpenMovimientoManual?.({ source: 'cierre', methodCode, tipoInicial: 'INGRESO' })}
                disabled={controlsDisabled}
              >
                Registrar ingreso
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => focusMethodField(methodCode, methodCode === 'TARJETA' ? 'cantidad_referencias' : 'cantidad_referencias')}
            disabled={controlsDisabled}
          >
            {methodCode === 'TARJETA' ? 'Revisar vouchers/referencias' : 'Revisar comprobantes/referencias'}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => focusMethodField(methodCode, 'observacion')} disabled={controlsDisabled}>
          Agregar observación
        </button>
      </div>
    );
  };

  return (
    <div className="ventas-modal-backdrop">
      <section
        className="ventas-modal cierres-caja-action-modal cierres-caja-compact-modal cierres-caja-close-modal"
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
            disabled={controlsDisabled}
          >
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <form className="ventas-modal__body cierres-caja-action-modal__body cierres-caja-compact-modal__body" onSubmit={handleSubmit}>
          {isAdministrativeClose ? (
            <div className="alert alert-warning mb-0">
              <strong>Cierre administrativo</strong>
              <div>Responsable original: {responsableLabel}</div>
              <div>Usuario que realizara el cierre: {currentUserLabel}</div>
              <div>El responsable original no sera reemplazado. Su usuario quedara registrado como autor del cierre.</div>
            </div>
          ) : null}

          <div className="d-flex align-items-center justify-content-between small text-muted">
            <span>Paso {stepIndex + 1} de {STEP_ORDER.length}</span>
            <span>{step}</span>
          </div>

          {step !== 'RESUMEN' ? (
            <>
              <label className="ventas-create-modal__field">
                <span>Monto declarado ({step})</span>
                <input
                  ref={fieldRefs[step]?.monto}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[step].monto}
                  onChange={(event) => setMethodField(step, 'monto', event.target.value)}
                  disabled={controlsDisabled}
                />
              </label>

              {step !== 'EFECTIVO' ? (
                <label className="ventas-create-modal__field">
                  <span>{step === 'TARJETA' ? 'Cantidad de vouchers' : 'Cantidad de comprobantes'}</span>
                  <input
                    ref={fieldRefs[step]?.cantidad_referencias}
                    type="number"
                    min="0"
                    step="1"
                    value={form[step].cantidad_referencias}
                    onChange={(event) => setMethodField(step, 'cantidad_referencias', event.target.value)}
                    disabled={controlsDisabled}
                  />
                </label>
              ) : null}

              <label className="ventas-create-modal__field">
                <span>Observación ({step})</span>
                <textarea
                  ref={fieldRefs[step]?.observacion}
                  className="ventas-create-modal__note-input"
                  rows="2"
                  value={form[step].observacion}
                  onChange={(event) => setMethodField(step, 'observacion', event.target.value)}
                  disabled={controlsDisabled}
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
              {validationLoading ? (
                <div className="alert alert-info mb-0">Revisando diferencias...</div>
              ) : null}
              {validationError ? (
                <div className="alert alert-danger mb-0">{validationError}</div>
              ) : null}
              {staleValidationNotice ? (
                <div className="alert alert-warning mb-0">{staleValidationNotice}</div>
              ) : null}
              {validationData?.numero_intento ? (
                <div className="alert alert-success mb-0">
                  <strong>Revisión actual #{validationData.numero_intento}</strong>
                  {validationData?.reutilizada ? (
                    <div className="small">Se reutilizó la revisión vigente; no se creó un recuento nuevo.</div>
                  ) : null}
                </div>
              ) : null}

              <article className="ventas-page__stat-card is-accent">
                <div className="inv-prod-kpi-content">
                  <span>Total declarado</span>
                  <strong>L. {formatCajaCurrency(validationData?.resumen?.total_declarado ?? declaredSummary.total)}</strong>
                </div>
              </article>

              {canViewCajaTheoreticalAmounts && validationData?.resumen?.total_teorico !== undefined ? (
                <article className="ventas-page__stat-card is-warning">
                  <div className="inv-prod-kpi-content">
                    <span>Totales generales</span>
                    <strong>
                      Sistema: L. {formatCajaCurrency(Number(validationData?.resumen?.total_teorico || 0))}
                      {' | '}Declarado: L. {formatCajaCurrency(Number(validationData?.resumen?.total_declarado || 0))}
                      {' | '}Dif: L. {formatCajaCurrency(Number(validationData?.resumen?.diferencia_total || 0))}
                    </strong>
                  </div>
                </article>
              ) : null}

              {rowsWithDifference.some((row) => normalizeMethodCode(row?.metodo_pago_codigo) === 'EFECTIVO' && Number(row?.diferencia || 0) < 0) ? (
                <div className="alert alert-warning mb-0">
                  Antes de justificar, revisa si falta registrar un egreso de caja.
                </div>
              ) : null}

              {methodRows.length > 0 ? (
                <div className="cierres-caja-review-list">
                  {methodRows.map((row) => {
                    const methodCode = normalizeMethodCode(row?.metodo_pago_codigo);
                    return (
                      <article key={methodCode} className="cierres-caja-review-card">
                        <div className="cierres-caja-review-card__head">
                          <strong>{methodCode}</strong>
                          <span className={`ventas-page__table-pill ${resolveResultBadgeClass(row?.resultado)}`}>
                            {row?.resultado || 'CUADRADO'}
                          </span>
                        </div>
                        <div className="cierres-caja-review-card__grid">
                          {canViewCajaTheoreticalAmounts && row?.monto_teorico !== undefined ? (
                            <div>
                              <span>Sistema</span>
                              <strong>L. {formatCajaCurrency(row.monto_teorico)}</strong>
                            </div>
                          ) : null}
                          <div>
                            <span>Declarado</span>
                            <strong>L. {formatCajaCurrency(row?.monto_declarado)}</strong>
                          </div>
                          <div>
                            <span>Diferencia</span>
                            <strong>L. {formatCajaCurrency(row?.diferencia)}</strong>
                          </div>
                          <div>
                            <span>Observación</span>
                            <strong>{row?.observacion_requerida && !row?.observacion_presente ? 'Requerida' : 'Completa'}</strong>
                          </div>
                        </div>
                        {Number(row?.diferencia || 0) !== 0 ? renderMethodActions(row) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <article className="ventas-page__stat-card">
                  <div className="inv-prod-kpi-content">
                    <span>Estado</span>
                    <strong>Sin revisión auditada</strong>
                    <small className="text-muted">Presiona Revisar diferencias antes de enviar el cierre.</small>
                  </div>
                </article>
              )}

              {!canViewCajaTheoreticalAmounts ? (
                <article className="ventas-page__stat-card">
                  <div className="inv-prod-kpi-content">
                    <span>Observaciones</span>
                    <strong>{requiredObservationCount > 0 ? 'Faltantes' : 'Completas'}</strong>
                  </div>
                </article>
              ) : null}

              <label className="ventas-create-modal__field">
                <span>{isAdministrativeClose ? 'Motivo de cierre administrativo' : 'Observación general de cierre'}</span>
                <textarea
                  className="ventas-create-modal__note-input"
                  rows="2"
                  value={form.observacion_cierre}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, observacion_cierre: event.target.value }));
                    invalidateValidation();
                    setValidationError('');
                  }}
                  placeholder={isAdministrativeClose ? 'Motivo obligatorio del cierre administrativo...' : 'Observación general opcional...'}
                  required={isAdministrativeClose}
                  disabled={controlsDisabled}
                />
              </label>
              {isAdministrativeClose && !form.observacion_cierre.trim() ? (
                <div className="cierres-caja-inline-error" role="alert">
                  Debe indicar el motivo para cerrar una sesion ajena.
                </div>
              ) : null}
            </>
          )}

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={controlsDisabled}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={controlsDisabled || stepIndex === 0}>
                Atrás
              </button>
              {step !== 'RESUMEN' ? (
                <button type="button" className="btn btn-danger" onClick={goNext} disabled={!stepValid || controlsDisabled}>
                  Siguiente
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => void runValidation({ focusOnError: true })}
                    disabled={!canSubmit || controlsDisabled}
                  >
                    {validationLoading ? 'Revisando...' : 'Revisar diferencias'}
                  </button>
                  <button type="submit" className="btn btn-danger" disabled={!canSubmit || controlsDisabled}>
                    {saving
                      ? 'Guardando...'
                      : operationInFlight
                        ? (validationLoading ? 'Validando...' : 'Enviando...')
                        : 'Enviar a revisión'}
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
