import { useEffect, useMemo, useState } from 'react';
import PlanillasModalActions from './PlanillasModalActions';
import PlanillasModalField from './PlanillasModalField';
import PlanillasModalLayout from './PlanillasModalLayout';
import PlanillasMoneyInput from './PlanillasMoneyInput';
import PlanillasSegmentedToggle from './PlanillasSegmentedToggle';

const BONO_CONCEPTOS = ['Bono por puntualidad', 'Bono por productividad', 'Comision', 'Reconocimiento', 'Otro'];
const DEDUCCION_CONCEPTOS = ['IHSS', 'RAP', 'Faltante de caja', 'Prestamo', 'Adelanto de salario', 'Otro'];

const MOVIMIENTO_TIPO_OPTIONS = [
  { value: 'bono', label: 'Bono / Ingreso', iconClass: 'bi bi-plus-lg', tone: 'bono' },
  { value: 'deduccion', label: 'Deduccion', iconClass: 'bi bi-dash-lg', tone: 'deduccion' }
];

const toText = (value) => String(value ?? '').trim();

const parseMonto = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

export default function PlanillaMovimientoFormModal({
  open,
  tipo = 'bono',
  item,
  loading = false,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState({
    tipo: 'bono',
    concepto: '',
    conceptoOtro: '',
    monto: '',
    observacion: ''
  });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      tipo: tipo === 'deduccion' ? 'deduccion' : 'bono',
      concepto: '',
      conceptoOtro: '',
      monto: '',
      observacion: ''
    });
    setSubmitted(false);
  }, [open, tipo]);

  const conceptos = useMemo(
    () => (form.tipo === 'deduccion' ? DEDUCCION_CONCEPTOS : BONO_CONCEPTOS),
    [form.tipo]
  );

  if (!open || !item) return null;

  const empleadoNombre =
    item.nombre_completo || item.empleado_nombre || item.nombre_empleado || 'Empleado seleccionado';

  const conceptoFinal = form.concepto === 'Otro' ? toText(form.conceptoOtro) : toText(form.concepto);
  const montoValido = parseMonto(form.monto);
  const errors = {
    concepto: submitted && !conceptoFinal ? 'Seleccione o ingrese un concepto.' : '',
    monto: submitted && !montoValido ? 'Ingrese un monto mayor que 0.' : ''
  };
  const canSubmit = Boolean(conceptoFinal && montoValido);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;

    onSubmit?.({
      tipo: form.tipo,
      concepto: conceptoFinal,
      monto: montoValido,
      observacion: toText(form.observacion) || null
    });
  };

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Agregar Movimiento"
      subtitle={`Para: ${empleadoNombre}`}
      size="lg"
      className="planillas-modal-shell--movimiento"
      actions={
        <PlanillasModalActions
          onCancel={onClose}
          cancelDisabled={loading}
          primaryLabel="Guardar Movimiento"
          primaryLoadingLabel="Guardando..."
          primaryDisabled={!canSubmit || loading}
          primaryLoading={loading}
          primaryType="submit"
          primaryForm="planilla-mov-form"
        />
      }
    >
      <form id="planilla-mov-form" className="planillas-modal-form" onSubmit={handleSubmit}>
        <section className="planillas-modal-section">
          <PlanillasModalField label="Tipo de Movimiento" required>
            <PlanillasSegmentedToggle
              options={MOVIMIENTO_TIPO_OPTIONS}
              value={form.tipo}
              onChange={(newTipo) =>
                setForm((previous) => ({
                  ...previous,
                  tipo: newTipo,
                  concepto: '',
                  conceptoOtro: ''
                }))
              }
              disabled={loading}
            />
          </PlanillasModalField>

          <PlanillasModalField id="movimiento-concepto" label="Concepto" required error={errors.concepto}>
            <select
              id="movimiento-concepto"
              className={`form-select planillas-modal-select ${errors.concepto ? 'is-invalid' : ''}`}
              value={form.concepto}
              onChange={(event) => setForm((previous) => ({ ...previous, concepto: event.target.value }))}
            >
              <option value="">Seleccione...</option>
              {conceptos.map((concepto) => (
                <option key={`${form.tipo}-${concepto}`} value={concepto}>
                  {concepto}
                </option>
              ))}
            </select>
          </PlanillasModalField>

          {form.concepto === 'Otro' ? (
            <PlanillasModalField id="movimiento-concepto-otro" label="Concepto personalizado" required>
              <input
                id="movimiento-concepto-otro"
                type="text"
                className="form-control planillas-modal-input"
                value={form.conceptoOtro}
                onChange={(event) => setForm((previous) => ({ ...previous, conceptoOtro: event.target.value }))}
                maxLength={120}
                placeholder="Escriba el concepto..."
              />
            </PlanillasModalField>
          ) : null}

          <PlanillasModalField id="movimiento-monto" label="Monto" required error={errors.monto}>
            <PlanillasMoneyInput
              id="movimiento-monto"
              currency="L"
              value={form.monto}
              onChange={(event) => setForm((previous) => ({ ...previous, monto: event.target.value }))}
              placeholder="Ingrese el monto"
              error={Boolean(errors.monto)}
              disabled={loading}
            />
          </PlanillasModalField>

          <PlanillasModalField id="movimiento-observacion" label="Observaciones">
            <textarea
              id="movimiento-observacion"
              className="form-control planillas-modal-textarea"
              value={form.observacion}
              onChange={(event) => setForm((previous) => ({ ...previous, observacion: event.target.value }))}
              rows={3}
              maxLength={255}
              placeholder="Detalles adicionales (opcional)..."
            />
          </PlanillasModalField>
        </section>
      </form>
    </PlanillasModalLayout>
  );
}
