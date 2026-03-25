import { useEffect, useState } from 'react';
import CombosFormDrawer from './components/CombosFormDrawer';
import CombosTable from './components/CombosTable';
import CombosToolbar from './components/CombosToolbar';
import MenuActionToast from './components/MenuActionToast';
import useCombosAdmin from './hooks/useCombosAdmin';

const CombosAdmin = () => {
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
      cardImageErrors,
      formPreviewError,
      loadingRecetasCatalogo
    },
    derived: {
      combosFiltrados,
      recetasDisponibles,
      formPreviewUrl
    },
    actions: {
      setSearch,
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
      setCardImageError
    }
  } = useCombosAdmin();

  const [toastMessage, setToastMessage] = useState('');

  // Muestra confirmacion visible despues de crear/editar/cambiar estado de combos.
  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

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
            drawerOpen={drawerOpen}
            onOpenCreate={openCreateDrawer}
          />
        </div>

        <div className="card-body inv-prod-body">
          {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
          {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

          <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
            <span>{combosFiltrados.length} combos</span>
          </div>

          <CombosTable
            loading={loading}
            combos={combosFiltrados}
            togglingId={togglingId}
            cardImageErrors={cardImageErrors}
            onCardImageError={setCardImageError}
            onEditar={onEditar}
            onCambiarEstado={onCambiarEstado}
          />
        </div>
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${drawerOpen ? 'show' : ''}`}
        onClick={closeDrawer}
        aria-hidden={!drawerOpen}
      />

      <CombosFormDrawer
        drawerOpen={drawerOpen}
        drawerMode={drawerMode}
        editingId={editingId}
        form={form}
        saving={saving}
        recetasDisponibles={recetasDisponibles}
        onChangeField={onChangeField}
        onSubmit={onSubmit}
        onClose={closeDrawer}
        onClearImage={clearFormImage}
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
    </>
  );
};

export default CombosAdmin;
