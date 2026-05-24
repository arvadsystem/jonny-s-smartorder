import { useEffect, useState } from 'react';
import RecetasFormDrawer from './components/RecetasFormDrawer';
import RecetasTable from './components/RecetasTable';
import RecetasToolbar from './components/RecetasToolbar';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';
import useRecetasAdmin from './hooks/useRecetasAdmin';
import { resolveRecetaActiva } from './utils/recetasAdminUtils';

const RecetasAdmin = () => {
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
      loadingDetalleCatalog,
      filtersOpen,
      filtersDraft,
      viewMode,
      cardImageErrors,
      formPreviewError,
      selectedImageFileName
    },
    derived: {
      recetasFiltradas,
      hasActiveFilters,
      formPreviewUrl
    },
    actions: {
      setSearch,
      setViewMode,
      setFiltersDraft,
      setFormPreviewError,
      onChangeField,
      addDetalleRow,
      removeDetalleRow,
      updateDetalleRow,
      openCreateDrawer,
      closeCreateDrawer,
      openFiltersDrawer,
      closeFiltersDrawer,
      closeAnyDrawer,
      onSubmit,
      onEditar,
      onCambiarEstado,
      applyFilters,
      clearFilters,
      clearFormImage,
      onPickImageFile,
      setCardImageError
    }
  } = useRecetasAdmin();

  const [toastMessage, setToastMessage] = useState('');
  const [estadoConfirm, setEstadoConfirm] = useState(null);

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
            />
          </div>

          <div className="card-body inv-prod-body">
            {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
            {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

            <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
              <span>{recetasFiltradas.length} recetas</span>
              {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
            </div>

            <RecetasTable
              loading={loading}
              recetas={recetasFiltradas}
              viewMode={viewMode}
              togglingId={togglingId}
              cardImageErrors={cardImageErrors}
              onCardImageError={setCardImageError}
              onEditar={onEditar}
              onCambiarEstado={setEstadoConfirm}
            />
          </div>
        </div>
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${filtersOpen ? 'show' : ''}`}
        onClick={closeFiltersDrawer}
        aria-hidden={!filtersOpen}
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

      <RecetasFormDrawer
        drawerOpen={drawerOpen}
        drawerMode={drawerMode}
        editingId={editingId}
        form={form}
        detalleReceta={detalleReceta}
        insumosDetalleCatalog={insumosDetalleCatalog}
        loadingDetalleCatalog={loadingDetalleCatalog}
        saving={saving}
        onChangeField={onChangeField}
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
