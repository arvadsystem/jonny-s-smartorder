import { useEffect, useMemo, useState } from 'react';
import {
  extractCajasApiMessage,
  formatCajaCurrency
} from '../../utils/cajasHelpers';
import AppSelect from '../../../../../components/common/AppSelect';

const getDifferenceKind = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'SIN_DIFERENCIA';
  if (amount === 0) return 'CUADRADO';
  return amount < 0 ? 'FALTANTE' : 'SOBRANTE';
};

const getDifferenceLabel = (kind) => {
  if (kind === 'CUADRADO') return 'Cuadrado';
  if (kind === 'FALTANTE') return 'Faltante';
  if (kind === 'SOBRANTE') return 'Sobrante';
  return 'Sin diferencia';
};

const buildResolutionOptions = (differenceValue) => {
  const kind = getDifferenceKind(differenceValue);
  if (kind === 'CUADRADO') {
    return [{ code: 'CAJA_CUADRA', label: 'Caja cuadra' }];
  }
  if (kind === 'FALTANTE') {
    return [
      { code: 'GASTO_EMPRESA', label: 'Asumido por empresa' },
      { code: 'DESCUENTO_EMPLEADO', label: 'Asignar faltante a empleado' }
    ];
  }
  if (kind === 'SOBRANTE') {
    return [
      { code: 'GASTO_EMPRESA', label: 'Registrar observacion administrativa' },
      { code: 'PENDIENTE_REVISION', label: 'Mantener pendiente de auditoria' }
    ];
  }
  return [];
};

const resolveCajaResponsible = ({ detalle, sesion, resumen }) => {
  const idUsuario = Number(
    detalle?.responsable?.id_usuario
    ?? sesion?.id_usuario_responsable
    ?? resumen?.responsabilidad_final_id_usuario
    ?? 0
  ) || null;
  const nombre =
    detalle?.responsable?.nombre_completo
    || detalle?.responsable?.nombre_usuario
    || sesion?.responsable_nombre
    || sesion?.responsable_usuario
    || (idUsuario ? `Usuario ${idUsuario}` : '');

  return {
    id_usuario: idUsuario,
    nombre: String(nombre || '').trim()
  };
};

const DetailField = ({ label, value }) => (
  <div className="cierres-caja-detail-field">
    <span>{label}</span>
    <strong>{value || '-'}</strong>
  </div>
);

export const canResolveCierreDifference = ({
  cierre,
  sesion,
  canResolveDifference,
  canViewCajaTheoreticalAmounts = true,
  onResolveDifference
}) => {
  const currentResolutionCode = String(cierre?.resolucion_codigo || '').trim().toUpperCase();
  const differenceAmount = cierre?.diferencia ?? cierre?.diferencia_cierre ?? sesion?.diferencia_cierre ?? null;
  const isOpen = String(sesion?.estado_codigo || '').trim().toUpperCase() === 'ABIERTA';
  return Boolean(canResolveDifference)
    && (typeof onResolveDifference === 'function' || onResolveDifference === undefined)
    && Boolean(cierre?.id_cierre_caja)
    && !isOpen
    && canViewCajaTheoreticalAmounts
    && differenceAmount !== null
    && differenceAmount !== undefined
    && (!currentResolutionCode || currentResolutionCode === 'PENDIENTE_REVISION');
};

export default function CierreCajaResolverDiferenciaModal({
  open,
  detalle,
  saving = false,
  onClose,
  onSubmit
}) {
  const sesion = detalle?.sesion ?? {};
  const cierre = detalle?.cierre ?? {};
  const resumen = detalle?.resumen_operativo ?? {};
  const differenceAmount = cierre?.diferencia ?? resumen?.diferencia_cierre ?? sesion?.diferencia_cierre ?? null;
  const differenceKind = getDifferenceKind(differenceAmount);
  const absoluteDifferenceAmount = Math.abs(Number(differenceAmount || 0));
  const cierreObservacion = cierre?.observacion || cierre?.observacion_cierre || resumen?.observacion_cierre || '';
  const resolutionOptions = useMemo(() => buildResolutionOptions(differenceAmount), [differenceAmount]);
  const responsableCaja = useMemo(
    () => resolveCajaResponsible({ detalle, sesion, resumen }),
    [detalle, resumen, sesion]
  );

  const [form, setForm] = useState({
    resolucion_codigo: '',
    observacion: ''
  });
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      resolucion_codigo: resolutionOptions[0]?.code || '',
      observacion: cierreObservacion || ''
    });
    setLocalError('');
  }, [cierreObservacion, open, resolutionOptions]);

  if (!open) return null;

  const isEmployeeDiscount = form.resolucion_codigo === 'DESCUENTO_EMPLEADO';

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!form.resolucion_codigo) {
      setLocalError('Selecciona una resolucion.');
      return;
    }
    if (!form.observacion.trim()) {
      setLocalError('La observacion administrativa es obligatoria.');
      return;
    }
    if (isEmployeeDiscount && !responsableCaja.id_usuario) {
      setLocalError('No se pudo determinar el responsable de la caja.');
      return;
    }

    try {
      await onSubmit?.({
        resolucion_codigo: form.resolucion_codigo,
        observacion: form.observacion.trim(),
        ...(isEmployeeDiscount
          ? { id_usuario_responsable_diferencia: Number(responsableCaja.id_usuario) }
          : {})
      });
      onClose?.();
    } catch (errorResponse) {
      setLocalError(
        extractCajasApiMessage(errorResponse, 'No se pudo resolver la diferencia.')
      );
    }
  };

  const handleBackdropClick = (event) => {
    event.stopPropagation();
    if (!saving) onClose?.();
  };

  return (
    <div className="ventas-modal-backdrop" onClick={handleBackdropClick}>
      <section
        className="ventas-modal cierres-caja-action-modal cierres-caja-resolution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierre-resolver-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-shield-check" />
            </span>
            <div>
              <h3 id="cierre-resolver-title">Resolver diferencia</h3>
              <p>Registra la decision administrativa del cierre.</p>
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

        <form className="ventas-modal__body cierres-caja-action-modal__body cierres-caja-resolution-modal__body" onSubmit={submit}>
          {!detalle ? (
            <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
              <div className="spinner-border text-danger" role="status" />
              <span>Cargando datos del cierre...</span>
            </div>
          ) : (
            <>
              <div className={`cierres-caja-resolution-summary is-${differenceKind.toLowerCase()}`}>
                <div>
                  <span>Tipo de diferencia</span>
                  <strong>{getDifferenceLabel(differenceKind)}</strong>
                </div>
                <div>
                  <span>{differenceKind === 'FALTANTE' ? 'Monto del faltante' : 'Monto'}</span>
                  <strong>
                    {differenceKind === 'FALTANTE' ? '-' : ''}
                    L. {formatCajaCurrency(absoluteDifferenceAmount)}
                  </strong>
                </div>
              </div>

              <div className="cierres-caja-detail-safe-grid">
                <DetailField label="Caja" value={sesion?.nombre_caja || 'Sin caja'} />
                <DetailField label="Sesion" value={sesion?.id_sesion_caja ? `SES-${String(sesion.id_sesion_caja).padStart(5, '0')}` : 'Sin sesion'} />
                <DetailField label="Sucursal" value={sesion?.nombre_sucursal || 'Sin sucursal'} />
                <DetailField label="Responsable asignado" value={responsableCaja.nombre || 'Sin responsable'} />
              </div>

              <div className="ventas-create-modal__field">
                <AppSelect
                  label="Resolucion"
                  placeholder="Selecciona una resolucion"
                  value={form.resolucion_codigo}
                  options={resolutionOptions.map((option) => ({
                    value: option.code,
                    label: option.label
                  }))}
                  onChange={(value) => updateField('resolucion_codigo', value)}
                  disabled={saving}
                  className="app-select--compact app-select--warm cierres-caja-resolution-select"
                />
              </div>

              {isEmployeeDiscount ? (
                <div className="cierres-caja-resolution-note">
                  <i className="bi bi-info-circle" />
                  <span>
                    {responsableCaja.id_usuario
                      ? 'El faltante sera asignado al responsable de esta caja.'
                      : 'No se pudo determinar el responsable de la caja.'}
                  </span>
                </div>
              ) : null}

              <div className="ventas-create-modal__field">
                <label htmlFor="cierre-resolucion-observacion">Observacion administrativa</label>
                <textarea
                  id="cierre-resolucion-observacion"
                  className="form-control ventas-create-modal__note-input"
                  rows={4}
                  value={form.observacion}
                  onChange={(event) => updateField('observacion', event.target.value)}
                  placeholder="Describe la decision administrativa."
                  disabled={saving}
                />
              </div>
            </>
          )}

          {localError ? (
            <div className="cierres-caja-inline-error">{localError}</div>
          ) : null}

          <footer className="ventas-detail-modal__footer">
            <div className="ventas-detail-modal__footer-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={saving || (isEmployeeDiscount && !responsableCaja.id_usuario)}
              >
                {saving ? 'Guardando...' : 'Guardar resolucion'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
