import { useMemo, useState } from 'react';
import Select from 'react-select';
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

const buildInitialForm = ({ tipo = 'bono', selectedEmpleadoId = '', item = null } = {}) => ({
  id_empleado: selectedEmpleadoId ? String(selectedEmpleadoId) : String(item?.id_empleado || ''),
  tipo: tipo === 'deduccion' ? 'deduccion' : 'bono',
  concepto: '',
  conceptoOtro: '',
  monto: '',
  observacion: ''
});

const buildEmpleadoSelectStyles = ({ hasError = false } = {}) => ({
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    borderRadius: 12,
    borderColor: hasError
      ? 'rgba(201, 63, 63, 0.6)'
      : state.isFocused
        ? 'rgba(24, 138, 98, 0.52)'
        : 'rgba(124, 95, 73, 0.28)',
    boxShadow: hasError
      ? '0 0 0 0.2rem rgba(201, 63, 63, 0.1)'
      : state.isFocused
        ? '0 0 0 0.2rem rgba(24, 138, 98, 0.12)'
        : 'none',
    backgroundColor: '#fff',
    '&:hover': {
      borderColor: hasError ? 'rgba(201, 63, 63, 0.7)' : 'rgba(24, 138, 98, 0.45)'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    minHeight: 46,
    padding: '0 0.82rem'
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  placeholder: (base) => ({
    ...base,
    color: 'rgba(105, 74, 56, 0.55)',
    fontSize: '1rem'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#2f1a10',
    fontSize: '1rem',
    fontWeight: 500
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 6
  }),
  indicatorSeparator: (base) => ({
    ...base,
    marginTop: 10,
    marginBottom: 10,
    backgroundColor: 'rgba(124, 95, 73, 0.22)'
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'rgba(94, 66, 47, 0.92)' : 'rgba(94, 66, 47, 0.72)'
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgba(94, 66, 47, 0.62)'
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 4200
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: '1px solid rgba(124, 95, 73, 0.22)',
    overflow: 'hidden',
    marginTop: 6,
    boxShadow: '0 14px 30px rgba(60, 36, 22, 0.18)'
  }),
  option: (base, state) => ({
    ...base,
    padding: '10px 12px',
    backgroundColor: state.isFocused
      ? 'rgba(245, 235, 221, 0.95)'
      : state.isSelected
        ? 'rgba(236, 218, 198, 0.96)'
        : '#fff',
    color: '#2f1a10'
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'rgba(104, 80, 67, 0.85)',
    fontSize: '0.92rem'
  })
});

export default function PlanillaMovimientoFormModal({
  open,
  tipo = 'bono',
  item,
  allowEmployeeSelect = false,
  employees = [],
  selectedEmpleadoId = '',
  loading = false,
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => buildInitialForm({ tipo, selectedEmpleadoId, item }));
  const [submitted, setSubmitted] = useState(false);

  const conceptos = useMemo(
    () => (form.tipo === 'deduccion' ? DEDUCCION_CONCEPTOS : BONO_CONCEPTOS),
    [form.tipo]
  );

  const employeeOptions = useMemo(
    () =>
      (Array.isArray(employees) ? employees : [])
        .map((employee) => ({
          value: String(employee?.value ?? ''),
          label: String(employee?.label ?? 'Empleado'),
          searchText: String(employee?.searchText ?? employee?.label ?? '').toLowerCase()
        }))
        .filter((option) => option.value),
    [employees]
  );

  const selectedEmployee = useMemo(() => {
    const current = String(form.id_empleado || '').trim();
    if (!current) return null;
    return employeeOptions.find((option) => option.value === current) || null;
  }, [employeeOptions, form.id_empleado]);

  const selectedEmployeeName = selectedEmployee?.label || '';

  if (!open) return null;
  if (!allowEmployeeSelect && !item) return null;

  const empleadoNombre =
    allowEmployeeSelect
      ? selectedEmployeeName || 'Empleado por seleccionar'
      : item?.nombre_completo || item?.empleado_nombre || item?.nombre_empleado || 'Empleado seleccionado';

  const conceptoFinal = form.concepto === 'Otro' ? toText(form.conceptoOtro) : toText(form.concepto);
  const montoValido = parseMonto(form.monto);
  const selectedEmpleado = Number(form.id_empleado);
  const hasEmpleado = Number.isFinite(selectedEmpleado) && selectedEmpleado > 0;
  const errors = {
    empleado: submitted && allowEmployeeSelect && !hasEmpleado ? 'Seleccione un empleado.' : '',
    concepto: submitted && !conceptoFinal ? 'Seleccione o ingrese un concepto.' : '',
    monto: submitted && !montoValido ? 'Ingrese un monto mayor que 0.' : ''
  };
  const canSubmit = Boolean((!allowEmployeeSelect || hasEmpleado) && conceptoFinal && montoValido);
  const empleadoSelectStyles = buildEmpleadoSelectStyles({ hasError: Boolean(errors.empleado) });

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    if (!canSubmit) return;

    onSubmit?.({
      id_empleado: hasEmpleado ? selectedEmpleado : null,
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
          {allowEmployeeSelect ? (
            <PlanillasModalField label="Empleado" required error={errors.empleado}>
              <Select
                inputId="movimiento-empleado"
                classNamePrefix="planillas-movimiento-rs"
                value={selectedEmployee}
                onChange={(option) =>
                  setForm((previous) => ({
                    ...previous,
                    id_empleado: option?.value ? String(option.value) : ''
                  }))
                }
                options={employeeOptions}
                filterOption={(candidate, inputValue) =>
                  String(candidate?.data?.searchText || candidate?.label || '')
                    .toLowerCase()
                    .includes(String(inputValue || '').trim().toLowerCase())
                }
                placeholder={employeeOptions.length === 0 ? 'No hay empleados disponibles' : 'Seleccione empleado'}
                noOptionsMessage={({ inputValue }) =>
                  String(inputValue || '').trim() ? 'Sin coincidencias' : 'No hay empleados disponibles'
                }
                isClearable
                isSearchable
                isDisabled={loading || employeeOptions.length === 0}
                styles={empleadoSelectStyles}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
                maxMenuHeight={280}
              />
            </PlanillasModalField>
          ) : null}

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
