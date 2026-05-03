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

        {scope === 'PRODUCTO' ? (
          <div className="mb-2">
            <label className="form-label" htmlFor="descuento_producto">Producto objetivo</label>
            <select
              id="descuento_producto"
              name="id_producto"
              className={`form-select ${errors.id_producto ? 'is-invalid' : ''}`}
              value={form.id_producto}
              onChange={onFieldChange}
            >
              <option value="">Selecciona un producto</option>
              {productos.map((producto) => (
                <option key={producto.id_producto} value={producto.id_producto}>
                  {producto.nombre_producto}
                </option>
              ))}
            </select>
            {errors.id_producto ? <div className="invalid-feedback d-block">{errors.id_producto}</div> : null}
          </div>
        ) : null}

        {scope === 'RECETA' ? (
          <div className="mb-2">
            <label className="form-label" htmlFor="descuento_receta">Receta objetivo</label>
            <select
              id="descuento_receta"
              name="id_receta"
              className={`form-select ${errors.id_receta ? 'is-invalid' : ''}`}
              value={form.id_receta}
              onChange={onFieldChange}
            >
              <option value="">Selecciona una receta</option>
              {recetas.map((receta) => (
                <option key={receta.id_receta} value={receta.id_receta}>
                  {receta.nombre_receta}
                </option>
              ))}
            </select>
            {errors.id_receta ? <div className="invalid-feedback d-block">{errors.id_receta}</div> : null}
          </div>
        ) : null}

        {scope === 'COMBO' ? (
          <div className="mb-2">
            <label className="form-label" htmlFor="descuento_combo">Combo objetivo</label>
            <select
              id="descuento_combo"
              name="id_combo"
              className={`form-select ${errors.id_combo ? 'is-invalid' : ''}`}
              value={form.id_combo}
              onChange={onFieldChange}
            >
              <option value="">Selecciona un combo</option>
              {combos.map((combo) => (
                <option key={combo.id_combo} value={combo.id_combo}>
                  {combo.descripcion || combo.nombre_combo || `Combo #${combo.id_combo}`}
                </option>
              ))}
            </select>
            {errors.id_combo ? <div className="invalid-feedback d-block">{errors.id_combo}</div> : null}
          </div>
        ) : null}

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
        row.nombre_producto,
        row.nombre_receta,
        row.nombre_combo,
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
    if (!Number.isFinite(valor) || valor < 0) {
      errors.valor_descuento = 'El valor debe ser mayor o igual a 0.';
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

    if (scope === 'PRODUCTO' && !parseId(form.id_producto)) {
      errors.id_producto = 'Selecciona un producto.';
    }
    if (scope === 'RECETA' && !parseId(form.id_receta)) {
      errors.id_receta = 'Selecciona una receta.';
    }
    if (scope === 'COMBO' && !parseId(form.id_combo)) {
      errors.id_combo = 'Selecciona un combo.';
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
        id_producto: scope === 'PRODUCTO' ? parseId(form.id_producto) : null,
        id_receta: scope === 'RECETA' ? parseId(form.id_receta) : null,
        id_combo: scope === 'COMBO' ? parseId(form.id_combo) : null,
        id_sucursal: parseId(form.id_sucursal),
        fecha_inicio: toDbDateTimeValue(form.fecha_inicio),
        fecha_fin: toDbDateTimeValue(form.fecha_fin)
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
      }

      return next;
    });
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
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
                            {row.alcance === 'PRODUCTO'
                              ? row.nombre_producto || (row.id_producto ? `Producto #${row.id_producto}` : '--')
                              : row.alcance === 'RECETA'
                                ? row.nombre_receta || (row.id_receta ? `Receta #${row.id_receta}` : '--')
                                : row.alcance === 'COMBO'
                                  ? row.nombre_combo || (row.id_combo ? `Combo #${row.id_combo}` : '--')
                                  : '--'}
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
        onClose={() => setDrawerOpen(false)}
        onSubmit={onSubmit}
        errors={formErrors}
      />
    </div>
  );
}
