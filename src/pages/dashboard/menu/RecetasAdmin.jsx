import { useEffect, useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import RecetasFormDrawer from './components/RecetasFormDrawer';
import RecetasTable from './components/RecetasTable';
import RecetasToolbar from './components/RecetasToolbar';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';
import MenuFiltersDrawer from './components/MenuFiltersDrawer';
import useRecetasAdmin from './hooks/useRecetasAdmin';
import { resolveRecetaActiva } from './utils/recetasAdminUtils';

const RecetasAdmin = () => {
  const { canAny } = usePermisos();
  const {
    state: {
      loading,
      saving,
      togglingId,
      error,
      success,
      search,
      drawerOpen,
      drawerMode,
      editingId,
      form,
      detalleReceta,
      insumosDetalleCatalog,
      unidadesMedidaCatalog,
      loadingDetalleCatalog,
      menusCatalog,
      departamentosCatalog,
      filtersOpen,
      filters,
      filtersDraft,
      viewMode,
      cardImageErrors,
      formPreviewError,
      selectedImageFileName
    },
    derived: {
      recetasFiltradas,
      activeFiltersCount,
      hasActiveFilters,
      formPreviewUrl,
      insumoCategoriasOptions,
      menuLabelsById,
      departamentoLabelsById
    },
    actions: {
      setSearch,
      setViewMode,
      setFiltersDraft,
      setFormPreviewError,
      onChangeField,
      onChangeSelectField,
      addDetalleRow,
      removeDetalleRow,
      updateDetalleRow,
      openCreateDrawer,
      closeCreateDrawer,
      openFiltersDrawer,
      closeFiltersDrawer,
      onSubmit,
      onEditar,
      onCambiarEstado,
      applyFilters,
      clearFilters,
      setShowInactiveOnly,
      clearFormImage,
      onPickImageFile,
      setCardImageError
    }
  } = useRecetasAdmin();

  const [toastMessage, setToastMessage] = useState('');
  const [estadoConfirm, setEstadoConfirm] = useState(null);
  const canCreateReceta = canAny([PERMISSIONS.MENU_RECETAS_CREAR, PERMISSIONS.MENU_VER]);
  const canEditReceta = canAny([PERMISSIONS.MENU_RECETAS_EDITAR, PERMISSIONS.MENU_VER]);
  const canToggleReceta = canAny([PERMISSIONS.MENU_RECETAS_ESTADO_CAMBIAR, PERMISSIONS.MENU_VER]);

  // Muestra confirmacion visible despues de crear/editar/cambiar estado de recetas.
  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  const closeEstadoConfirm = () => {
    if (togglingId) return;
    setEstadoConfirm(null);
  };

  const confirmCambiarEstado = async () => {
    if (!estadoConfirm) return;
    await onCambiarEstado(estadoConfirm);
    setEstadoConfirm(null);
  };

  const estadoConfirmActivo = estadoConfirm ? resolveRecetaActiva(estadoConfirm) : false;
  const estadoConfirmNombre = String(estadoConfirm?.nombre_receta || 'Receta seleccionada');

  return (
    <>
      <div className="menu-recetas-admin-page">
        <div className="menu-recetas-admin__top-controls">
          {/* Selector de vista estilo Ventas, colocado arriba de las acciones del toolbar. */}
          <div className="menu-recetas-admin__view-toggle" role="tablist" aria-label="Cambiar vista recetas">
            <button
              type="button"
              className={`menu-recetas-admin__view-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
              onClick={() => setViewMode('cards')}
              aria-pressed={viewMode === 'cards'}
              title="Vista en tarjetas"
            >
              <i className="bi bi-grid-3x3-gap-fill" />
            </button>
            <button
              type="button"
              className={`menu-recetas-admin__view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              title="Vista en lista"
            >
              <i className="bi bi-list-ul" />
            </button>
          </div>
        </div>

        <div className="card shadow-sm mb-3 inv-prod-card menu-recetas-admin">
          <div className="card-header inv-prod-header">
            <div className="inv-prod-title-wrap">
              <div className="inv-prod-title-row">
                <i className="bi bi-journal-richtext inv-prod-title-icon" />
                <span className="inv-prod-title">Recetas</span>
              </div>
              <div className="inv-prod-subtitle">Administracion del catalogo de recetas del menu</div>
            </div>

            <RecetasToolbar
              search={search}
              onSearchChange={setSearch}
              filtersOpen={filtersOpen}
              onOpenFilters={openFiltersDrawer}
              drawerOpen={drawerOpen}
              onOpenCreate={openCreateDrawer}
              canCreate={canCreateReceta}
              showInactiveOnly={filters.estado === 'inactivos'}
              onToggleInactiveOnly={setShowInactiveOnly}
            />
          </div>

          <div className="card-body inv-prod-body">
            {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

            <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
              <span>{recetasFiltradas.length} recetas</span>
              {hasActiveFilters ? <span className="inv-prod-active-filter-pill">{`Filtros activos: ${activeFiltersCount}`}</span> : null}
            </div>

            <RecetasTable
              loading={loading}
              recetas={recetasFiltradas}
              showInactiveOnly={filters.estado === 'inactivos'}
              viewMode={viewMode}
              menuLabelsById={menuLabelsById}
              departamentoLabelsById={departamentoLabelsById}
              togglingId={togglingId}
              canEdit={canEditReceta}
              canToggleState={canToggleReceta}
              cardImageErrors={cardImageErrors}
              onCardImageError={setCardImageError}
              onEditar={onEditar}
              onCambiarEstado={setEstadoConfirm}
            />
          </div>
        </div>
      </div>

      <MenuFiltersDrawer
        open={filtersOpen}
        onClose={closeFiltersDrawer}
        onApply={applyFilters}
        onClear={clearFilters}
        title="Filtros de recetas"
        drawerId="menu-recetas-filtros-drawer"
        chips={[{ icon: 'bi-journal-richtext', label: 'Recetas' }]}
      >
        <div className="menu-recetas-filters__grid">
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
            <div className="inv-prod-drawer-section-title">Menu</div>
            <label className="form-label" htmlFor="menu_recetas_filter_menu">Menu</label>
            <select
              id="menu_recetas_filter_menu"
              className="form-select"
              value={filtersDraft.id_menu}
              onChange={(event) => setFiltersDraft((state) => ({ ...state, id_menu: event.target.value }))}
            >
              <option value="">Todos los menus</option>
              {menusCatalog.map((option) => (
                <option key={`filter-menu-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Departamento</div>
            <label className="form-label" htmlFor="menu_recetas_filter_departamento">Departamento</label>
            <select
              id="menu_recetas_filter_departamento"
              className="form-select"
              value={filtersDraft.id_tipo_departamento}
              onChange={(event) => setFiltersDraft((state) => ({ ...state, id_tipo_departamento: event.target.value }))}
            >
              <option value="">Todos los departamentos</option>
              {departamentosCatalog.map((option) => (
                <option key={`filter-departamento-${option.value}`} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Precio</div>
            <div className="menu-recetas-filters__range">
              <div>
                <label className="form-label" htmlFor="menu_recetas_filter_precio_min">Minimo</label>
                <input
                  id="menu_recetas_filter_precio_min"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={filtersDraft.precio_min}
                  onChange={(event) => setFiltersDraft((state) => ({ ...state, precio_min: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="form-label" htmlFor="menu_recetas_filter_precio_max">Maximo</label>
                <input
                  id="menu_recetas_filter_precio_max"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={filtersDraft.precio_max}
                  onChange={(event) => setFiltersDraft((state) => ({ ...state, precio_max: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Imagen</div>
            <label className="form-label" htmlFor="menu_recetas_filter_imagen">Disponibilidad de imagen</label>
            <select
              id="menu_recetas_filter_imagen"
              className="form-select"
              value={filtersDraft.imagen}
              onChange={(event) => setFiltersDraft((state) => ({ ...state, imagen: event.target.value }))}
            >
              <option value="todas">Todas</option>
              <option value="con_imagen">Con imagen</option>
              <option value="sin_imagen">Sin imagen</option>
            </select>
          </div>

          <div className="inv-prod-drawer-section">
            <div className="inv-prod-drawer-section-title">Detalle</div>
            <label className="form-label" htmlFor="menu_recetas_filter_detalle">Completitud del detalle</label>
            <select
              id="menu_recetas_filter_detalle"
              className="form-select"
              value={filtersDraft.detalle}
              onChange={(event) => setFiltersDraft((state) => ({ ...state, detalle: event.target.value }))}
            >
              <option value="todas">Todas</option>
              <option value="con_detalle">Con detalle</option>
              <option value="sin_detalle">Sin detalle</option>
            </select>
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
        </div>
      </MenuFiltersDrawer>

      <RecetasFormDrawer
        drawerOpen={drawerOpen}
        drawerMode={drawerMode}
        editingId={editingId}
        form={form}
        detalleReceta={detalleReceta}
        insumosDetalleCatalog={insumosDetalleCatalog}
        unidadesMedidaCatalog={unidadesMedidaCatalog}
        insumoCategoriasOptions={insumoCategoriasOptions}
        loadingDetalleCatalog={loadingDetalleCatalog}
        saving={saving}
        onChangeField={onChangeField}
        onChangeSelectField={onChangeSelectField}
        onAddDetalleRow={addDetalleRow}
        onRemoveDetalleRow={removeDetalleRow}
        onUpdateDetalleRow={updateDetalleRow}
        onSubmit={onSubmit}
        onClose={closeCreateDrawer}
        onClearImage={clearFormImage}
        onPickImageFile={onPickImageFile}
        selectedImageFileName={selectedImageFileName}
        formPreviewUrl={formPreviewUrl}
        formPreviewError={formPreviewError}
        menusCatalog={menusCatalog}
        departamentosCatalog={departamentosCatalog}
        onPreviewError={() => setFormPreviewError(true)}
      />

      <MenuActionToast
        title="Recetas"
        message={toastMessage}
        onClose={() => setToastMessage('')}
      />

      <MenuConfirmDialog
        open={Boolean(estadoConfirm)}
        title={estadoConfirmActivo ? 'Confirmar inactivacion' : 'Confirmar activacion'}
        subtitle={estadoConfirmActivo ? 'La receta dejara de estar disponible' : 'La receta volvera a estar disponible'}
        question={estadoConfirmActivo ? 'Deseas inactivar esta receta?' : 'Deseas activar esta receta?'}
        description="El cambio afecta la disponibilidad de este item en el menu."
        itemLabel={estadoConfirmNombre}
        itemIcon={estadoConfirmActivo ? 'bi-slash-circle' : 'bi-check-circle'}
        confirmLabel={estadoConfirmActivo ? 'Inactivar' : 'Activar'}
        confirmingLabel="Procesando..."
        loading={Boolean(togglingId)}
        onClose={closeEstadoConfirm}
        onConfirm={confirmCambiarEstado}
      />
    </>
  );
};

export default RecetasAdmin;
