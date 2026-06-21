import { useState } from 'react';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import DepartamentosFormDrawer from './components/DepartamentosFormDrawer';
import DepartamentosTable from './components/DepartamentosTable';
import DepartamentosToolbar from './components/DepartamentosToolbar';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';
import MenuFiltersDrawer from './components/MenuFiltersDrawer';
import OrdenMenuPublicoDrawer from './components/OrdenMenuPublicoDrawer';
import useDepartamentosAdmin from './hooks/useDepartamentosAdmin';
import { resolveDepartamentoActivo } from './utils/departamentosAdminUtils';

const DepartamentosAdmin = () => {
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
      filtersOpen,
      filters,
      filtersDraft,
      viewMode,
      resultModal
    },
    derived: {
      departamentosFiltrados,
      activeFiltersCount,
      hasActiveFilters
    },
    actions: {
      setSuccess,
      setSearch,
      setViewMode,
      setFiltersDraft,
      onChangeField,
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
      closeResultModal
    }
  } = useDepartamentosAdmin();

  const [estadoConfirm, setEstadoConfirm] = useState(null);
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false);
  const canCreateDepartamento = canAny([PERMISSIONS.MENU_DEPARTAMENTOS_CREAR, PERMISSIONS.MENU_VER]);
  const canEditDepartamento = canAny([PERMISSIONS.MENU_DEPARTAMENTOS_EDITAR, PERMISSIONS.MENU_VER]);
  const canToggleDepartamento = canAny([PERMISSIONS.MENU_DEPARTAMENTOS_EDITAR, PERMISSIONS.MENU_VER]);
  const canOrderPublicMenu = canAny([PERMISSIONS.MENU_PUBLICACION_GUARDAR, PERMISSIONS.MENU_PUBLICACION_VER, PERMISSIONS.MENU_VER]);

  const closeEstadoConfirm = () => {
    if (togglingId) return;
    setEstadoConfirm(null);
  };

  const confirmCambiarEstado = async () => {
    if (!estadoConfirm) return;
    await onCambiarEstado(estadoConfirm);
    setEstadoConfirm(null);
  };

  const estadoConfirmActivo = estadoConfirm ? resolveDepartamentoActivo(estadoConfirm) : false;
  const estadoConfirmNombre = String(estadoConfirm?.nombre_departamento || 'Departamento seleccionado');

  return (
    <>
      <div className="menu-recetas-admin-page">
        <div className="menu-recetas-admin__top-controls">
          <div className="menu-recetas-admin__view-toggle" role="tablist" aria-label="Cambiar vista departamentos">
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
                <i className="bi bi-diagram-3 inv-prod-title-icon" />
                <span className="inv-prod-title">Departamentos</span>
              </div>
              <div className="inv-prod-subtitle">Administracion del catalogo de tipos de departamento del menu</div>
            </div>

            <DepartamentosToolbar
              search={search}
              onSearchChange={setSearch}
              filtersOpen={filtersOpen}
              onOpenFilters={openFiltersDrawer}
              drawerOpen={drawerOpen}
              onOpenCreate={openCreateDrawer}
              canCreate={canCreateDepartamento}
              canOrderPublicMenu={canOrderPublicMenu}
              orderDrawerOpen={orderDrawerOpen}
              onOpenPublicOrder={() => {
                closeCreateDrawer();
                closeFiltersDrawer();
                setOrderDrawerOpen(true);
              }}
              showInactiveOnly={filters.estado === 'inactivos'}
              onToggleInactiveOnly={setShowInactiveOnly}
            />
          </div>

          <div className="card-body inv-prod-body">
            {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

            <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
              <span>{departamentosFiltrados.length} departamentos</span>
              {hasActiveFilters ? <span className="inv-prod-active-filter-pill">{`Filtros activos: ${activeFiltersCount}`}</span> : null}
            </div>

            <DepartamentosTable
              loading={loading}
              departamentos={departamentosFiltrados}
              showInactiveOnly={filters.estado === 'inactivos'}
              viewMode={viewMode}
              togglingId={togglingId}
              canEdit={canEditDepartamento}
              canToggleState={canToggleDepartamento}
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
        title="Filtros de departamentos"
        drawerId="menu-departamentos-filtros-drawer"
        chips={[{ icon: 'bi-diagram-3', label: 'Departamentos' }]}
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
            <div className="inv-ins-help">Filtra por estado de departamento.</div>
          </div>
        </div>
      </MenuFiltersDrawer>

      <DepartamentosFormDrawer
        drawerOpen={drawerOpen}
        drawerMode={drawerMode}
        editingId={editingId}
        form={form}
        saving={saving}
        onChangeField={onChangeField}
        onSubmit={onSubmit}
        onClose={closeCreateDrawer}
      />

      <OrdenMenuPublicoDrawer
        open={orderDrawerOpen}
        onClose={() => setOrderDrawerOpen(false)}
        onSaved={(message) => setSuccess(message)}
      />

      <MenuActionToast
        title="Departamentos"
        message={success}
        onClose={() => setSuccess('')}
      />

      <MenuConfirmDialog
        open={resultModal.open}
        title={resultModal.variant === 'success' ? 'Operacion exitosa' : 'No se pudo guardar'}
        subtitle={resultModal.variant === 'success' ? 'El departamento se guardo correctamente' : 'Revisa los datos e intenta nuevamente'}
        question={resultModal.message}
        itemIcon={resultModal.variant === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}
        confirmLabel="Entendido"
        onClose={closeResultModal}
        onConfirm={closeResultModal}
      />

      <MenuConfirmDialog
        open={Boolean(estadoConfirm)}
        title={estadoConfirmActivo ? 'Confirmar inactivacion' : 'Confirmar activacion'}
        subtitle={estadoConfirmActivo ? 'El departamento dejara de estar disponible para nuevas asignaciones' : 'El departamento volvera a estar disponible'}
        question={estadoConfirmActivo ? 'Deseas inactivar este departamento?' : 'Deseas activar este departamento?'}
        description={
          estadoConfirmActivo
            ? 'Las recetas ya relacionadas conservaran su referencia, pero el departamento no debera aparecer como opcion activa en nuevos registros.'
            : 'El departamento volvera a estar disponible para nuevas asignaciones.'
        }
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

export default DepartamentosAdmin;
