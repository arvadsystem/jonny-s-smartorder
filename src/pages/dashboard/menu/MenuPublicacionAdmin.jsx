import MenuPreviewPanel from './components/MenuPreviewPanel';
import MenuPublicationTable from './components/MenuPublicationTable';
import MenuSucursalSelector from './components/MenuSucursalSelector';
import useMenuPublicacionAdmin from './hooks/useMenuPublicacionAdmin';

// Pantalla MVP para publicar menu por sucursal desde el panel admin.
const MenuPublicacionAdmin = ({ showPreview = false }) => {
  const {
    state: {
      sucursales,
      selectedSucursalId,
      menuSummary,
      items,
      preview,
      loadingSucursales,
      loadingCatalogo,
      loadingPreview,
      saving,
      error,
      previewError,
      success,
      warnings,
      validationErrors,
      openAsClientUrl
    },
    actions: {
      onSelectSucursal,
      onToggleVisible,
      onChangePrecioPublico,
      onChangeOrden,
      savePublication,
      reloadCurrent
    }
  } = useMenuPublicacionAdmin();

  return (
    <div className="card shadow-sm mb-3 inv-prod-card menu-pub-admin">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-broadcast-pin inv-prod-title-icon" />
            <span className="inv-prod-title">Publicacion por sucursal</span>
          </div>
          <div className="inv-prod-subtitle">
            Controla visibilidad, precio publico y orden del menu cliente por sucursal.
          </div>
        </div>

        <div className="inv-prod-header-actions">
          <button
            type="button"
            className="btn inv-prod-btn-primary"
            onClick={savePublication}
            disabled={saving || loadingCatalogo || !selectedSucursalId}
          >
            {saving ? 'Guardando...' : 'Guardar publicacion'}
          </button>
        </div>
      </div>

      <div className="card-body inv-prod-body">
        {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
        {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

        {validationErrors.length > 0 ? (
          <div className="alert alert-danger inv-prod-alert mb-2">
            <div className="fw-semibold mb-1">Errores de validacion</div>
            <ul className="mb-0 ps-3">
              {validationErrors.map((item, index) => (
                <li key={`menu-pub-val-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="alert alert-warning inv-prod-alert mb-2">
            <div className="fw-semibold mb-1">Advertencias</div>
            <ul className="mb-0 ps-3">
              {warnings.map((item, index) => (
                <li key={`menu-pub-warn-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <MenuSucursalSelector
          sucursales={sucursales}
          selectedSucursalId={selectedSucursalId}
          menuSummary={menuSummary}
          loading={loadingSucursales || loadingCatalogo}
          onChange={onSelectSucursal}
          onReload={reloadCurrent}
        />

        <div className="row g-3 mt-1">
          <div className={showPreview ? 'col-12 col-xl-7' : 'col-12'}>
            <MenuPublicationTable
              items={items}
              loading={loadingCatalogo}
              onToggleVisible={onToggleVisible}
              onChangePrecioPublico={onChangePrecioPublico}
              onChangeOrden={onChangeOrden}
            />
          </div>

          {showPreview ? (
            <div className="col-12 col-xl-5">
              <MenuPreviewPanel
                loading={loadingPreview}
                error={previewError}
                preview={preview}
                openAsClientUrl={openAsClientUrl}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MenuPublicacionAdmin;
