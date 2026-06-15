import MenuPublicationTable from './MenuPublicationTable';

const MenuContentEditorModal = ({
  open = false,
  title = 'Editar contenido del menú',
  subtitle = '',
  menuSummary = null,
  selectedSucursal = null,
  items = [],
  loading = false,
  saving = false,
  onClose,
  onSave,
  onToggleVisible,
  onToggleAllVisible,
  onChangePrecioPublico,
  onUseOriginalPriceForAll
}) => {
  if (!open) return null;

  const publicationType = menuSummary?.tipo_publicacion === 'TEMPORADA' ? 'TEMPORADA' : 'DEFAULT';
  const menuName = menuSummary?.nombre_menu || 'Menú seleccionado';
  const branchName = selectedSucursal?.nombre_sucursal || 'Sucursal seleccionada';

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--menu-content show">
      <div className="inv-prod-pmodal__overlay" onClick={saving ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--menu-content"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-content-editor-title"
        >
          <header className="inv-prod-pmodal__header menu-pub-admin__content-modal-header">
            <div className="inv-prod-pmodal__header-copy">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div id="menu-content-editor-title" className="inv-prod-drawer-title">{title}</div>
                <span className={`badge ${publicationType === 'TEMPORADA' ? 'text-bg-warning' : 'text-bg-success'}`}>
                  {publicationType}
                </span>
              </div>
              <div className="inv-prod-drawer-sub">
                {subtitle || 'Edita el contenido publicado del menú.'}
              </div>
              <div className="menu-pub-admin__content-modal-meta">
                <span><strong>{menuName}</strong></span>
                <span>{branchName}</span>
                <span>{items.length} items cargados</span>
              </div>
            </div>

            <div className="menu-pub-admin__content-modal-actions">
              <button
                type="button"
                className="btn inv-prod-btn-primary"
                onClick={onSave}
                disabled={saving || loading}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="btn inv-prod-btn-subtle"
                onClick={onClose}
                disabled={saving}
              >
                Cerrar
              </button>
            </div>
          </header>

          <div className="inv-prod-pmodal__body menu-pub-admin__content-modal-body">
            <MenuPublicationTable
              items={items}
              loading={loading}
              onToggleVisible={onToggleVisible}
              onToggleAllVisible={onToggleAllVisible}
              onChangePrecioPublico={onChangePrecioPublico}
              onUseOriginalPriceForAll={onUseOriginalPriceForAll}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuContentEditorModal;
