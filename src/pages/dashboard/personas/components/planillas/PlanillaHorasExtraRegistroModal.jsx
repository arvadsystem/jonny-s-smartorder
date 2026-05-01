import { useCallback, useMemo, useState } from 'react';
import Select from 'react-select';

const toDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const sanitizeHoursInputValue = (value) => {
  const raw = String(value ?? '');
  if (!raw) return '';
  return raw.replace(/\D/g, '');
};

const parseHoursInputValue = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return Number.NaN;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const buildHorasExtraEmpleadoSelectStyles = () => ({
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    borderRadius: 12,
    borderColor: state.isFocused ? 'rgba(66, 127, 232, 0.72)' : 'rgba(182, 206, 247, 0.92)',
    boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(66, 127, 232, 0.2)' : 'none',
    backgroundColor: '#fff',
    '&:hover': {
      borderColor: 'rgba(66, 127, 232, 0.72)'
    }
  }),
  valueContainer: (base) => ({
    ...base,
    minHeight: 46,
    padding: '0 12px'
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0
  }),
  placeholder: (base) => ({
    ...base,
    color: 'rgba(83, 97, 124, 0.78)',
    fontSize: '1rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#25314d',
    fontSize: '1rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }),
  indicatorsContainer: (base) => ({
    ...base,
    paddingRight: 4
  }),
  indicatorSeparator: (base) => ({
    ...base,
    marginBlock: 8
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? 'rgba(35, 86, 172, 0.95)' : 'rgba(61, 98, 164, 0.72)'
  }),
  clearIndicator: (base) => ({
    ...base,
    color: 'rgba(87, 111, 156, 0.75)'
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 4000
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    border: '1px solid rgba(182, 206, 247, 0.92)',
    overflow: 'hidden',
    marginTop: 6
  }),
  option: (base, state) => ({
    ...base,
    padding: '10px 12px',
    backgroundColor: state.isFocused
      ? 'rgba(227, 236, 255, 0.92)'
      : state.isSelected
        ? 'rgba(206, 223, 255, 0.95)'
        : '#fff',
    color: '#25314d'
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontSize: '0.9rem',
    color: 'rgba(84, 106, 144, 0.86)'
  })
});

export default function PlanillaHorasExtraRegistroModal({
  open,
  registering = false,
  canRegister = false,
  empleados = [],
  defaultEmpleadoId = '',
  onClose,
  onSubmit
}) {
  const [form, setForm] = useState(() => ({
    id_empleado: defaultEmpleadoId ? String(defaultEmpleadoId) : '',
    fecha: toDateInputValue(),
    horas: '',
    observacion: ''
  }));
  const today = useMemo(() => toDateInputValue(), []);

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

  const selectedEmpleadoOption = useMemo(() => {
    const current = String(form.id_empleado || '').trim();
    if (!current) return null;
    return empleadoOptions.find((option) => option.value === current) || null;
  }, [empleadoOptions, form.id_empleado]);

  const empleadoSelectStyles = useMemo(() => buildHorasExtraEmpleadoSelectStyles(), []);

  const filterEmpleadoOption = useCallback((candidate, inputValue) => {
    const needle = String(inputValue ?? '').trim().toLowerCase();
    if (!needle) return true;
    const haystack = String(candidate?.data?.searchText || candidate?.label || '').toLowerCase();
    return haystack.includes(needle);
  }, []);

  const horasValue = parseHoursInputValue(form.horas);
  const isFutureFecha = Boolean(form.fecha) && form.fecha > today;
  const canSubmit =
    canRegister &&
    Number.isFinite(horasValue) &&
    horasValue > 0 &&
    horasValue <= 24 &&
    !isFutureFecha &&
    String(form.id_empleado || '').trim() !== '';

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    onSubmit?.({
      id_empleado: Number(form.id_empleado),
      fecha: form.fecha || null,
      horas: horasValue,
      observacion: String(form.observacion || '').trim() || null
    });
  };

  return (
    <div className="planillas-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="planillas-modal planillas-he-modal planillas-he-modal--register"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="planillas-he-modal__head">
          <div className="planillas-he-modal__title-wrap">
            <span className="planillas-he-modal__icon" aria-hidden="true">
              <i className="bi bi-plus-circle" />
            </span>
            <div>
              <h5>Registrar Hora Extra</h5>
              <p>Registra tiempo para compensacion en modalidad Tiempo x Tiempo.</p>
            </div>
          </div>
          <button type="button" className="planillas-he-modal__close" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="planillas-he-modal__body">
          <form className="planillas-he-modal__register planillas-he-modal__register--standalone" onSubmit={handleSubmit}>
            <div className="planillas-he-modal__register-grid">
              <div>
                <label className="form-label">Empleado</label>
                <Select
                  inputId="planillas-he-empleado"
                  classNamePrefix="planillas-he-rs"
                  value={selectedEmpleadoOption}
                  onChange={(option) =>
                    setForm((prev) => ({
                      ...prev,
                      id_empleado: option?.value ? String(option.value) : ''
                    }))
                  }
                  options={empleadoOptions}
                  filterOption={filterEmpleadoOption}
                  placeholder={empleadoOptions.length === 0 ? 'No hay empleados disponibles' : 'Seleccionar empleado'}
                  noOptionsMessage={({ inputValue }) =>
                    String(inputValue || '').trim()
                      ? 'Sin coincidencias'
                      : 'No hay empleados disponibles'
                  }
                  isClearable
                  isSearchable
                  isDisabled={registering || empleadoOptions.length === 0}
                  styles={empleadoSelectStyles}
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  menuPosition="fixed"
                  maxMenuHeight={280}
                />
                <small className="planillas-he-modal__register-help">Busca por nombre, DNI o cargo.</small>
              </div>

              <div>
                <label className="form-label">Fecha</label>
                <input
                  type="date"
                  className={`form-control planillas-he-modal__field-control ${isFutureFecha ? 'is-invalid' : ''}`}
                  value={form.fecha}
                  max={today}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      fecha: event.target.value
                    }))
                  }
                  disabled={registering}
                />
                {isFutureFecha ? (
                  <div className="invalid-feedback d-block">La fecha no puede ser mayor al dia actual.</div>
                ) : null}
              </div>

              <div>
                <label className="form-label">Horas</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="form-control planillas-he-modal__field-control"
                  placeholder="0"
                  value={form.horas}
                  onKeyDown={(event) => {
                    if (['e', 'E', '+', '-'].includes(event.key)) {
                      event.preventDefault();
                    }
                  }}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      horas: sanitizeHoursInputValue(event.target.value)
                    }))
                  }
                  disabled={registering}
                />
              </div>
            </div>

            <div className="planillas-he-modal__register-note">
              <label className="form-label">Observacion (opcional)</label>
              <input
                type="text"
                className="form-control planillas-he-modal__field-control"
                maxLength={255}
                placeholder="Detalle de las horas extra..."
                value={form.observacion}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    observacion: event.target.value
                  }))
                }
                disabled={registering}
              />
            </div>

            <div className="planillas-he-modal__register-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={registering}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={registering || !canSubmit}>
                {registering ? 'Registrando...' : 'Registrar hora extra'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
