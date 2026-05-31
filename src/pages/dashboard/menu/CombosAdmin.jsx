import { useEffect, useState } from 'react';
import CombosFormDrawer from './components/CombosFormDrawer';
import CombosTable from './components/CombosTable';
import CombosToolbar from './components/CombosToolbar';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';
import MenuFiltersDrawer from './components/MenuFiltersDrawer';
import useCombosAdmin from './hooks/useCombosAdmin';
import { resolveComboActivo, resolveComboNombre } from './utils/combosAdminUtils';

const CombosAdmin = () => {
  const {
    state: {
      loading,
      saving,
      togglingId,
      error,
      success,
      search,
      showInactiveOnly,
      drawerOpen,
      drawerMode,
      editingId,
      form,
      menusCatalog,
      cardImageErrors,
      formPreviewError,
      selectedImageFileName,
      loadingRecetasCatalogo
    },
    derived: {
      combosFiltrados,
      recetasDisponibles,
      formPreviewUrl
    },
    actions: {
      setSearch,
      setShowInactiveOnly,
      setFormPreviewError,
      onChangeField,
      openCreateDrawer,
      closeDrawer,
      onAgregarRecetaDetalle,
      onActualizarDetalleReceta,
      onQuitarRecetaDetalle,
      onSubmit,
      onEditar,
      onCambiarEstado,
      clearFormImage,
      onPickImageFile,
      setCardImageError
    }
  } = useCombosAdmin();

  const [toastMessage, setToastMessage] = useState('');
  const [estadoConfirm, setEstadoConfirm] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState({
    estado: showInactiveOnly ? 'inactivos' : 'activos',
    sortBy: 'recientes'
  });

  const combosVisibles = [...(Array.isArray(combosFiltrados) ? combosFiltrados : [])].sort((a, b) => {
    if (filtersDraft.sortBy === 'nombre_asc') return String(resolveComboNombre(a)).localeCompare(String(resolveComboNombre(b)), 'es');
    if (filtersDraft.sortBy === 'nombre_desc') return String(resolveComboNombre(b)).localeCompare(String(resolveComboNombre(a)), 'es');
    if (filtersDraft.sortBy === 'precio_asc') return Number(a?.precio || 0) - Number(b?.precio || 0);
    if (filtersDraft.sortBy === 'precio_desc') return Number(b?.precio || 0) - Number(a?.precio || 0);
    return Number(b?.id_combo || 0) - Number(a?.id_combo || 0);
  });

  // Muestra confirmacion visible despues de crear/editar/cambiar estado de combos.
  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  useEffect(() => {
    setFiltersDraft((state) => ({
      ...state,
      estado: showInactiveOnly ? 'inactivos' : 'activos'
    }));
  }, [showInactiveOnly]);

  const closeEstadoConfirm = () => {
    if (togglingId) return;
    setEstadoConfirm(null);
  };

  const confirmCambiarEstado = async () => {
    if (!estadoConfirm) return;
    await onCambiarEstado(estadoConfirm);
    setEstadoConfirm(null);
  };

  const estadoConfirmActivo = estadoConfirm ? resolveComboActivo(estadoConfirm) : false;
  const estadoConfirmNombre = String(resolveComboNombre(estadoConfirm) || 'Combo seleccionado');

  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card menu-recetas-admin">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-collection-fill inv-prod-title-icon" />
              <span className="inv-prod-title">Combos</span>
            </div>
            <div className="inv-prod-subtitle">Administracion de combos comerciales del menu</div>
          </div>

          <CombosToolbar
            search={search}
            onSearchChange={setSearch}
            filtersOpen={filtersOpen}
            onOpenFilters={() => setFiltersOpen(true)}
            drawerOpen={drawerOpen}
            onOpenCreate={openCreateDrawer}
            showInactiveOnly={showInactiveOnly}
            onToggleInactiveOnly={setShowInactiveOnly}
          />
        </div>

        <div className="card-body inv-prod-body">
          {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

          <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
            <span>{combosVisibles.length} combos</span>
          </div>

          <CombosTable
            loading={loading}
            combos={combosVisibles}
            togglingId={togglingId}
            cardImageErrors={cardImageErrors}
            onCardImageError={setCardImageError}
            onEditar={onEditar}
            onCambiarEstado={setEstadoConfirm}
          />
        </div>
      </div>

      <MenuFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onApply={() => {
          setShowInactiveOnly(filtersDraft.estado === 'inactivos');
          setFiltersOpen(false);
        }}
        onClear={() => {
          setFiltersDraft({ estado: 'activos', sortBy: 'recientes' });
          setShowInactiveOnly(false);
          setFiltersOpen(false);
        }}
        title="Filtros de combos"
        drawerId="menu-combos-filtros-drawer"
        chips={[{ icon: 'bi-collection', label: 'Combos' }]}
      >
        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Estado</div>
          <div className="inv-ins-chip-grid">
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
          <div className="inv-ins-help">Filtra por estado del combo.</div>
        </div>

        <div className="inv-prod-drawer-section">
          <div className="inv-prod-drawer-section-title">Orden</div>
          <label className="form-label" htmlFor="menu_combos_sort">Ordenar por</label>
          <select
            id="menu_combos_sort"
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
      </MenuFiltersDrawer>

      <CombosFormDrawer
        drawerOpen={drawerOpen}
        drawerMode={drawerMode}
        editingId={editingId}
        form={form}
        menusCatalog={menusCatalog}
        saving={saving}
        recetasDisponibles={recetasDisponibles}
        onChangeField={onChangeField}
        onSubmit={onSubmit}
        onClose={closeDrawer}
        onClearImage={clearFormImage}
        onPickImageFile={onPickImageFile}
        selectedImageFileName={selectedImageFileName}
        formPreviewUrl={formPreviewUrl}
        formPreviewError={formPreviewError}
        loadingRecetasCatalogo={loadingRecetasCatalogo}
        onPreviewError={() => setFormPreviewError(true)}
        onAgregarRecetaDetalle={onAgregarRecetaDetalle}
        onActualizarDetalleReceta={onActualizarDetalleReceta}
        onQuitarRecetaDetalle={onQuitarRecetaDetalle}
      />

      <MenuActionToast
        title="Combos"
        message={toastMessage}
        onClose={() => setToastMessage('')}
      />

      <MenuConfirmDialog
        open={Boolean(estadoConfirm)}
        title={estadoConfirmActivo ? 'Confirmar inactivacion' : 'Confirmar activacion'}
        subtitle={estadoConfirmActivo ? 'El combo dejara de estar disponible' : 'El combo volvera a estar disponible'}
        question={estadoConfirmActivo ? 'Deseas inactivar este combo?' : 'Deseas activar este combo?'}
        description="El cambio afecta la disponibilidad de este combo en el menu."
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

export default CombosAdmin;
