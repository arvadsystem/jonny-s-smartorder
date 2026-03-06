import { useEffect, useMemo, useState } from 'react';
import recetasAdminService from '../../../services/recetasAdminService';

const emptyForm = {
  nombre_receta: '',
  descripcion: '',
  precio: '',
  id_menu: '',
  id_nivel_picante: '',
  id_usuario: '',
  estado: 'true',
  id_tipo_departamento: '',
  url_imagen_publica: '',
  url_imagen_original: '',
  id_archivo: ''
};

const defaultFilters = {
  estado: 'todos',
  sortBy: 'recientes'
};

const parseBoolean = (value) => {
  if (value === true || value === false) return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return false;
};

const toNumberOrNull = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

const resolveRecetaActiva = (receta) => parseBoolean(receta?.estado);

// Convierte enlaces compartidos de Drive a URL de visualizacion directa para preview y cards.
const toDrivePreviewUrl = (rawUrl) => {
  const safeUrl = String(rawUrl || '').trim();
  if (!safeUrl) return '';

  try {
    const parsed = new URL(safeUrl);
    const host = String(parsed.hostname || '').toLowerCase();
    if (!host.includes('drive.google.com')) return safeUrl;

    const path = String(parsed.pathname || '');
    const fileByPath = path.match(/\/file\/d\/([^/]+)\//i)?.[1];
    const fileByQuery = parsed.searchParams.get('id');
    const fileId = fileByPath || fileByQuery;
    if (!fileId) return safeUrl;

    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  } catch {
    return safeUrl;
  }
};

const resolveRecetaImageUrl = (receta) => {
  const rawUrl = String(
    receta?.url_imagen_publica || receta?.imagen_principal_url || receta?.url_imagen || ''
  ).trim();
  return toDrivePreviewUrl(rawUrl);
};

const isPublicHttpUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeRecetaForForm = (receta) => {
  const imageUrl = resolveRecetaImageUrl(receta);
  return {
    nombre_receta: String(receta?.nombre_receta || ''),
    descripcion: String(receta?.descripcion || ''),
    precio: String(receta?.precio ?? ''),
    id_menu: String(receta?.id_menu ?? ''),
    id_nivel_picante:
      receta?.id_nivel_picante === null || receta?.id_nivel_picante === undefined
        ? ''
        : String(receta.id_nivel_picante),
    id_usuario: String(receta?.id_usuario ?? ''),
    estado: parseBoolean(receta?.estado) ? 'true' : 'false',
    id_tipo_departamento: String(receta?.id_tipo_departamento ?? ''),
    url_imagen_publica: imageUrl,
    url_imagen_original: imageUrl,
    id_archivo:
      receta?.id_archivo === null || receta?.id_archivo === undefined
        ? ''
        : String(receta.id_archivo)
  };
};

const sortRecetas = (rows, sortBy) => {
  const list = [...rows];
  if (sortBy === 'nombre_asc') {
    return list.sort((a, b) => String(a?.nombre_receta || '').localeCompare(String(b?.nombre_receta || ''), 'es'));
  }
  if (sortBy === 'nombre_desc') {
    return list.sort((a, b) => String(b?.nombre_receta || '').localeCompare(String(a?.nombre_receta || ''), 'es'));
  }
  if (sortBy === 'precio_asc') {
    return list.sort((a, b) => Number(a?.precio || 0) - Number(b?.precio || 0));
  }
  if (sortBy === 'precio_desc') {
    return list.sort((a, b) => Number(b?.precio || 0) - Number(a?.precio || 0));
  }
  return list.sort((a, b) => Number(b?.id_receta || 0) - Number(a?.id_receta || 0));
};

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'L. 0.00';
  return `L. ${n.toFixed(2)}`;
};

const truncateText = (value, maxLength = 100) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const RecetasAdmin = () => {
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estado de UI alineado al patron de modulos.
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ ...defaultFilters });
  const [filtersDraft, setFiltersDraft] = useState({ ...defaultFilters });
  const [viewMode, setViewMode] = useState('cards');
  const [cardImageErrors, setCardImageErrors] = useState({});
  const [formPreviewError, setFormPreviewError] = useState(false);

  const isAnyDrawerOpen = drawerOpen || filtersOpen;

  // Carga principal del listado.
  const cargarRecetas = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await recetasAdminService.listarRecetasAdmin();
      setRecetas(normalizeRows(response));
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el listado de recetas.');
      setRecetas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarRecetas();
  }, []);

  useEffect(() => {
    setCardImageErrors({});
  }, [recetas]);

  useEffect(() => {
    setFormPreviewError(false);
  }, [form.url_imagen_publica]);

  const recetasFiltradas = useMemo(() => {
    const searchTerm = String(search || '').trim().toLowerCase();

    const filtered = (Array.isArray(recetas) ? recetas : []).filter((receta) => {
      const nombre = String(receta?.nombre_receta || '').toLowerCase();
      const descripcion = String(receta?.descripcion || '').toLowerCase();
      const idText = String(receta?.id_receta || '');

      if (filters.estado === 'activos' && !resolveRecetaActiva(receta)) return false;
      if (filters.estado === 'inactivos' && resolveRecetaActiva(receta)) return false;

      if (!searchTerm) return true;
      return nombre.includes(searchTerm) || descripcion.includes(searchTerm) || idText.includes(searchTerm);
    });

    return sortRecetas(filtered, filters.sortBy);
  }, [filters.estado, filters.sortBy, recetas, search]);

  const hasActiveFilters = filters.estado !== defaultFilters.estado || filters.sortBy !== defaultFilters.sortBy;

  const onChangeField = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateDrawer = () => {
    setFiltersOpen(false);
    setDrawerMode('create');
    setEditingId(null);
    setForm({ ...emptyForm });
    setDrawerOpen(true);
    setError('');
    setSuccess('');
    setFormPreviewError(false);
  };

  const closeCreateDrawer = () => {
    setDrawerOpen(false);
  };

  const openFiltersDrawer = () => {
    setDrawerOpen(false);
    setFiltersDraft({ ...filters });
    setFiltersOpen(true);
  };

  const closeFiltersDrawer = () => {
    setFiltersOpen(false);
  };

  const closeAnyDrawer = () => {
    setDrawerOpen(false);
    setFiltersOpen(false);
  };

  // Valida campos basicos del formulario antes de enviar.
  const validarFormulario = () => {
    if (!String(form.nombre_receta || '').trim()) {
      return 'nombre_receta es obligatorio.';
    }
    if (toNumberOrNull(form.id_menu) === null) {
      return 'id_menu es obligatorio.';
    }
    if (toNumberOrNull(form.id_tipo_departamento) === null) {
      return 'id_tipo_departamento es obligatorio.';
    }
    if (toNumberOrNull(form.id_usuario) === null) {
      return 'id_usuario es obligatorio.';
    }
    const precio = toNumberOrNull(form.precio);
    if (precio === null || precio < 0) {
      return 'precio debe ser mayor o igual a 0.';
    }
    if (!isPublicHttpUrl(form.url_imagen_publica)) {
      return 'url_imagen_publica debe iniciar con http:// o https://.';
    }
    return '';
  };

  // Construye payload compatible con backend.
  const buildPayload = () => {
    const imageUrl = String(form.url_imagen_publica || '').trim();
    const originalImageUrl = String(form.url_imagen_original || '').trim();
    const currentArchivoId = toNumberOrNull(form.id_archivo);

    const payload = {
      nombre_receta: String(form.nombre_receta || '').trim(),
      descripcion: String(form.descripcion || '').trim(),
      precio: Number(form.precio),
      id_menu: Number(form.id_menu),
      id_nivel_picante:
        String(form.id_nivel_picante || '').trim() === '' ? null : Number(form.id_nivel_picante),
      id_usuario: Number(form.id_usuario),
      estado: parseBoolean(form.estado),
      id_tipo_departamento: Number(form.id_tipo_departamento)
    };

    // Regla: si la URL no cambia y ya hay archivo asociado, se conserva id_archivo.
    if (imageUrl) {
      if (currentArchivoId !== null && imageUrl === originalImageUrl) {
        payload.id_archivo = currentArchivoId;
      } else {
        payload.url_imagen_publica = imageUrl;
      }
    } else if (editingId && currentArchivoId !== null && originalImageUrl) {
      // Si en edición se borra la URL, se limpia la referencia.
      payload.id_archivo = null;
    }

    return payload;
  };

  // Guarda receta en create/update usando el mismo drawer.
  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationMessage = validarFormulario();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const payload = buildPayload();

    try {
      setSaving(true);

      if (editingId) {
        await recetasAdminService.actualizarRecetaAdmin(editingId, payload);
        setSuccess('Receta actualizada correctamente.');
      } else {
        await recetasAdminService.crearRecetaAdmin(payload);
        setSuccess('Receta creada correctamente.');
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      setDrawerMode('create');
      setDrawerOpen(false);
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la receta.');
    } finally {
      setSaving(false);
    }
  };

  // Carga receta puntual para abrir drawer en modo edicion.
  const onEditar = async (idReceta) => {
    try {
      setError('');
      setSuccess('');
      const receta = await recetasAdminService.obtenerRecetaAdmin(idReceta);

      setEditingId(Number(receta?.id_receta || idReceta));
      setForm(normalizeRecetaForForm(receta));
      setDrawerMode('edit');
      setFiltersOpen(false);
      setDrawerOpen(true);
      setFormPreviewError(false);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la receta para edicion.');
    }
  };

  // Cambia estado activo/inactivo usando el endpoint PATCH del backend.
  const onCambiarEstado = async (receta) => {
    const recetaId = Number(receta?.id_receta || 0);
    if (!recetaId) return;

    try {
      setTogglingId(recetaId);
      setError('');
      setSuccess('');

      const idUsuarioForm = toNumberOrNull(form.id_usuario);
      const idUsuarioRow = toNumberOrNull(receta?.id_usuario);
      const idUsuario = idUsuarioForm ?? idUsuarioRow;

      if (idUsuario === null) {
        setError('Para cambiar estado debes indicar id_usuario en formulario o tenerlo en la fila.');
        return;
      }

      await recetasAdminService.cambiarEstadoRecetaAdmin(recetaId, {
        estado: !resolveRecetaActiva(receta),
        id_usuario: idUsuario
      });

      setSuccess('Estado de receta actualizado correctamente.');
      await cargarRecetas();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado de la receta.');
    } finally {
      setTogglingId(null);
    }
  };

  const applyFilters = () => {
    setFilters({ ...filtersDraft });
    setFiltersOpen(false);
  };

  const clearFilters = () => {
    setFilters({ ...defaultFilters });
    setFiltersDraft({ ...defaultFilters });
    setFiltersOpen(false);
  };

  const clearFormImage = () => {
    setForm((prev) => ({ ...prev, url_imagen_publica: '' }));
    setFormPreviewError(false);
  };

  const formPreviewUrl = toDrivePreviewUrl(form.url_imagen_publica);

  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card menu-recetas-admin">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-journal-richtext inv-prod-title-icon" />
              <span className="inv-prod-title">Recetas</span>
            </div>
            <div className="inv-prod-subtitle">Administracion del catalogo de recetas del menu</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions menu-recetas-admin__header-actions">
            <label className="inv-ins-search inv-prod-header-search" aria-label="Buscar recetas">
              <i className="bi bi-search" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar receta..."
              />
            </label>

            <button
              type="button"
              className={`inv-prod-toolbar-btn ${filtersOpen ? 'is-on' : ''}`}
              onClick={openFiltersDrawer}
              title="Filtros"
              aria-expanded={filtersOpen}
              aria-controls="menu-recetas-filtros-drawer"
            >
              <i className="bi bi-funnel" />
              <span>Filtros</span>
            </button>

            <button
              type="button"
              className={`inv-prod-toolbar-btn ${drawerOpen ? 'is-on' : ''}`}
              onClick={openCreateDrawer}
              title="Nuevo"
              aria-expanded={drawerOpen}
              aria-controls="menu-recetas-form-drawer"
            >
              <i className="bi bi-plus-circle" />
              <span>Nuevo</span>
            </button>

            <div className="personas-page__view-toggle menu-recetas-admin__view-toggle" role="tablist" aria-label="Cambiar vista recetas">
              <button
                type="button"
                className={`personas-page__view-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
                title="Vista tarjetas"
              >
                <i className="bi bi-grid-3x3-gap-fill" />
              </button>
              <button
                type="button"
                className={`personas-page__view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                title="Vista tabla"
              >
                <i className="bi bi-list-ul" />
              </button>
            </div>
          </div>
        </div>

        <div className="card-body inv-prod-body">
          {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
          {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

          <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
            <span>{recetasFiltradas.length} recetas</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          {loading ? (
            <div className="text-center py-4">Cargando recetas...</div>
          ) : recetasFiltradas.length === 0 ? (
            <div className="text-center py-4">No hay recetas para mostrar.</div>
          ) : viewMode === 'table' ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle menu-recetas-admin__table mb-0">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th className="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {recetasFiltradas.map((receta) => {
                    const id = Number(receta?.id_receta || 0);
                    const estadoActivo = resolveRecetaActiva(receta);
                    return (
                      <tr key={id}>
                        <td>#{id}</td>
                        <td>{String(receta?.nombre_receta || '')}</td>
                        <td>{formatMoney(receta?.precio)}</td>
                        <td>
                          <span className={`menu-recetas-admin__estado-badge ${estadoActivo ? 'is-active' : 'is-inactive'}`}>
                            {estadoActivo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div className="menu-recetas-admin__row-actions">
                            <button
                              type="button"
                              className="btn inv-prod-btn-subtle btn-sm"
                              onClick={() => onEditar(id)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${estadoActivo ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'}`}
                              onClick={() => onCambiarEstado(receta)}
                              disabled={togglingId === id}
                            >
                              {togglingId === id ? 'Procesando...' : estadoActivo ? 'Inactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="menu-recetas-admin__cards">
              {recetasFiltradas.map((receta) => {
                const id = Number(receta?.id_receta || 0);
                const estadoActivo = resolveRecetaActiva(receta);
                const imageUrl = resolveRecetaImageUrl(receta);
                const imageBroken = Boolean(cardImageErrors[id]);
                const descripcion = truncateText(
                  String(receta?.descripcion || '').trim() || 'Sin descripcion registrada.',
                  104
                );
                const menuId = String(receta?.id_menu ?? '-');
                const departamentoId = String(receta?.id_tipo_departamento ?? '-');

                return (
                  <article
                    key={id}
                    className={`menu-recetas-card ${estadoActivo ? 'is-active' : 'is-inactive'}`}
                  >
                    <header className="menu-recetas-card__media">
                      {imageUrl && !imageBroken ? (
                        <img
                          src={imageUrl}
                          alt={`Imagen de ${String(receta?.nombre_receta || 'receta')}`}
                          onError={() => setCardImageErrors((prev) => ({ ...prev, [id]: true }))}
                        />
                      ) : (
                        <div className="menu-recetas-card__placeholder">
                          <i className="bi bi-image" />
                          <span>Sin imagen</span>
                        </div>
                      )}
                      <div className="menu-recetas-card__media-top">
                        <span className={`menu-recetas-admin__estado-badge ${estadoActivo ? 'is-active' : 'is-inactive'}`}>
                          {estadoActivo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="menu-recetas-card__price-pill">{formatMoney(receta?.precio)}</span>
                      </div>
                    </header>

                    <div className="menu-recetas-card__body">
                      <div className="menu-recetas-card__title-row">
                        <h6>{String(receta?.nombre_receta || 'Receta sin nombre')}</h6>
                        <span className="menu-recetas-card__id">#{id}</span>
                      </div>

                      <p className="menu-recetas-card__description">{descripcion}</p>

                      <div className="menu-recetas-card__meta">
                        <div>
                          <small>Menu</small>
                          <strong>{menuId}</strong>
                        </div>
                        <div>
                          <small>Departamento</small>
                          <strong>{departamentoId}</strong>
                        </div>
                        <div>
                          <small>Imagen</small>
                          <strong>{imageUrl ? 'Con URL' : 'Sin URL'}</strong>
                        </div>
                      </div>
                    </div>

                    <footer className="menu-recetas-card__actions">
                      <button
                        type="button"
                        className="btn inv-prod-btn-subtle btn-sm"
                        onClick={() => onEditar(id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${estadoActivo ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'}`}
                        onClick={() => onCambiarEstado(receta)}
                        disabled={togglingId === id}
                      >
                        {togglingId === id ? 'Procesando...' : estadoActivo ? 'Inactivar' : 'Activar'}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`}
        onClick={closeAnyDrawer}
        aria-hidden={!isAnyDrawerOpen}
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer ${filtersOpen ? 'show' : ''}`}
        id="menu-recetas-filtros-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!filtersOpen}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-funnel inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Filtros de recetas</div>
            <div className="inv-prod-drawer-sub">Estado y orden visual del listado</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close"
            onClick={closeFiltersDrawer}
            title="Cerrar"
            aria-label="Cerrar filtros"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-prod-drawer-body inv-cat-v2__drawer-body">
          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Estado</div>
            <div className="inv-ins-chip-grid">
              <button
                type="button"
                className={`inv-ins-chip ${filtersDraft.estado === 'todos' ? 'is-active' : ''}`}
                onClick={() => setFiltersDraft((state) => ({ ...state, estado: 'todos' }))}
              >
                Todos
              </button>
              <button
                type="button"
                className={`inv-ins-chip ${filtersDraft.estado === 'activos' ? 'is-active' : ''}`}
                onClick={() => setFiltersDraft((state) => ({ ...state, estado: 'activos' }))}
              >
                Activos
              </button>
              <button
                type="button"
                className={`inv-ins-chip ${filtersDraft.estado === 'inactivos' ? 'is-active' : ''}`}
                onClick={() => setFiltersDraft((state) => ({ ...state, estado: 'inactivos' }))}
              >
                Inactivos
              </button>
            </div>
            <div className="inv-ins-help">Filtra por estado de receta.</div>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Orden</div>
            <label className="form-label" htmlFor="menu_recetas_sort">Ordenar por</label>
            <select
              id="menu_recetas_sort"
              className="form-select"
              value={filtersDraft.sortBy}
              onChange={(event) => setFiltersDraft((state) => ({ ...state, sortBy: event.target.value }))}
            >
              <option value="recientes">Mas recientes</option>
              <option value="nombre_asc">Nombre (A-Z)</option>
              <option value="nombre_desc">Nombre (Z-A)</option>
              <option value="precio_asc">Precio (menor a mayor)</option>
              <option value="precio_desc">Precio (mayor a menor)</option>
            </select>
          </div>

          <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={clearFilters}>
              Limpiar
            </button>
            <button type="button" className="btn inv-prod-btn-primary" onClick={applyFilters}>
              Aplicar
            </button>
          </div>
        </div>
      </aside>

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer ${drawerOpen ? 'show' : ''}`}
        id="menu-recetas-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!drawerOpen}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-journal-plus inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">
              {drawerMode === 'create' ? 'Nueva receta' : `Editar receta #${editingId}`}
            </div>
            <div className="inv-prod-drawer-sub">Completa la informacion y guarda cambios.</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close"
            onClick={closeCreateDrawer}
            title="Cerrar"
            aria-label="Cerrar formulario"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite menu-recetas-admin__form" onSubmit={onSubmit}>
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label" htmlFor="receta_nombre">Nombre receta</label>
              <input
                id="receta_nombre"
                className="form-control"
                name="nombre_receta"
                value={form.nombre_receta}
                onChange={onChangeField}
                required
              />
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="receta_descripcion">Descripcion</label>
              <input
                id="receta_descripcion"
                className="form-control"
                name="descripcion"
                value={form.descripcion}
                onChange={onChangeField}
              />
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="receta_url_imagen">URL imagen publica (Drive)</label>
              <input
                id="receta_url_imagen"
                className="form-control"
                name="url_imagen_publica"
                value={form.url_imagen_publica}
                onChange={onChangeField}
                placeholder="https://..."
              />
              <div className="form-text">
                Pega una URL publica (Drive o web). El backend solo guarda la URL en `archivos`.
              </div>

              <div className="menu-recetas-admin__form-image-preview">
                {formPreviewUrl && !formPreviewError ? (
                  <img
                    src={formPreviewUrl}
                    alt="Preview de receta"
                    onError={() => setFormPreviewError(true)}
                  />
                ) : (
                  <div className="menu-recetas-admin__form-image-placeholder">
                    <i className="bi bi-image" />
                    <span>{formPreviewUrl ? 'No se pudo cargar la URL' : 'Sin imagen seleccionada'}</span>
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-end mt-2">
                <button type="button" className="btn inv-prod-btn-subtle btn-sm" onClick={clearFormImage}>
                  Quitar URL
                </button>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="receta_precio">Precio</label>
              <input
                id="receta_precio"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                name="precio"
                value={form.precio}
                onChange={onChangeField}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="receta_id_menu">ID menu</label>
              <input
                id="receta_id_menu"
                type="number"
                min="1"
                className="form-control"
                name="id_menu"
                value={form.id_menu}
                onChange={onChangeField}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="receta_id_nivel_picante">ID nivel picante</label>
              <input
                id="receta_id_nivel_picante"
                type="number"
                min="1"
                className="form-control"
                name="id_nivel_picante"
                value={form.id_nivel_picante}
                onChange={onChangeField}
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="receta_id_usuario">ID usuario</label>
              <input
                id="receta_id_usuario"
                type="number"
                min="1"
                className="form-control"
                name="id_usuario"
                value={form.id_usuario}
                onChange={onChangeField}
                required
              />
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="receta_estado">Estado</label>
              <select
                id="receta_estado"
                className="form-select"
                name="estado"
                value={form.estado}
                onChange={onChangeField}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="receta_id_departamento">ID tipo departamento</label>
              <input
                id="receta_id_departamento"
                type="number"
                min="1"
                className="form-control"
                name="id_tipo_departamento"
                value={form.id_tipo_departamento}
                onChange={onChangeField}
                required
              />
            </div>
          </div>

          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={closeCreateDrawer} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving}>
              {saving ? 'Guardando...' : drawerMode === 'create' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
};

export default RecetasAdmin;
