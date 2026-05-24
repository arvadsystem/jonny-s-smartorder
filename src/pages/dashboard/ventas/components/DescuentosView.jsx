import { useCallback, useEffect, useMemo, useState } from 'react';
import SinPermiso from '../../../../components/common/SinPermiso';
import ventasService from '../../../../services/ventasService';
import { PERMISSIONS } from '../../../../utils/permissions';
import { extractApiMessage } from '../utils/ventasHelpers';

const initialForm = {
  nombre_descuento: '',
  descripcion: '',
  valor_descuento: '',
  id_tipo_descuento: '',
  estado: true,
  alcance: 'FACTURA_COMPLETA',
  id_producto: '',
  id_receta: '',
  id_combo: '',
  objetivos: {
    productos: [],
    recetas: [],
    combos: []
  },
  id_sucursal: '',
  fecha_inicio: '',
  fecha_fin: ''
};

const DESCUENTO_SCOPE_OPTIONS = [
  { value: 'FACTURA_COMPLETA', label: 'Factura completa' },
  { value: 'PRODUCTO', label: 'Producto' },
  { value: 'RECETA', label: 'Receta' },
  { value: 'COMBO', label: 'Combo' }
];

const normalizeScope = (value) => String(value || 'FACTURA_COMPLETA').trim().toUpperCase();
const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isTruthyState = (value) => value === true || value === 'true' || value === 1 || value === '1';

const isPorcentajeTipo = (tipoName) =>
  String(tipoName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .includes('PORCENTAJE');

const toInputDateTimeValue = (value) => {
  const source = String(value || '').trim();
  if (!source) return '';
  return source.replace(' ', 'T').slice(0, 16);
};

const toDbDateTimeValue = (value) => {
  const source = String(value || '').trim();
  if (!source) return null;
  return `${source.replace('T', ' ')}:00`;
};

const coerceIdList = (values) =>
  [...new Set((Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0))];

const getObjectiveConfig = (scope) => {
  if (scope === 'PRODUCTO') {
    return {
      key: 'productos',
      idKey: 'id_producto',
      labelKey: 'nombre_producto',
      emptyText: 'No hay productos disponibles para seleccionar.',
      searchPlaceholder: 'Buscar productos...'
    };
  }
  if (scope === 'RECETA') {
    return {
      key: 'recetas',
      idKey: 'id_receta',
      labelKey: 'nombre_receta',
      emptyText: 'No hay recetas disponibles para seleccionar.',
      searchPlaceholder: 'Buscar recetas...'
    };
  }
  if (scope === 'COMBO') {
    return {
      key: 'combos',
      idKey: 'id_combo',
      labelKey: 'descripcion',
      fallbackLabelKey: 'nombre_combo',
      emptyText: 'No hay combos disponibles para seleccionar.',
      searchPlaceholder: 'Buscar combos...'
    };
  }
  return null;
};

function ObjetivosChecklist({
  scope,
  form,
  productos,
  recetas,
  combos,
  onObjetivosChange,
  errors
}) {
  const [search, setSearch] = useState('');
  const config = getObjectiveConfig(scope);

  useEffect(() => {
    setSearch('');
  }, [scope]);

  if (!config) {
    return (
      <div className="ventas-descuentos-targets__empty">
        <i className="bi bi-receipt" />
        <span>Factura completa no requiere objetivos.</span>
      </div>
    );
  }

  const sourceRows = scope === 'PRODUCTO' ? productos : scope === 'RECETA' ? recetas : combos;
  const selectedIds = coerceIdList(form.objetivos?.[config.key]);
  const selectedSet = new Set(selectedIds);
  const sucursalFilter = parseId(form.id_sucursal);
  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = (Array.isArray(sourceRows) ? sourceRows : [])
    .filter((row) => {
      if (!sucursalFilter || !row?.id_sucursal) return true;
      return Number(row.id_sucursal) === Number(sucursalFilter);
    })
    .filter((row) => {
      if (!normalizedSearch) return true;
      const label = String(row?.[config.labelKey] || row?.[config.fallbackLabelKey] || '').toLowerCase();
      return label.includes(normalizedSearch);
    });

  const setSelectedIds = (nextIds) => {
    onObjetivosChange(config.key, coerceIdList(nextIds));
  };

  const toggleId = (id) => {
    if (selectedSet.has(id)) {
      setSelectedIds(selectedIds.filter((value) => value !== id));
      return;
    }
    setSelectedIds([...selectedIds, id]);
  };

  const selectVisible = () => {
    setSelectedIds([...selectedIds, ...visibleRows.map((row) => Number(row?.[config.idKey])).filter(Boolean)]);
  };

  return (
    <section className="ventas-descuentos-targets">
      <div className="ventas-descuentos-targets__head">
        <div>
          <strong>Objetivos</strong>
          <span>{selectedIds.length} seleccionado(s)</span>
        </div>
        <div className="ventas-descuentos-targets__actions">
          <button type="button" onClick={selectVisible} disabled={visibleRows.length === 0}>
            Seleccionar visibles
          </button>
          <button type="button" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
            Limpiar
          </button>
        </div>
      </div>

      <label className="ventas-descuentos-targets__search">
        <i className="bi bi-search" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={config.searchPlaceholder}
        />
      </label>

      <div className="ventas-descuentos-targets__list">
        {visibleRows.length === 0 ? (
          <div className="ventas-descuentos-targets__empty">{config.emptyText}</div>
        ) : (
          visibleRows.map((row) => {
            const id = Number(row?.[config.idKey]);
            const label = String(row?.[config.labelKey] || row?.[config.fallbackLabelKey] || `${scope} #${id}`);
            const checked = selectedSet.has(id);
            return (
              <label key={`${config.key}-${id}`} className={`ventas-descuentos-targets__option ${checked ? 'is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleId(id)}
                />
                <span>{label}</span>
              </label>
            );
          })
        )}
      </div>

      {errors?.objetivos ? <div className="invalid-feedback d-block">{errors.objetivos}</div> : null}
    </section>
  );
}

function DescuentoFormDrawer({
  open,
  mode,
  form,
  saving,
  tiposDescuento,
  productos,
  recetas,
  combos,
  sucursales,
  canSelectSucursal,
  onFieldChange,
  onObjetivosChange,
  onClose,
  onSubmit,
  errors
}) {
  const scope = normalizeScope(form.alcance);

  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${open ? 'show' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="inv-prod-drawer-head">
        <i className="bi bi-tags inv-cat-v2__drawer-mark" aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">{mode === 'create' ? 'Nuevo descuento' : 'Editar descuento'}</div>
          <div className="inv-prod-drawer-sub">Configura descuentos por alcance, vigencia y sucursal.</div>
        </div>
        <button type="button" className="inv-prod-drawer-close" onClick={onClose} title="Cerrar" disabled={saving}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={onSubmit}>
        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_nombre">Nombre</label>
          <input
            id="descuento_nombre"
            name="nombre_descuento"
            className={`form-control ${errors.nombre_descuento ? 'is-invalid' : ''}`}
            value={form.nombre_descuento}
            onChange={onFieldChange}
            placeholder="Ej: Descuento de temporada"
          />
          {errors.nombre_descuento ? <div className="invalid-feedback d-block">{errors.nombre_descuento}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_tipo">Tipo de descuento</label>
          <select
            id="descuento_tipo"
            name="id_tipo_descuento"
            className={`form-select ${errors.id_tipo_descuento ? 'is-invalid' : ''}`}
            value={form.id_tipo_descuento}
            onChange={onFieldChange}
          >
            <option value="">Selecciona un tipo</option>
            {tiposDescuento.map((tipo) => (
              <option key={tipo.id_tipo_descuento} value={tipo.id_tipo_descuento}>
                {tipo.nombre_tipo_descuento}
              </option>
            ))}
          </select>
          {errors.id_tipo_descuento ? <div className="invalid-feedback d-block">{errors.id_tipo_descuento}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_valor">Valor</label>
          <input
            id="descuento_valor"
            name="valor_descuento"
            type="number"
            min="0"
            step="0.01"
            className={`form-control ${errors.valor_descuento ? 'is-invalid' : ''}`}
            value={form.valor_descuento}
            onChange={onFieldChange}
            placeholder="Ej: 15"
          />
          {errors.valor_descuento ? <div className="invalid-feedback d-block">{errors.valor_descuento}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_alcance">Alcance</label>
          <select
            id="descuento_alcance"
            name="alcance"
            className={`form-select ${errors.alcance ? 'is-invalid' : ''}`}
            value={form.alcance}
            onChange={onFieldChange}
          >
            {DESCUENTO_SCOPE_OPTIONS.map((scopeOption) => (
              <option key={scopeOption.value} value={scopeOption.value}>
                {scopeOption.label}
              </option>
            ))}
          </select>
          {errors.alcance ? <div className="invalid-feedback d-block">{errors.alcance}</div> : null}
        </div>

        <ObjetivosChecklist
          scope={scope}
          form={form}
          productos={productos}
          recetas={recetas}
          combos={combos}
          onObjetivosChange={onObjetivosChange}
          errors={errors}
        />

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_sucursal">Sucursal</label>
          <select
            id="descuento_sucursal"
            name="id_sucursal"
            className="form-select"
            value={form.id_sucursal}
            onChange={onFieldChange}
            disabled={!canSelectSucursal}
          >
            <option value="">Global / todas las sucursales</option>
            {sucursales.map((sucursal) => (
              <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                {sucursal.nombre_sucursal}
              </option>
            ))}
          </select>
        </div>

        <div className="row g-2 mb-2">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="descuento_fecha_inicio">Fecha inicio</label>
            <input
              id="descuento_fecha_inicio"
              name="fecha_inicio"
              type="datetime-local"
              className={`form-control ${errors.fecha_inicio ? 'is-invalid' : ''}`}
              value={form.fecha_inicio}
              onChange={onFieldChange}
            />
            {errors.fecha_inicio ? <div className="invalid-feedback d-block">{errors.fecha_inicio}</div> : null}
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="descuento_fecha_fin">Fecha fin</label>
            <input
              id="descuento_fecha_fin"
              name="fecha_fin"
              type="datetime-local"
              className={`form-control ${errors.fecha_fin ? 'is-invalid' : ''}`}
              value={form.fecha_fin}
              onChange={onFieldChange}
            />
            {errors.fecha_fin ? <div className="invalid-feedback d-block">{errors.fecha_fin}</div> : null}
          </div>
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_desc">Descripcion (opcional)</label>
          <textarea
            id="descuento_desc"
            name="descripcion"
            className="form-control"
            rows={3}
            value={form.descripcion}
            onChange={onFieldChange}
            maxLength={250}
          />
        </div>

        <div className="form-check mt-2 mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="descuento_estado"
            name="estado"
            checked={!!form.estado}
            onChange={onFieldChange}
          />
          <label className="form-check-label" htmlFor="descuento_estado">
            Activo
          </label>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving}>
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </form>
    </aside>
  );
}

const normalizeDiscountRow = (row) => ({
  ...row,
  id_descuento_catalogo: Number(row?.id_descuento_catalogo ?? 0) || null,
  id_tipo_descuento: Number(row?.id_tipo_descuento ?? 0) || null,
  nombre_descuento: String(row?.nombre_descuento ?? 'Descuento'),
  descripcion: String(row?.descripcion ?? ''),
  nombre_tipo_descuento: String(row?.nombre_tipo_descuento ?? ''),
  valor_descuento: Number(row?.valor_descuento ?? 0) || 0,
  estado: isTruthyState(row?.estado),
  alcance: normalizeScope(row?.alcance),
  id_producto: Number(row?.id_producto ?? 0) || null,
  id_receta: Number(row?.id_receta ?? 0) || null,
  id_combo: Number(row?.id_combo ?? 0) || null,
  objetivos: {
    productos: Array.isArray(row?.objetivos?.productos) ? row.objetivos.productos : [],
    recetas: Array.isArray(row?.objetivos?.recetas) ? row.objetivos.recetas : [],
    combos: Array.isArray(row?.objetivos?.combos) ? row.objetivos.combos : []
  },
  objetivos_count: row?.objetivos_count || { productos: 0, recetas: 0, combos: 0, total: 0 },
  objetivo: String(row?.objetivo ?? ''),
  id_sucursal: Number(row?.id_sucursal ?? 0) || null,
  fecha_inicio: row?.fecha_inicio ?? null,
  fecha_fin: row?.fecha_fin ?? null,
  nombre_producto: String(row?.nombre_producto ?? ''),
  nombre_receta: String(row?.nombre_receta ?? ''),
  nombre_combo: String(row?.nombre_combo ?? ''),
  nombre_sucursal: String(row?.nombre_sucursal ?? '')
});

export default function DescuentosView({
  canView,
  canCreate,
  canEdit,
  canToggle,
  productos = [],
  recetas = [],
  combos = [],
  sucursales = [],
  isSuperAdmin = false,
  defaultSucursalId = null
}) {
  const [rows, setRows] = useState([]);
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...initialForm });
  const [formErrors, setFormErrors] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [descuentosResponse, tiposResponse] = await Promise.all([
        ventasService.listDescuentosCatalogosAdmin(),
        ventasService.getTiposDescuentoCatalog()
      ]);
      setRows((Array.isArray(descuentosResponse) ? descuentosResponse : []).map(normalizeDiscountRow));
      setTiposDescuento(
        (Array.isArray(tiposResponse) ? tiposResponse : [])
          .filter((tipo) => tipo && isTruthyState(tipo.estado))
          .map((tipo) => ({
            id_tipo_descuento: Number(tipo.id_tipo_descuento ?? 0) || null,
            nombre_tipo_descuento: String(tipo.nombre_tipo_descuento ?? '')
          }))
          .filter((tipo) => tipo.id_tipo_descuento)
      );
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudo cargar el catalogo de descuentos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void loadData();
  }, [canView, loadData]);

  const filteredRows = useMemo(() => {
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.nombre_descuento,
        row.descripcion,
        row.nombre_tipo_descuento,
        row.alcance,
        row.objetivo,
        row.nombre_producto,
        row.nombre_receta,
        row.nombre_combo,
        ...(row.objetivos?.productos || []).map((item) => item.nombre_producto),
        ...(row.objetivos?.recetas || []).map((item) => item.nombre_receta),
        ...(row.objetivos?.combos || []).map((item) => item.nombre_combo),
        row.nombre_sucursal
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search]);

  const resetForm = () => {
    setForm({
      ...initialForm,
      objetivos: { productos: [], recetas: [], combos: [] },
      id_sucursal: !isSuperAdmin && defaultSucursalId ? String(defaultSucursalId) : ''
    });
    setFormErrors({});
    setEditId(null);
  };

  const openCreate = () => {
    if (!canCreate) return;
    setDrawerMode('create');
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    if (!canEdit) return;
    setDrawerMode('edit');
    setEditId(row.id_descuento_catalogo);
    setFormErrors({});
    setForm({
      nombre_descuento: row.nombre_descuento,
      descripcion: row.descripcion || '',
      valor_descuento: String(row.valor_descuento),
      id_tipo_descuento: String(row.id_tipo_descuento || ''),
      estado: !!row.estado,
      alcance: normalizeScope(row.alcance),
      id_producto: row.id_producto ? String(row.id_producto) : '',
      id_receta: row.id_receta ? String(row.id_receta) : '',
      id_combo: row.id_combo ? String(row.id_combo) : '',
      objetivos: {
        productos: coerceIdList([
          ...(row.objetivos?.productos || []).map((item) => item.id_producto),
          row.id_producto
        ]),
        recetas: coerceIdList([
          ...(row.objetivos?.recetas || []).map((item) => item.id_receta),
          row.id_receta
        ]),
        combos: coerceIdList([
          ...(row.objetivos?.combos || []).map((item) => item.id_combo),
          row.id_combo
        ])
      },
      id_sucursal: row.id_sucursal ? String(row.id_sucursal) : '',
      fecha_inicio: toInputDateTimeValue(row.fecha_inicio),
      fecha_fin: toInputDateTimeValue(row.fecha_fin)
    });
    setDrawerOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!String(form.nombre_descuento || '').trim()) {
      errors.nombre_descuento = 'El nombre es obligatorio.';
    }

    const valor = Number(form.valor_descuento);
    if (!Number.isFinite(valor) || valor <= 0) {
      errors.valor_descuento = 'El valor debe ser mayor a 0.';
    }

    if (!Number(form.id_tipo_descuento)) {
      errors.id_tipo_descuento = 'Selecciona un tipo de descuento.';
    }

    const scope = normalizeScope(form.alcance);
    if (!scope) {
      errors.alcance = 'Selecciona un alcance valido.';
    }

    const tipoSeleccionado = tiposDescuento.find(
      (row) => String(row.id_tipo_descuento) === String(form.id_tipo_descuento)
    );
    if (isPorcentajeTipo(tipoSeleccionado?.nombre_tipo_descuento) && (valor < 0 || valor > 100)) {
      errors.valor_descuento = 'Para porcentaje, el valor debe estar entre 0 y 100.';
    }

    const objetivos = form.objetivos || {};
    if (scope === 'PRODUCTO' && coerceIdList(objetivos.productos).length === 0) {
      errors.objetivos = 'Selecciona al menos un producto.';
    }
    if (scope === 'RECETA' && coerceIdList(objetivos.recetas).length === 0) {
      errors.objetivos = 'Selecciona al menos una receta.';
    }
    if (scope === 'COMBO' && coerceIdList(objetivos.combos).length === 0) {
      errors.objetivos = 'Selecciona al menos un combo.';
    }

    const start = form.fecha_inicio ? new Date(form.fecha_inicio) : null;
    const end = form.fecha_fin ? new Date(form.fecha_fin) : null;
    if (start && Number.isNaN(start.getTime())) {
      errors.fecha_inicio = 'Fecha inicio invalida.';
    }
    if (end && Number.isNaN(end.getTime())) {
      errors.fecha_fin = 'Fecha fin invalida.';
    }
    if (start && end && end < start) {
      errors.fecha_fin = 'Fecha fin no puede ser menor a fecha inicio.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError('');
    try {
      const scope = normalizeScope(form.alcance);
      const payload = {
        nombre_descuento: String(form.nombre_descuento || '').trim(),
        descripcion: String(form.descripcion || '').trim() || null,
        valor_descuento: Number(form.valor_descuento),
        id_tipo_descuento: Number(form.id_tipo_descuento),
        estado: !!form.estado,
        alcance: scope,
        id_sucursal: parseId(form.id_sucursal),
        fecha_inicio: toDbDateTimeValue(form.fecha_inicio),
        fecha_fin: toDbDateTimeValue(form.fecha_fin),
        objetivos: {
          productos: scope === 'PRODUCTO' ? coerceIdList(form.objetivos?.productos) : [],
          recetas: scope === 'RECETA' ? coerceIdList(form.objetivos?.recetas) : [],
          combos: scope === 'COMBO' ? coerceIdList(form.objetivos?.combos) : []
        }
      };

      if (drawerMode === 'create') {
        await ventasService.createDescuentoCatalogo(payload);
      } else {
        await ventasService.updateDescuentoCatalogo(editId, payload);
      }

      setDrawerOpen(false);
      await loadData();
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudo guardar el descuento de catalogo.'));
    } finally {
      setSaving(false);
    }
  };

  const onFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };

      if (name === 'alcance') {
        next.id_producto = '';
        next.id_receta = '';
        next.id_combo = '';
        next.objetivos = { productos: [], recetas: [], combos: [] };
      }

      return next;
    });
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const onObjetivosChange = (key, ids) => {
    setForm((prev) => ({
      ...prev,
      objetivos: {
        productos: key === 'productos' ? coerceIdList(ids) : coerceIdList(prev.objetivos?.productos),
        recetas: key === 'recetas' ? coerceIdList(ids) : coerceIdList(prev.objetivos?.recetas),
        combos: key === 'combos' ? coerceIdList(ids) : coerceIdList(prev.objetivos?.combos)
      }
    }));
    setFormErrors((prev) => ({ ...prev, objetivos: '' }));
  };

  const onToggleEstado = async (row, nextEstado) => {
    if (!canToggle) return;
    try {
      await ventasService.toggleDescuentoCatalogoEstado(row.id_descuento_catalogo, !!nextEstado);
      await loadData();
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudo cambiar el estado del descuento.'));
    }
  };

  if (!canView) {
    return <SinPermiso permiso={PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_VER} />;
  }

  return (
    <div className="ventas-page ventas-descuentos-page">
      <div className="inv-catpro-card inv-prod-card mb-3">
        <div className="inv-prod-header ventas-page__toolbar">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-tags inv-prod-title-icon" />
              <span className="inv-prod-title">Descuentos</span>
            </div>
            <div className="inv-prod-subtitle">Catalogo maestro de descuentos para Caja.</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions">
            <label className="inv-ins-search" aria-label="Buscar descuentos">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por nombre, tipo, alcance o objetivo..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            {canCreate ? (
              <button type="button" className="inv-prod-toolbar-btn" onClick={openCreate}>
                <i className="bi bi-plus-circle" />
                <span>Nuevo descuento</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="d-flex align-items-center gap-2 p-3">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando descuentos...</span>
            </div>
          ) : (
            <div className="ventas-page__table-card">
              <div className="ventas-page__table-wrap">
                <table className="table align-middle ventas-page__table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Alcance</th>
                      <th>Objetivo</th>
                      <th>Sucursal</th>
                      <th>Vigencia</th>
                      <th>Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-4">No hay descuentos en el catalogo.</td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id_descuento_catalogo} className="ventas-page__table-row">
                          <td>
                            <div className="ventas-page__table-sale">
                              <strong>{row.nombre_descuento}</strong>
                              <span>{row.descripcion || 'Sin descripcion'}</span>
                            </div>
                          </td>
                          <td>{row.nombre_tipo_descuento}</td>
                          <td>{Number(row.valor_descuento).toFixed(2)}</td>
                          <td>{row.alcance}</td>
                          <td>
                            <div className="ventas-descuentos-objective">
                              <strong>{row.objetivo || '--'}</strong>
                              {row.objetivos_count?.total > 1 ? (
                                <span>{row.objetivos_count.total} objetivos</span>
                              ) : null}
                            </div>
                          </td>
                          <td>{row.nombre_sucursal || (row.id_sucursal ? `Sucursal #${row.id_sucursal}` : 'Global')}</td>
                          <td>
                            {(row.fecha_inicio || row.fecha_fin)
                              ? `${row.fecha_inicio ? String(row.fecha_inicio).slice(0, 16).replace('T', ' ') : '--'} / ${row.fecha_fin ? String(row.fecha_fin).slice(0, 16).replace('T', ' ') : '--'}`
                              : 'Sin vigencia'}
                          </td>
                          <td>
                            <span className={`ventas-page__table-pill ${row.estado ? '' : 'is-soft-muted'}`}>
                              {row.estado ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex align-items-center justify-content-end gap-2">
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="ventas-page__table-detail-btn"
                                  onClick={() => openEdit(row)}
                                  title="Editar"
                                >
                                  <i className="bi bi-pencil" />
                                </button>
                              ) : null}

                              {canToggle ? (
                                <button
                                  type="button"
                                  className="ventas-page__table-detail-btn"
                                  onClick={() => onToggleEstado(row, !row.estado)}
                                  title={row.estado ? 'Inactivar' : 'Activar'}
                                >
                                  <i className={`bi ${row.estado ? 'bi-toggle-on' : 'bi-toggle-off'}`} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${drawerOpen ? 'show' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />

      <DescuentoFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        form={form}
        saving={saving}
        tiposDescuento={tiposDescuento}
        productos={Array.isArray(productos) ? productos : []}
        recetas={Array.isArray(recetas) ? recetas : []}
        combos={Array.isArray(combos) ? combos : []}
        sucursales={Array.isArray(sucursales) ? sucursales : []}
        canSelectSucursal={isSuperAdmin}
        onFieldChange={onFieldChange}
        onObjetivosChange={onObjetivosChange}
        onClose={() => setDrawerOpen(false)}
        onSubmit={onSubmit}
        errors={formErrors}
      />
    </div>
  );
}
