import { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import { usePermisos } from '../../../context/PermisosContext';
import extrasAdminService from '../../../services/extrasAdminService';
import { PERMISSIONS } from '../../../utils/permissions';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';
import MenuFiltersDrawer from './components/MenuFiltersDrawer';

const emptyForm = {
  codigo: '',
  nombre: '',
  precio_adicional: '',
  id_insumo: '',
  cant: '',
  id_unidad_medida: '',
  orden: '0',
  estado: true,
  recetas: [],
  combos: []
};

const normalizeRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

const money = (value) => {
  const parsed = Number(value);
  return `L. ${Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'}`;
};

const buildCode = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ExtrasAdmin = () => {
  const { canAny } = usePermisos();
  const [extras, setExtras] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [showInactiveOnly, setShowInactiveOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('recientes');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [toastMessage, setToastMessage] = useState('');
  const [estadoConfirm, setEstadoConfirm] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const canCreateExtra = canAny([PERMISSIONS.MENU_EXTRAS_CREAR, PERMISSIONS.MENU_VER]);
  const canEditExtra = canAny([PERMISSIONS.MENU_EXTRAS_EDITAR, PERMISSIONS.MENU_VER]);
  const canToggleExtra = canAny([PERMISSIONS.MENU_EXTRAS_ESTADO_CAMBIAR, PERMISSIONS.MENU_VER]);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [extrasResponse, insumosResponse, recetasResponse, combosResponse] = await Promise.all([
        extrasAdminService.listarExtras(),
        extrasAdminService.listarInsumos(),
        extrasAdminService.listarRecetas(),
        extrasAdminService.listarCombos()
      ]);
      setExtras(normalizeRows(extrasResponse));
      setInsumos(normalizeRows(insumosResponse));
      setRecetas(normalizeRows(recetasResponse));
      setCombos(normalizeRows(combosResponse));
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los extras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  const extrasFiltrados = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    return extras.filter((extra) => {
      const isActive = Boolean(extra?.estado);
      if (showInactiveOnly) {
        if (isActive) return false;
      } else if (!isActive) {
        return false;
      }
      if (!term) return true;
      return (
        String(extra?.nombre || '').toLowerCase().includes(term) ||
        String(extra?.codigo || '').toLowerCase().includes(term) ||
        String(extra?.nombre_insumo || '').toLowerCase().includes(term)
      );
    });
  }, [extras, search, showInactiveOnly]);

  const extrasVisibles = useMemo(() => {
    const rows = [...extrasFiltrados];
    if (sortBy === 'nombre_asc') return rows.sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || ''), 'es'));
    if (sortBy === 'nombre_desc') return rows.sort((a, b) => String(b?.nombre || '').localeCompare(String(a?.nombre || ''), 'es'));
    if (sortBy === 'precio_asc') return rows.sort((a, b) => Number(a?.precio_adicional || 0) - Number(b?.precio_adicional || 0));
    if (sortBy === 'precio_desc') return rows.sort((a, b) => Number(b?.precio_adicional || 0) - Number(a?.precio_adicional || 0));
    return rows.sort((a, b) => Number(b?.id_extra || 0) - Number(a?.id_extra || 0));
  }, [extrasFiltrados, sortBy]);

  const insumoOptions = useMemo(() => {
    const base = Array.isArray(insumos) ? insumos : [];
    return [
      { value: '', label: 'Sin insumo asociado' },
      ...base.map((insumo) => ({
        value: String(insumo.id_insumo),
        label: String(insumo.nombre_insumo || `Insumo #${insumo.id_insumo}`)
      }))
    ];
  }, [insumos]);

  const unidadOptions = useMemo(() => {
    const rows = Array.isArray(insumos) ? insumos : [];
    const map = new Map();
    rows.forEach((item) => {
      const idUnidad = String(item?.id_unidad_medida || '').trim();
      if (!idUnidad) return;
      if (map.has(idUnidad)) return;
      const simbolo = String(item?.unidad_simbolo || '').trim();
      const nombre = String(item?.unidad_nombre || '').trim();
      const label = simbolo && nombre ? `${simbolo} - ${nombre}` : (simbolo || nombre || `Unidad ${idUnidad}`);
      map.set(idUnidad, { value: idUnidad, label });
    });
    return Array.from(map.values());
  }, [insumos]);

  const comboOptions = useMemo(() => {
    const rows = Array.isArray(combos) ? combos : [];
    return rows.map((combo) => {
      const idCombo = Number(combo?.id_combo || 0);
      const nombre = String(combo?.nombre_combo || combo?.descripcion || `Combo #${idCombo}`);
      return {
        value: idCombo,
        label: `#${idCombo} - ${nombre}`,
        nombre
      };
    });
  }, [combos]);

  const selectedComboOptions = useMemo(() => {
    const selected = new Set((Array.isArray(form.combos) ? form.combos : []).map((id) => Number(id)));
    return comboOptions.filter((option) => selected.has(Number(option.value)));
  }, [comboOptions, form.combos]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccess('');
    setDrawerOpen(true);
  };

  const openEdit = async (idExtra) => {
    try {
      setError('');
      setSuccess('');
      const extra = await extrasAdminService.obtenerExtra(idExtra);
      setEditingId(Number(extra?.id_extra || idExtra));
      setForm({
        codigo: String(extra?.codigo || ''),
        nombre: String(extra?.nombre || ''),
        precio_adicional: String(extra?.precio_adicional ?? ''),
        id_insumo: String(extra?.id_insumo ?? ''),
        cant: String(extra?.cant ?? ''),
        id_unidad_medida: String(extra?.id_unidad_medida ?? ''),
        orden: String(extra?.orden ?? '0'),
        estado: Boolean(extra?.estado ?? true),
        recetas: Array.isArray(extra?.recetas) ? extra.recetas.map((id) => Number(id)) : [],
        combos: Array.isArray(extra?.combos) ? extra.combos.map((id) => Number(id)) : []
      });
      setDrawerOpen(true);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el extra.');
    }
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'nombre') next.codigo = buildCode(value);
      if (field === 'id_insumo') {
        const selected = insumos.find((item) => String(item.id_insumo) === String(value));
        next.id_unidad_medida = selected?.id_unidad_medida ? String(selected.id_unidad_medida) : '';
        if (!value) {
          next.cant = '';
          next.id_unidad_medida = '';
        }
      }
      return next;
    });
  };

  const toggleReceta = (idReceta) => {
    setForm((prev) => {
      const id = Number(idReceta);
      const current = new Set(prev.recetas);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, recetas: [...current] };
    });
  };

  const clearRecetas = () => {
    setForm((prev) => ({ ...prev, recetas: [] }));
  };

  const updateCombos = (selectedOptions) => {
    const nextCombos = (Array.isArray(selectedOptions) ? selectedOptions : [])
      .map((option) => Number(option?.value || 0))
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    setForm((prev) => ({ ...prev, combos: [...new Set(nextCombos)] }));
  };

  const validate = () => {
    if (!String(form.nombre || '').trim()) return 'El nombre del extra es obligatorio.';
    if (!String(form.codigo || '').trim()) return 'El codigo del extra es obligatorio.';
    const price = Number(form.precio_adicional);
    if (!Number.isFinite(price) || price < 0) return 'El precio adicional debe ser mayor o igual a 0.';
    const hasInventory = Boolean(form.id_insumo || form.cant || form.id_unidad_medida);
    if (hasInventory && (!form.id_insumo || !form.cant || !form.id_unidad_medida)) {
      return 'Para enlazar inventario indica insumo, cantidad y unidad.';
    }
    if (form.cant && Number(form.cant) <= 0) return 'La cantidad del insumo debe ser mayor a 0.';
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    const payload = {
      codigo: buildCode(form.nombre),
      nombre: form.nombre,
      precio_adicional: Number(form.precio_adicional),
      id_insumo: form.id_insumo || null,
      cant: form.cant || null,
      id_unidad_medida: form.id_unidad_medida || null,
      orden: Number(form.orden || 0),
      estado: Boolean(form.estado),
      recetas: form.recetas,
      combos: form.combos
    };

    try {
      setSaving(true);
      if (editingId) {
        await extrasAdminService.actualizarExtra(editingId, payload);
        setSuccess('Extra actualizado correctamente.');
      } else {
        await extrasAdminService.crearExtra(payload);
        setSuccess('Extra creado correctamente.');
      }
      setDrawerOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await cargarDatos();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el extra.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEstado = async (extra) => {
    const idExtra = Number(extra?.id_extra || 0);
    if (!idExtra) return;
    try {
      setError('');
      setTogglingId(idExtra);
      await extrasAdminService.cambiarEstadoExtra(idExtra, !Boolean(extra.estado));
      setSuccess('Estado del extra actualizado correctamente.');
      await cargarDatos();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado del extra.');
    } finally {
      setTogglingId(null);
      setEstadoConfirm(null);
    }
  };

  const closeEstadoConfirm = () => {
    if (saving) return;
    setEstadoConfirm(null);
  };

  const estadoConfirmActivo = estadoConfirm ? Boolean(estadoConfirm.estado) : false;
  const estadoConfirmNombre = String(estadoConfirm?.nombre || 'Extra seleccionado');

  return (
    <>
      <div className="menu-recetas-admin-page">
        <div className="card shadow-sm mb-3 inv-prod-card menu-recetas-admin">
          <div className="card-header inv-prod-header">
            <div className="inv-prod-title-wrap">
              <div className="inv-prod-title-row">
                <i className="bi bi-plus-square-dotted inv-prod-title-icon" />
                <span className="inv-prod-title">Extras</span>
              </div>
              <div className="inv-prod-subtitle">Opciones adicionales con precio e insumo asociado.</div>
            </div>

            <div className="inv-prod-header-actions inv-ins-header-actions menu-toolbar-actions">
              <label className="inv-ins-search menu-toolbar-search" aria-label="Buscar extras">
                <i className="bi bi-search" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar extra, codigo o insumo..."
                />
              </label>
              <button
                type="button"
                className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
                onClick={() => setFiltersOpen(true)}
                title="Filtros"
                aria-expanded={filtersOpen}
                aria-controls="menu-extras-filtros-drawer"
              >
                <i className="bi bi-funnel" />
                <span>Filtros</span>
              </button>
              <button type="button" className="inv-prod-toolbar-btn" onClick={openCreate} disabled={!canCreateExtra}>
                <i className="bi bi-plus-circle" />
                <span>Nuevo extra</span>
              </button>
              <label className="form-check form-switch mb-0 personas-page__inactive-toggle inv-catpro-inline-toggle">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={Boolean(showInactiveOnly)}
                  onChange={(event) => setShowInactiveOnly(event.target.checked)}
                  aria-label="Ver inactivos"
                />
                <span className="form-check-label">Ver inactivos</span>
              </label>
            </div>
          </div>

          <div className="card-body inv-prod-body">
            {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

            <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
              <span>{extrasVisibles.length} extras</span>
            </div>

            {loading ? (
              <div className="text-center py-4">Cargando extras...</div>
            ) : extrasVisibles.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-plus-square-dotted fs-3 d-block mb-2" />
                {showInactiveOnly ? 'No hay extras inactivos para mostrar.' : 'No hay extras para mostrar.'}
              </div>
            ) : (
              <div className="menu-extras-admin__grid">
                {extrasVisibles.map((extra) => (
                  <article
                    className={`menu-extras-card ${extra.estado ? 'is-active' : 'is-inactive'}`}
                    key={extra.id_extra}
                  >
                    <header className="menu-extras-card__head">
                      <span className={`menu-recetas-admin__estado-badge ${extra.estado ? 'is-active' : 'is-inactive'}`}>
                        {extra.estado ? 'Activo' : 'Inactivo'}
                      </span>
                      <strong>{money(extra.precio_adicional)}</strong>
                    </header>
                    <div className="menu-extras-card__body">
                      <h6>{extra.nombre}</h6>
                      <p>{extra.codigo}</p>
                      <div className="menu-extras-card__meta">
                        <span>Insumo</span>
                        <strong>{extra.nombre_insumo || 'Sin insumo'}</strong>
                      </div>
                      <div className="menu-extras-card__meta">
                        <span>Cantidad</span>
                        <strong>
                          {extra.cant ? `${extra.cant} ${String(extra.unidad_simbolo || extra.unidad_nombre || '').trim()}` : 'No aplica'}
                        </strong>
                      </div>
                      <div className="menu-extras-card__meta">
                        <span>Recetas</span>
                        <strong>{Number(extra.total_recetas || 0)}</strong>
                      </div>
                      <div className="menu-extras-card__meta">
                        <span>Combos</span>
                        <strong>{Number(extra.total_combos || 0)}</strong>
                      </div>
                    </div>
                    <footer className="menu-recetas-card__actions">
                      <button
                        type="button"
                        className="inv-catpro-action edit inv-catpro-action-compact"
                        onClick={() => openEdit(extra.id_extra)}
                        disabled={!canEditExtra}
                      >
                        <i className="bi bi-pencil-square" />
                        <span className="inv-catpro-action-label">Editar</span>
                      </button>
                      <button
                        type="button"
                        className={`inv-catpro-action ${extra.estado ? 'state-off' : 'state-on'} inv-catpro-action-compact menu-recetas-admin__state-action`}
                        onClick={() => setEstadoConfirm(extra)}
                        disabled={!canToggleExtra || togglingId === Number(extra.id_extra)}
                        title={extra.estado ? 'Inactivar' : 'Activar'}
                      >
                        <i className={`bi ${extra.estado ? 'bi-slash-circle' : 'bi-check-circle'}`} />
                        <span className="inv-catpro-action-label">
                          {togglingId === Number(extra.id_extra) ? 'Procesando' : extra.estado ? 'Inactivar' : 'Activar'}
                        </span>
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <MenuFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={() => setFiltersOpen(false)}
        onClear={() => {
          setShowInactiveOnly(false);
          setSortBy('recientes');
          setFiltersOpen(false);
        }}
        title="Filtros de extras"
        drawerId="menu-extras-filtros-drawer"
        chips={[{ icon: 'bi-plus-square-dotted', label: 'Extras' }]}
      >
        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <div className="inv-ins-chip-grid">
            <button
              type="button"
              className={`inv-ins-chip ${!showInactiveOnly ? 'is-active' : ''}`}
              onClick={() => setShowInactiveOnly(false)}
            >
              Activos
            </button>
            <button
              type="button"
              className={`inv-ins-chip ${showInactiveOnly ? 'is-active' : ''}`}
              onClick={() => setShowInactiveOnly(true)}
            >
              Inactivos
            </button>
          </div>
          <div className="inv-ins-help">Filtra por estado del extra.</div>
        </div>

        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="menu_extras_sort">Ordenar por</label>
          <select
            id="menu_extras_sort"
            className="form-select"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="recientes">Mas recientes</option>
            <option value="nombre_asc">Nombre (A-Z)</option>
            <option value="nombre_desc">Nombre (Z-A)</option>
            <option value="precio_asc">Precio (menor a mayor)</option>
            <option value="precio_desc">Precio (mayor a menor)</option>
          </select>
        </div>
      </MenuFiltersDrawer>

      {drawerOpen ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--create show">
          <div className="inv-prod-pmodal__overlay" onClick={closeDrawer} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-extras-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create menu-recetas-admin__form" onSubmit={submit}>
                <div className="inv-prod-pmodal__body">
                  <div className="inv-ins-create-hero is-create">
                    <button type="button" className="inv-prod-drawer-close inv-ins-create-hero__close" onClick={closeDrawer} aria-label="Cerrar">
                      <i className="bi bi-x-lg" />
                    </button>
                    <div className="inv-ins-create-hero__icon">
                      <i className="bi bi-plus-square-dotted" aria-hidden="true" />
                    </div>
                    <div className="inv-ins-create-hero__copy">
                      <div className="inv-ins-create-hero__kicker">{editingId ? 'Edicion Activa' : 'Nuevo Registro'}</div>
                      <div id="menu-extras-modal-title" className="inv-ins-create-hero__title">
                        {editingId ? `Editar extra #${editingId}` : 'Nuevo extra'}
                      </div>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__sections mt-3">
                    <section className="inv-prod-pmodal__section">
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label" htmlFor="extra_nombre">Nombre</label>
              <input
                id="extra_nombre"
                className="form-control"
                value={form.nombre}
                onChange={(event) => updateForm('nombre', event.target.value)}
                placeholder="Ej: Extra queso"
                disabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
                required
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_precio">Precio adicional</label>
              <input
                id="extra_precio"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={form.precio_adicional}
                onChange={(event) => updateForm('precio_adicional', event.target.value)}
                placeholder="Ej: 25.00"
                disabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
                required
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="extra_insumo">Insumo que consume</label>
              <Select
                inputId="extra_insumo"
                classNamePrefix="menu-salsas-receta-select"
                options={insumoOptions}
                value={insumoOptions.find((opt) => String(opt.value) === String(form.id_insumo)) || insumoOptions[0]}
                onChange={(option) => updateForm('id_insumo', String(option?.value || ''))}
                placeholder="Seleccionar insumo..."
                isClearable={false}
                isDisabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
                maxMenuHeight={176}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_cantidad">Cantidad del insumo</label>
              <input
                id="extra_cantidad"
                type="number"
                min="0.0001"
                step="0.0001"
                className="form-control"
                value={form.cant}
                onChange={(event) => updateForm('cant', event.target.value)}
                placeholder="Ej: 0.2500"
                disabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
              />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_unidad">Unidad</label>
              <Select
                inputId="extra_unidad"
                classNamePrefix="menu-salsas-receta-select"
                options={unidadOptions}
                value={unidadOptions.find((opt) => String(opt.value) === String(form.id_unidad_medida)) || null}
                onChange={(option) => updateForm('id_unidad_medida', String(option?.value || ''))}
                placeholder="Seleccionar unidad..."
                isClearable={false}
                isDisabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
                maxMenuHeight={176}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                menuPosition="fixed"
              />
            </div>
          </div>
                    </section>

                    <section className="menu-extras-admin__recipes">
            <div className="menu-extras-admin__section-head">
              <div className="menu-recetas-admin__detalle-title">Recetas donde aparece</div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearRecetas} disabled={saving || form.recetas.length === 0 || (editingId ? !canEditExtra : !canCreateExtra)}>
                Limpiar
              </button>
            </div>
            <div className="menu-extras-admin__recipe-list">
              {recetas.map((receta) => {
                const idReceta = Number(receta.id_receta);
                return (
                  <label className="menu-extras-admin__recipe-option" key={idReceta}>
                    <input
                      type="checkbox"
                      checked={form.recetas.includes(idReceta)}
                      onChange={() => toggleReceta(idReceta)}
                      disabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
                    />
                    <span>{receta.nombre_receta}</span>
                  </label>
                );
              })}
            </div>
                    </section>

                    <section className="menu-extras-admin__recipes">
            <div className="menu-extras-admin__section-head">
              <div className="menu-recetas-admin__detalle-title">Combos donde aparece</div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => updateCombos([])} disabled={saving || selectedComboOptions.length === 0 || (editingId ? !canEditExtra : !canCreateExtra)}>
                Limpiar
              </button>
            </div>
            <Select
              inputId="extra_combos"
              classNamePrefix="menu-salsas-receta-select"
              options={comboOptions}
              value={selectedComboOptions}
              onChange={updateCombos}
              placeholder="Buscar combo..."
              isMulti
              isClearable
              isSearchable
              isDisabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
              closeMenuOnSelect={false}
              maxMenuHeight={220}
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              menuPosition="fixed"
            />
            <div className="menu-extras-admin__selection-count">
              {selectedComboOptions.length} combos seleccionados
            </div>
                    </section>
                  </div>
                </div>

                <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                  <button type="button" className="btn inv-prod-btn-subtle" onClick={closeDrawer} disabled={saving}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn inv-prod-btn-primary"
                    disabled={saving || (editingId ? !canEditExtra : !canCreateExtra)}
                  >
                    {saving ? 'Guardando...' : 'Guardar extra'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}

      <MenuActionToast title="Extras" message={toastMessage} onClose={() => setToastMessage('')} />
      <MenuConfirmDialog
        open={Boolean(estadoConfirm)}
        title={estadoConfirmActivo ? 'Confirmar inactivacion' : 'Confirmar activacion'}
        subtitle={estadoConfirmActivo ? 'El extra dejara de estar disponible' : 'El extra volvera a estar disponible'}
        question={estadoConfirmActivo ? 'Deseas inactivar este extra?' : 'Deseas activar este extra?'}
        itemLabel={estadoConfirmNombre}
        itemIcon={estadoConfirmActivo ? 'bi-slash-circle' : 'bi-check-circle'}
        confirmLabel={estadoConfirmActivo ? 'Inactivar' : 'Activar'}
        confirmingLabel="Procesando..."
        loading={Boolean(togglingId)}
        onClose={closeEstadoConfirm}
        onConfirm={() => toggleEstado(estadoConfirm)}
      />
    </>
  );
};

export default ExtrasAdmin;
