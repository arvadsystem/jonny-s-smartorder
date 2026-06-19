import { useMemo, useState } from 'react';

const EMPTY_FORM = Object.freeze({
  nombre_presentacion: '',
  cantidad_presentacion: '1',
  id_unidad_presentacion: '',
  cantidad_base: '',
  uso_compra: false,
  uso_receta: true,
  es_predeterminada_compra: false,
  es_predeterminada_receta: false,
  estado: true
});

const isTruthy = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  return String(value ?? '').trim().toLowerCase() === 'true';
};

const toDecimalInput = (value) => {
  const raw = String(value ?? '').replace(',', '.');
  if (!raw) return '';
  if (!/^\d*\.?\d{0,4}$/.test(raw)) return null;
  return raw;
};

const blockInvalidDecimalKeys = (event) => {
  if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault();
};

const formatQuantity = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '').trim() || '0';
  return new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  }).format(number);
};

const getUnitLabel = (unidad) => {
  const nombre = String(unidad?.nombre || '').trim();
  const simbolo = String(unidad?.simbolo || '').trim();
  if (nombre && simbolo) return `${nombre} (${simbolo})`;
  return nombre || simbolo || 'Sin unidad';
};

const buildInitialForm = (presentacion) => {
  if (!presentacion) return { ...EMPTY_FORM };
  return {
    nombre_presentacion: String(presentacion.nombre_presentacion ?? ''),
    cantidad_presentacion: String(presentacion.cantidad_presentacion ?? '1'),
    id_unidad_presentacion: String(presentacion.id_unidad_presentacion ?? ''),
    cantidad_base: String(presentacion.cantidad_base ?? ''),
    uso_compra: isTruthy(presentacion.uso_compra),
    uso_receta: isTruthy(presentacion.uso_receta),
    es_predeterminada_compra: isTruthy(presentacion.es_predeterminada_compra),
    es_predeterminada_receta: isTruthy(presentacion.es_predeterminada_receta),
    estado: isTruthy(presentacion.estado)
  };
};

export default function InsumoPresentacionForm({
  mode = 'create',
  presentacion = null,
  unidadesMedida = [],
  unidadBase = null,
  insumoActivo = true,
  saving = false,
  onCancel,
  onSubmit
}) {
  const [form, setForm] = useState(() => buildInitialForm(presentacion));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  const unidadBaseLabel = getUnitLabel(unidadBase);
  const selectedPresentacionUnidad = useMemo(
    () => (Array.isArray(unidadesMedida) ? unidadesMedida : []).find(
      (unidad) => String(unidad?.id_unidad_medida) === String(form.id_unidad_presentacion)
    ),
    [form.id_unidad_presentacion, unidadesMedida]
  );

  const previewLabel = useMemo(() => {
    const cantidadPresentacion = Number(form.cantidad_presentacion);
    const cantidadBase = Number(form.cantidad_base);
    const presentacionLabel = getUnitLabel(selectedPresentacionUnidad);
    if (!Number.isFinite(cantidadPresentacion) || cantidadPresentacion <= 0 || !Number.isFinite(cantidadBase) || cantidadBase <= 0) {
      return 'Completa las cantidades para ver la equivalencia.';
    }
    return `${formatQuantity(cantidadPresentacion)} ${presentacionLabel} equivale a ${formatQuantity(cantidadBase)} ${unidadBaseLabel}`;
  }, [form.cantidad_base, form.cantidad_presentacion, selectedPresentacionUnidad, unidadBaseLabel]);

  const setField = (field, value) => {
    setSubmitError('');
    setErrors((current) => (current[field] ? { ...current, [field]: '' } : current));
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'uso_compra' && !value) next.es_predeterminada_compra = false;
      if (field === 'uso_receta' && !value) next.es_predeterminada_receta = false;
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    const nombre = String(form.nombre_presentacion || '').trim().replace(/\s+/g, ' ');
    const cantidadPresentacion = Number(form.cantidad_presentacion);
    const cantidadBase = Number(form.cantidad_base);
    const idUnidadPresentacion = Number.parseInt(String(form.id_unidad_presentacion || ''), 10);
    const idUnidadBase = Number.parseInt(String(unidadBase?.id_unidad_medida || ''), 10);

    if (!nombre) nextErrors.nombre_presentacion = 'El nombre es obligatorio.';
    else if (nombre.length > 120) nextErrors.nombre_presentacion = 'Maximo 120 caracteres.';
    if (!Number.isFinite(cantidadPresentacion) || cantidadPresentacion <= 0) {
      nextErrors.cantidad_presentacion = 'Debe ser mayor que cero.';
    }
    if (!Number.isSafeInteger(idUnidadPresentacion) || idUnidadPresentacion <= 0) {
      nextErrors.id_unidad_presentacion = 'Selecciona una unidad de presentacion.';
    }
    if (!Number.isFinite(cantidadBase) || cantidadBase <= 0) nextErrors.cantidad_base = 'Debe ser mayor que cero.';
    if (!Number.isSafeInteger(idUnidadBase) || idUnidadBase <= 0) {
      nextErrors.id_unidad_base = 'Define primero la unidad de medida del insumo.';
    }
    if (!form.uso_compra && !form.uso_receta) nextErrors.usos = 'Activa al menos un uso.';
    if (form.es_predeterminada_compra && !form.uso_compra) {
      nextErrors.es_predeterminada_compra = 'Requiere uso en compras.';
    }
    if (form.es_predeterminada_receta && !form.uso_receta) {
      nextErrors.es_predeterminada_receta = 'Requiere uso en recetas.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      nombre_presentacion: nombre,
      cantidad_presentacion: cantidadPresentacion,
      id_unidad_presentacion: idUnidadPresentacion,
      cantidad_base: cantidadBase,
      id_unidad_base: idUnidadBase,
      uso_compra: Boolean(form.uso_compra),
      uso_receta: Boolean(form.uso_receta),
      es_predeterminada_compra: Boolean(form.es_predeterminada_compra),
      es_predeterminada_receta: Boolean(form.es_predeterminada_receta),
      estado: Boolean(form.estado)
    };
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;
    const result = await onSubmit?.(payload);
    if (!result?.ok) {
      setSubmitError(result?.message || 'No se pudo guardar la presentacion.');
    }
  };

  const changeDecimal = (field, value) => {
    const next = toDecimalInput(value);
    if (next === null) return;
    setField(field, next);
  };

  return (
    <form className="ins-pres-form inv-prod-drawer-form" onSubmit={handleSubmit}>
      <div className="ins-pres-form__grid">
        <div className="ins-pres-field is-wide">
          <label className="form-label">Nombre de la presentacion</label>
          <input
            type="text"
            className={`form-control ${errors.nombre_presentacion ? 'is-invalid' : ''}`}
            value={form.nombre_presentacion}
            onChange={(event) => setField('nombre_presentacion', event.target.value)}
            placeholder="Pieza promedio, Bote 24 oz"
            maxLength={120}
          />
          {errors.nombre_presentacion ? <div className="invalid-feedback d-block">{errors.nombre_presentacion}</div> : null}
        </div>

        <div className="ins-pres-field">
          <label className="form-label">Cantidad de presentacion</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className={`form-control ${errors.cantidad_presentacion ? 'is-invalid' : ''}`}
            value={form.cantidad_presentacion}
            onKeyDown={blockInvalidDecimalKeys}
            onChange={(event) => changeDecimal('cantidad_presentacion', event.target.value)}
          />
          {errors.cantidad_presentacion ? <div className="invalid-feedback d-block">{errors.cantidad_presentacion}</div> : null}
        </div>

        <div className="ins-pres-field">
          <label className="form-label">Unidad de presentacion</label>
          <select
            className={`form-select ${errors.id_unidad_presentacion ? 'is-invalid' : ''}`}
            value={form.id_unidad_presentacion}
            onChange={(event) => setField('id_unidad_presentacion', event.target.value)}
          >
            <option value="">Selecciona unidad</option>
            {(Array.isArray(unidadesMedida) ? unidadesMedida : []).map((unidad) => (
              <option key={unidad.id_unidad_medida} value={unidad.id_unidad_medida}>
                {getUnitLabel(unidad)}
              </option>
            ))}
          </select>
          {errors.id_unidad_presentacion ? <div className="invalid-feedback d-block">{errors.id_unidad_presentacion}</div> : null}
        </div>

        <div className="ins-pres-field">
          <label className="form-label">Equivale a</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className={`form-control ${errors.cantidad_base ? 'is-invalid' : ''}`}
            value={form.cantidad_base}
            onKeyDown={blockInvalidDecimalKeys}
            onChange={(event) => changeDecimal('cantidad_base', event.target.value)}
          />
          {errors.cantidad_base ? <div className="invalid-feedback d-block">{errors.cantidad_base}</div> : null}
        </div>

        <div className="ins-pres-field">
          <label className="form-label">Unidad de inventario</label>
          <input className="form-control" value={unidadBaseLabel} readOnly disabled />
          {errors.id_unidad_base ? <div className="invalid-feedback d-block">{errors.id_unidad_base}</div> : null}
        </div>
      </div>

      <div className="ins-pres-preview">
        <i className="bi bi-arrow-left-right" aria-hidden="true" />
        <span>{previewLabel}</span>
      </div>

      <div className="ins-pres-switch-grid">
        <label className="ins-pres-switch">
          <input type="checkbox" checked={form.uso_compra} onChange={(event) => setField('uso_compra', event.target.checked)} />
          <span>Uso en compras</span>
        </label>
        <label className="ins-pres-switch">
          <input type="checkbox" checked={form.uso_receta} onChange={(event) => setField('uso_receta', event.target.checked)} />
          <span>Uso en recetas</span>
        </label>
        <label className={`ins-pres-switch ${!form.uso_compra ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={form.es_predeterminada_compra}
            disabled={!form.uso_compra}
            onChange={(event) => setField('es_predeterminada_compra', event.target.checked)}
          />
          <span>Predeterminada para compras</span>
        </label>
        <label className={`ins-pres-switch ${!form.uso_receta ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={form.es_predeterminada_receta}
            disabled={!form.uso_receta}
            onChange={(event) => setField('es_predeterminada_receta', event.target.checked)}
          />
          <span>Predeterminada para recetas</span>
        </label>
        <label className={`ins-pres-switch ${mode === 'create' ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            checked={form.estado}
            disabled={mode === 'create' || (!insumoActivo && !form.estado)}
            onChange={(event) => setField('estado', event.target.checked)}
          />
          <span>Estado activo</span>
        </label>
      </div>

      {errors.usos ? <div className="alert alert-warning py-2 mb-0">{errors.usos}</div> : null}
      {submitError ? <div className="alert alert-danger py-2 mb-0">{submitError}</div> : null}

      <div className="ins-pres-form__footer">
        <button type="button" className="btn inv-prod-btn-subtle" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn inv-prod-btn-primary" disabled={saving || !unidadBase?.id_unidad_medida}>
          {saving ? 'Guardando...' : mode === 'edit' ? 'Guardar cambios' : 'Agregar presentacion'}
        </button>
      </div>
    </form>
  );
}
