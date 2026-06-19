import { useCallback, useMemo, useState } from 'react';
import Select from 'react-select';
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

const parsePositiveMoney = (value) => {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const buildInitialForm = () => ({
  id_empleado: '',
  monto: '',
  fecha: todayInput(),
  observacion: ''
});

const buildAdelantoEmpleadoSelectStyles = ({ hasError = false } = {}) => ({
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

export default function PlanillaAdelantoRegistroGlobalModal({
  open,
  registering = false,
  canRegister = false,
  empleados = [],
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => buildInitialForm());
  const [submitted, setSubmitted] = useState(false);
  const today = useMemo(() => todayInput(), []);

  const empleadoOptions = useMemo(
    () =>
      (Array.isArray(empleados) ? empleados : [])
        .map((empleado) => ({
          value: String(empleado?.value ?? ''),
          label: String(empleado?.label ?? 'Empleado'),
          searchText: String(empleado?.searchText ?? empleado?.label ?? '').toLowerCase()
        }))
        .filter((option) => option.value),
    [empleados]
  );

  const montoValue = parsePositiveMoney(form.monto);
  const empleadoId = Number(form.id_empleado);
  const hasEmpleado = Number.isFinite(empleadoId) && empleadoId > 0;
  const isFutureFecha = Boolean(form.fecha) && form.fecha > today;
  const canSubmit = canRegister && hasEmpleado && Boolean(montoValue) && !isFutureFecha;

  const selectedEmpleadoOption = useMemo(() => {
    const current = String(form.id_empleado || '').trim();
    if (!current) return null;
    return empleadoOptions.find((option) => option.value === current) || null;
  }, [empleadoOptions, form.id_empleado]);

  const empleadoError = submitted && !hasEmpleado ? 'Selecciona un empleado.' : '';
  const montoError = submitted && !montoValue ? 'Ingresa un monto valido mayor que 0.' : '';
  const fechaError = submitted && isFutureFecha ? 'La fecha no puede ser mayor al dia actual.' : '';
  const empleadoSelectStyles = useMemo(
    () => buildAdelantoEmpleadoSelectStyles({ hasError: Boolean(empleadoError) }),
    [empleadoError]
  );

  const filterEmpleadoOption = useCallback((candidate, inputValue) => {
    const needle = String(inputValue ?? '').trim().toLowerCase();
    if (!needle) return true;
    const haystack = String(candidate?.data?.searchText || candidate?.label || '').toLowerCase();
    return haystack.includes(needle);
  }, []);

  if (!open) return null;

  const handleSubmit = (event) => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    setSubmitted(true);
    if (!canSubmit) return;

    onSubmit?.({
      id_empleado: empleadoId,
      monto: montoValue,
      fecha: form.fecha || null,
      observacion: String(form.observacion || '').trim() || null
    });
  };

  return (
    <PlanillasModalLayout
      open={open}
      onClose={onClose}
      title="Registrar adelanto"
      subtitle="Registra un adelanto pendiente para un empleado de la planilla seleccionada."
      size="lg"
      className="planillas-modal-shell--adelanto"
      actions={
        <PlanillasModalActions
          onCancel={onClose}
          cancelDisabled={registering}
          primaryType="submit"
          primaryForm="planillas-adelanto-global-form"
          primaryLabel="Registrar adelanto"
          primaryLoadingLabel="Registrando..."
          primaryLoading={registering}
          primaryDisabled={!canSubmit || registering}
        />
      }
    >
      <form id="planillas-adelanto-global-form" onSubmit={handleSubmit}>
        <div className="planillas-modal-grid">
          <PlanillasModalField id="adelanto-global-empleado" label="Empleado" required error={empleadoError}>
            <Select
              inputId="adelanto-global-empleado"
              classNamePrefix="planillas-adelanto-rs"
              value={selectedEmpleadoOption}
              onChange={(option) =>
                setForm((previous) => ({
                  ...previous,
                  id_empleado: option?.value ? String(option.value) : ''
                }))
              }
              options={empleadoOptions}
              filterOption={filterEmpleadoOption}
              placeholder={empleadoOptions.length === 0 ? 'No hay empleados disponibles' : 'Seleccione empleado'}
              noOptionsMessage={({ inputValue }) =>
                String(inputValue || '').trim() ? 'Sin coincidencias' : 'No hay empleados disponibles'
              }
              isClearable
              isSearchable
              isDisabled={registering || empleadoOptions.length === 0}
              styles={empleadoSelectStyles}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              menuPosition="fixed"
              maxMenuHeight={280}
            />
          </PlanillasModalField>

          <PlanillasModalField id="adelanto-global-monto" label="Monto" required error={montoError}>
            <PlanillasMoneyInput
              id="adelanto-global-monto"
              value={form.monto}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  monto: event.target.value
                }))
              }
              currency="L"
              placeholder="Ingrese el monto"
              error={Boolean(montoError)}
              disabled={registering}
              allowThousandsSeparators
            />
          </PlanillasModalField>
        </div>

        <div className="planillas-modal-grid mt-2">
          <PlanillasModalField id="adelanto-global-fecha" label="Fecha (opcional)" error={fechaError}>
            <input
              id="adelanto-global-fecha"
              type="date"
              className="form-control planillas-modal-input"
              value={form.fecha}
              max={today}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  fecha: event.target.value
                }))
              }
              disabled={registering}
            />
          </PlanillasModalField>

          <PlanillasModalField id="adelanto-global-observacion" label="Observacion (opcional)">
            <input
              id="adelanto-global-observacion"
              type="text"
              className="form-control planillas-modal-input"
              maxLength={255}
              value={form.observacion}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  observacion: event.target.value
                }))
              }
              placeholder="Detalle del adelanto..."
              disabled={registering}
            />
          </PlanillasModalField>
        </div>
      </form>
    </PlanillasModalLayout>
  );
}
