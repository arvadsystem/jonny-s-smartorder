import { useEffect, useState } from 'react';
import CombosFormDrawer from './components/CombosFormDrawer';
import CombosTable from './components/CombosTable';
import CombosToolbar from './components/CombosToolbar';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';
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

  // Muestra confirmacion visible despues de crear/editar/cambiar estado de combos.
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
            drawerOpen={drawerOpen}
            onOpenCreate={openCreateDrawer}
            showInactiveOnly={showInactiveOnly}
            onToggleInactiveOnly={setShowInactiveOnly}
          />
        </div>

        <div className="card-body inv-prod-body">
          {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}

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
            onCambiarEstado={setEstadoConfirm}
          />
        </div>
      </div>

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
