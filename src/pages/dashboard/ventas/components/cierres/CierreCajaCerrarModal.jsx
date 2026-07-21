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

// Presentacion unicamente: nunca persistir ni enviar estas etiquetas al
// backend. metodo_pago_codigo sigue siendo la fuente de verdad. Compatible
// con un backend anterior que no manda display_name (cae al mapa local) y
// con codigos futuros desconocidos (cae al codigo crudo, no a un guion bajo
// technical value sin traducir salvo que realmente no haya nada mejor).
const METHOD_DISPLAY_LABELS = Object.freeze({
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otros no efectivo'
});

const resolveMethodDisplayLabel = (row) => {
  const explicit = typeof row?.display_name === 'string' ? row.display_name.trim() : '';
  if (explicit) return explicit;
  const code = normalizeMethodCode(row?.metodo_pago_codigo);
  return METHOD_DISPLAY_LABELS[code] || code;
};

// Fila automatica: no se enfoca, no se le agregan botones de edicion, y no
// se le pide observacion manual. completado_automaticamente=true es la
// senal principal (siempre presente en la fila OTRO); editable===false es
// una senal adicional explicita del backend para el mismo caso.
const isAutomaticRow = (row) => Boolean(row?.completado_automaticamente) || row?.editable === false;

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
  const validationLoadingRef = useRef(false);
  const validationRequestIdRef = useRef(0);
  const validationPayloadKeyRef = useRef('');

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
    // OTRO (y cualquier codigo futuro fuera de los tres pasos manuales) no
    // tiene paso ni campo que enfocar: no existe fieldRefs[normalizedMethod].
    if (targetIndex < 0) return;
    setStepIndex(targetIndex);
    window.setTimeout(() => {
      const targetRef = fieldRefs[normalizedMethod]?.[field] || fieldRefs[normalizedMethod]?.observacion;
      targetRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRef?.current?.focus();
    }, 0);
  }, [fieldRefs]);

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

  const runValidation = useCallback(async ({ focusOnError = true } = {}) => {
    if (!canSubmit || typeof onValidate !== 'function' || validationLoadingRef.current) return null;

    const requestId = validationRequestIdRef.current + 1;
    validationRequestIdRef.current = requestId;
    validationLoadingRef.current = true;
    setValidationLoading(true);
    setValidationError('');
    setStaleValidationNotice('');

    try {
      const payload = buildArqueosPayload();
      const payloadKey = JSON.stringify(payload);
      const response = await onValidate(payload, { silent: true });
      if (validationRequestIdRef.current !== requestId) return null;
      if (payloadKey !== JSON.stringify(buildArqueosPayload())) return null;
      validationPayloadKeyRef.current = payloadKey;
      setValidationData(response || null);
      setInlineMethodErrors({});
      return response || null;
    } catch (error) {
      if (validationRequestIdRef.current !== requestId) return null;
      setValidationData(null);
      if (!handleExpectedValidationError(error, focusOnError)) {
        setValidationError(error?.message || 'No se pudo revisar las diferencias.');
      }
      return null;
    } finally {
      if (validationRequestIdRef.current === requestId) {
        validationLoadingRef.current = false;
        setValidationLoading(false);
      }
    }
  }, [buildArqueosPayload, canSubmit, handleExpectedValidationError, onValidate]);

  useEffect(() => {
    if (!open) return;
    validationRequestIdRef.current += 1;
    validationLoadingRef.current = false;
    setValidationLoading(false);
    setValidationData(null);
    validationPayloadKeyRef.current = '';
    setValidationError('');
    setInlineMethodErrors({});
    setStaleValidationNotice('');
  }, [open]);

  useEffect(() => {
    if (!open) {
      validationLoadingRef.current = false;
      validationRequestIdRef.current += 1;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !externalInvalidationKey) return;
    validationRequestIdRef.current += 1;
    validationLoadingRef.current = false;
    setValidationLoading(false);
    setValidationData(null);
    validationPayloadKeyRef.current = '';
    setValidationError('');
    setStaleValidationNotice(externalInvalidationMessage || 'Movimiento registrado. Revisa diferencias nuevamente.');
  }, [externalInvalidationKey, externalInvalidationMessage, open]);

  if (!open) return null;

  const invalidateValidation = () => {
    validationRequestIdRef.current += 1;
    validationLoadingRef.current = false;
    setValidationLoading(false);
    validationPayloadKeyRef.current = '';
    setValidationData((current) => {
      if (!current) return current;
      setStaleValidationNotice('Cambiaste el formulario despues de revisar diferencias. Debes revisar diferencias nuevamente.');
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
    if (!stepValid || stepIndex >= STEP_ORDER.length - 1 || saving || validationLoading) return;
    setStepIndex((current) => current + 1);
  };

  const goBack = () => {
    if (stepIndex <= 0 || saving || validationLoading) return;
    setStepIndex((current) => current - 1);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || saving || validationLoading) return;

    try {
      const payload = buildArqueosPayload();
      const payloadKey = JSON.stringify(payload);
      const currentValidation = validationData && validationPayloadKeyRef.current === payloadKey
        ? validationData
        : await runValidation({ focusOnError: true });
      if (!currentValidation) return;
      if (validationPayloadKeyRef.current !== JSON.stringify(buildArqueosPayload())) {
        setValidationData(null);
        validationPayloadKeyRef.current = '';
        setStaleValidationNotice('El formulario cambio despues de revisar diferencias. Debes revisar diferencias nuevamente.');
        return;
      }
      await onSubmit({
        ...payload,
        id_validacion_cierre: currentValidation.id_validacion_cierre || null
      });
    } catch (error) {
      const code = error?.data?.code || error?.code;
      if (code === 'VENTAS_CAJAS_CLOSE_VALIDATION_STALE') {
        validationPayloadKeyRef.current = '';
        setValidationData(null);
        setStaleValidationNotice('La sesion cambio. Revisa las diferencias nuevamente.');
        setStepIndex(STEP_ORDER.indexOf('RESUMEN'));
      } else if (!handleExpectedValidationError(error, true)) {
        setValidationError(error?.message || 'No se pudo registrar el cierre de caja.');
      }
    }
  };

  const methodRows = Array.isArray(validationData?.metodos)
    ? validationData.metodos
    : Array.isArray(validationData?.arqueos_metodos)
      ? validationData.arqueos_metodos
      : [];
  const rowsWithDifference = methodRows.filter((row) => Number(row?.diferencia || 0) !== 0);
  const requiredObservationCount = methodRows.filter((row) => row?.observacion_requerida && !row?.observacion_presente).length;
  const isValidated = Boolean(validationData);
  const otrosRow = methodRows.find((row) => normalizeMethodCode(row?.metodo_pago_codigo) === 'OTRO');

  const renderMethodActions = (row) => {
    const methodCode = normalizeMethodCode(row?.metodo_pago_codigo);
    const diferencia = Number(row?.diferencia || 0);
    return (
      <div className="cierres-caja-review-card__actions">
        {methodCode === 'EFECTIVO' ? (
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => focusMethodField('EFECTIVO', 'monto')}>
              Volver a contar efectivo
            </button>
            {diferencia < 0 ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => onOpenMovimientoManual?.({ source: 'cierre', methodCode, tipoInicial: 'EGRESO' })}
              >
                Registrar egreso
              </button>
            ) : null}
            {diferencia > 0 ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => onOpenMovimientoManual?.({ source: 'cierre', methodCode, tipoInicial: 'INGRESO' })}
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
          >
            {methodCode === 'TARJETA' ? 'Revisar vouchers/referencias' : 'Revisar comprobantes/referencias'}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => focusMethodField(methodCode, 'observacion')}>
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
            disabled={saving || validationLoading}
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
                  Intento de revisión #{validationData.numero_intento}
                </div>
              ) : null}

              {!isValidated ? (
                <article className="ventas-page__stat-card is-accent">
                  <div className="inv-prod-kpi-content">
                    <span>Subtotal declarado manual</span>
                    <strong>L. {formatCajaCurrency(declaredSummary.total)}</strong>
                    <small className="text-muted">
                      Aun no incluye la conciliación automática del sistema. Presiona Revisar diferencias para calcular el total definitivo.
                    </small>
                  </div>
                </article>
              ) : (
                <>
                  <article className="ventas-page__stat-card">
                    <div className="inv-prod-kpi-content">
                      <span>Subtotal manual (Efectivo + Tarjeta + Transferencia)</span>
                      <strong>L. {formatCajaCurrency(declaredSummary.total)}</strong>
                    </div>
                  </article>
                  {otrosRow ? (
                    <article className="ventas-page__stat-card">
                      <div className="inv-prod-kpi-content">
                        <span>Otros no efectivo (automático)</span>
                        <strong>L. {formatCajaCurrency(otrosRow.monto_declarado)}</strong>
                      </div>
                    </article>
                  ) : null}
                  <article className="ventas-page__stat-card is-accent">
                    <div className="inv-prod-kpi-content">
                      <span>Total declarado validado</span>
                      <strong>L. {formatCajaCurrency(validationData?.resumen?.total_declarado)}</strong>
                    </div>
                  </article>
                </>
              )}

              {isValidated && canViewCajaTheoreticalAmounts && validationData?.resumen?.total_teorico !== undefined ? (
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
                    const automatic = isAutomaticRow(row);
                    return (
                      <article key={methodCode} className="cierres-caja-review-card">
                        <div className="cierres-caja-review-card__head">
                          <strong>{resolveMethodDisplayLabel(row)}</strong>
                          {automatic ? (
                            <span className="ventas-page__table-pill bg-secondary border-secondary text-white">
                              Automático
                            </span>
                          ) : null}
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
                            <strong>
                              {automatic
                                ? 'Automática'
                                : row?.observacion_requerida && !row?.observacion_presente ? 'Requerida' : 'Completa'}
                            </strong>
                          </div>
                        </div>
                        {automatic ? (
                          <div className="cierres-caja-review-card__actions">
                            <small className="text-muted">
                              {row?.observacion
                                || 'Este monto fue conciliado automáticamente por el sistema a partir de los métodos no efectivo registrados. No requiere conteo manual.'}
                            </small>
                          </div>
                        ) : Number(row?.diferencia || 0) !== 0 ? renderMethodActions(row) : null}
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
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving || validationLoading}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={goBack} disabled={saving || validationLoading || stepIndex === 0}>
                Atrás
              </button>
              {step !== 'RESUMEN' ? (
                <button type="button" className="btn btn-danger" onClick={goNext} disabled={!stepValid || saving || validationLoading}>
                  Siguiente
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => void runValidation({ focusOnError: true })}
                    disabled={!canSubmit || saving || validationLoading}
                  >
                    {validationLoading ? 'Revisando...' : 'Revisar diferencias'}
                  </button>
                  <button type="submit" className="btn btn-danger" disabled={!canSubmit || saving || validationLoading}>
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
