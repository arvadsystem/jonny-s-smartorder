import { useEffect, useMemo, useState } from 'react';
import PlanillasModalActions from './PlanillasModalActions';
import PlanillasModalField from './PlanillasModalField';
import PlanillasModalLayout from './PlanillasModalLayout';
import PlanillasMoneyInput from './PlanillasMoneyInput';

const todayInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const money = (value) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 'L 0.00';
  return `L ${amount.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const parsePositiveMoney = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export default function PlanillaAdelantosModal({
  open,
  item,
  adelantos = [],
  loading = false,
  applying = false,
  registering = false,
  canRegister = false,
  onClose,
  onApply,
  onRegister
}) {
  const [selectedId, setSelectedId] = useState('');
  const [monto, setMonto] = useState('');
  const [registerMonto, setRegisterMonto] = useState('');
  const [registerFecha, setRegisterFecha] = useState('');
  const [submittedApply, setSubmittedApply] = useState(false);
  const [submittedRegister, setSubmittedRegister] = useState(false);
  const today = useMemo(() => todayInput(), []);

  useEffect(() => {
    if (!open) return;
    setSelectedId('');
    setMonto('');
    setRegisterMonto('');
    setRegisterFecha('');
    setSubmittedApply(false);
    setSubmittedRegister(false);
  }, [open, item]);

  const selectedAdelanto = useMemo(
    () =>
      adelantos.find(
        (adelanto) => String(adelanto.id_adelanto_salario || adelanto.id_adelanto || '') === selectedId
      ) || null,
    [adelantos, selectedId]
  );

  if (!open || !item) return null;

  const netoRaw = Number(item?.neto_pagar ?? item?.total_neto_pagar ?? item?.neto);
  const hasNetoConstraint = Number.isFinite(netoRaw);
  const netoDisponible = hasNetoConstraint ? Math.max(0, netoRaw) : Number.POSITIVE_INFINITY;
  const selectedSaldo = Number(
    selectedAdelanto?.saldo_disponible ?? selectedAdelanto?.saldo ?? selectedAdelanto?.monto_pendiente ?? 0
  );
  const montoAplicar = parsePositiveMoney(monto);
  const registerMontoValue = parsePositiveMoney(registerMonto);
  const saldoRestante = Number.isFinite(selectedSaldo) ? Math.max(0, selectedSaldo - (montoAplicar || 0)) : 0;

  const applyError = submittedApply
    ? !selectedAdelanto
      ? 'Seleccione un adelanto para aplicar.'
      : !montoAplicar
        ? 'Ingrese un monto valido.'
        : montoAplicar > selectedSaldo
          ? 'El monto a aplicar no puede superar el saldo disponible.'
          : hasNetoConstraint && montoAplicar > netoDisponible
            ? 'El monto a aplicar no puede superar el neto a pagar disponible.'
          : ''
    : '';

  const registerError = submittedRegister
    ? !registerMontoValue
      ? 'Ingrese un monto valido mayor que 0.'
      : hasNetoConstraint && registerMontoValue > netoDisponible
        ? 'El adelanto no puede superar el neto a pagar disponible.'
        : ''
    : '';
  const registerFechaFuture = Boolean(registerFecha) && registerFecha > today;
  const registerFechaError = submittedRegister && registerFechaFuture ? 'La fecha no puede ser mayor al dia actual.' : '';

  const canSubmitRegister = Boolean(
    canRegister &&
      registerMontoValue &&
      !registerFechaFuture &&
      (!hasNetoConstraint || registerMontoValue <= netoDisponible)
  );
  const canSubmitApply = Boolean(
    selectedAdelanto &&
      montoAplicar &&
      Number.isFinite(selectedSaldo) &&
      montoAplicar <= selectedSaldo &&
      (!hasNetoConstraint || montoAplicar <= netoDisponible)
  );

  const handleRegister = (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    setSubmittedRegister(true);
    if (!canSubmitRegister) return;

    const idEmpleado = Number(item?.id_empleado);
    if (!Number.isFinite(idEmpleado) || idEmpleado <= 0) return;

    onRegister?.({
      id_empleado: idEmpleado,
      monto: registerMontoValue,
      fecha: registerFecha || null
    });
  };

  const handleApply = (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    setSubmittedApply(true);
    if (!canSubmitApply) return;

    onApply?.({
      id_adelanto: selectedAdelanto.id_adelanto_salario || selectedAdelanto.id_adelanto,
      monto_aplicar: montoAplicar
    });
  };

  const hasAdelantos = !loading && adelantos.length > 0;

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Aplicar Adelanto"
      subtitle={item.nombre_completo || item.empleado_nombre || 'Empleado seleccionado'}
      size="lg"
      className="planillas-modal-shell--adelanto"
      actions={
        <PlanillasModalActions
          onCancel={onClose}
          cancelLabel={hasAdelantos ? 'Cancelar' : 'Cerrar'}
          cancelDisabled={applying || registering}
          hidePrimary={!hasAdelantos}
          primaryType="button"
          primaryLabel="Aplicar Adelanto"
          primaryLoadingLabel="Aplicando..."
          primaryLoading={applying}
          primaryDisabled={!canSubmitApply || applying}
          onPrimary={handleApply}
        />
      }
    >
      {loading ? (
        <div className="inv-catpro-loading" role="status">
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Cargando adelantos...</span>
        </div>
      ) : (
        <>
          {adelantos.length === 0 ? (
            <div className="inv-catpro-empty planillas-modal-empty">
              <div className="inv-catpro-empty-sub">No hay adelantos aplicables para este empleado.</div>
            </div>
          ) : (
            <>
              <section className="planillas-modal-section">
                <h6 className="planillas-modal-section__title">Seleccionar adelanto</h6>
                <div className="table-responsive">
                  <table className="table table-sm align-middle planillas-modal-table">
                    <thead>
                      <tr>
                        <th />
                        <th>Codigo</th>
                        <th>Saldo disponible</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adelantos.map((adelanto) => {
                        const id = String(adelanto.id_adelanto_salario || adelanto.id_adelanto || '').trim();
                        const saldo = adelanto.saldo_disponible ?? adelanto.saldo ?? adelanto.monto_pendiente;
                        return (
                          <tr key={id}>
                            <td>
                              <input
                                type="radio"
                                name="adelantoSeleccionado"
                                className="form-check-input"
                                checked={selectedId === id}
                                onChange={() => {
                                  setSelectedId(id);
                                  setMonto(String(saldo ?? ''));
                                }}
                              />
                            </td>
                            <td>{adelanto.codigo_adelanto || `AD-${id}`}</td>
                            <td>{money(saldo)}</td>
                            <td>{adelanto.fecha || adelanto.fecha_registro || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="planillas-modal-section">
                <h6 className="planillas-modal-section__title">Aplicar adelanto</h6>
                <div className="planillas-modal-grid">
                  <PlanillasModalField id="adelanto-monto-aplicar" label="Monto a aplicar" required error={applyError}>
                    <PlanillasMoneyInput
                      id="adelanto-monto-aplicar"
                      value={monto}
                      onChange={(event) => setMonto(event.target.value)}
                      currency="L"
                      placeholder="Ingrese el monto"
                      error={Boolean(applyError)}
                      allowThousandsSeparators
                    />
                  </PlanillasModalField>
                </div>

                <div className="planillas-adelanto-summary">
                  <article>
                    <span>Saldo disponible</span>
                    <strong>{money(selectedSaldo)}</strong>
                  </article>
                  <article>
                    <span>Monto a aplicar</span>
                    <strong>{money(montoAplicar || 0)}</strong>
                  </article>
                  <article>
                    <span>Saldo restante</span>
                    <strong>{money(saldoRestante)}</strong>
                  </article>
                  {hasNetoConstraint ? (
                    <article>
                      <span>Neto disponible</span>
                      <strong>{money(netoDisponible)}</strong>
                    </article>
                  ) : null}
                </div>
              </section>
            </>
          )}

          {canRegister ? (
            <section className="planillas-modal-section">
              <h6 className="planillas-modal-section__title">Registrar nuevo adelanto</h6>
              <div className="planillas-modal-grid">
                <PlanillasModalField id="adelanto-registrar-monto" label="Monto" required error={registerError}>
                  <PlanillasMoneyInput
                    id="adelanto-registrar-monto"
                    value={registerMonto}
                    onChange={(event) => setRegisterMonto(event.target.value)}
                    currency="L"
                    placeholder="Ingrese el monto"
                    error={Boolean(registerError)}
                    disabled={registering}
                    allowThousandsSeparators
                  />
                </PlanillasModalField>

                <PlanillasModalField
                  id="adelanto-registrar-fecha"
                  label="Fecha (opcional)"
                  error={registerFechaError}
                >
                  <input
                    id="adelanto-registrar-fecha"
                    type="date"
                    className="form-control planillas-modal-input"
                    value={registerFecha}
                    max={today}
                    onChange={(event) => setRegisterFecha(event.target.value)}
                    disabled={registering}
                  />
                </PlanillasModalField>
              </div>

              <div className="planillas-modal-inline-actions">
                <button
                  type="button"
                  className="btn planillas-modal-actions__primary planillas-modal-inline-submit"
                  onClick={handleRegister}
                  disabled={registering}
                >
                  {registering ? 'Registrando...' : 'Registrar adelanto'}
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
    </PlanillasModalLayout>
  );
}

