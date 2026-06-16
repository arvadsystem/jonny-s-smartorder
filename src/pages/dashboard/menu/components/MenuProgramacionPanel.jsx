// Contenedor del modal legacy de edicion de nombre/descripcion de menu.
// million-ignore
const MenuProgramacionPanel = ({
  editingMenu = false,
  editMenuSuccess = '',
  editMenuError = '',
  editModalOpen = false,
  editName = '',
  editDescription = '',
  onCloseEditModal,
  onChangeEditName,
  onChangeEditDescription,
  onSaveEditMenu
}) => {
  if (!editModalOpen) return null;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--create show">
      <div className="inv-prod-pmodal__overlay" onClick={editingMenu ? undefined : onCloseEditModal} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-publicacion-edit-modal-title"
        >
          <form
            className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create"
            onSubmit={(event) => {
              event.preventDefault();
              onSaveEditMenu?.();
            }}
          >
            <div className="inv-prod-pmodal__body">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div id="menu-publicacion-edit-modal-title" className="inv-ins-create-hero__title">
                    Editar menú
                  </div>
                  <div className="text-muted small">
                    Actualiza nombre y descripción del menú seleccionado.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar modal de edicion"
                  onClick={onCloseEditModal}
                  disabled={editingMenu}
                />
              </div>

              {editMenuSuccess ? <div className="alert alert-success py-2 mt-3 mb-0">{editMenuSuccess}</div> : null}
              {editMenuError ? <div className="alert alert-danger py-2 mt-3 mb-0">{editMenuError}</div> : null}

              <div className="inv-prod-pmodal__sections mt-3">
                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Datos del menú</div>
                    <div className="inv-prod-pmodal__section-sub">
                      Se mantiene el mismo id_menu; solo cambia su presentación.
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label mb-1" htmlFor="menu_publicacion_edit_name">Nombre del menú</label>
                    <input
                      id="menu_publicacion_edit_name"
                      type="text"
                      className="form-control menu-pub-admin__program-input"
                      value={editName}
                      onChange={(event) => onChangeEditName?.(event.target.value)}
                      disabled={editingMenu}
                      maxLength={120}
                    />
                  </div>

                  <div className="mb-0">
                    <label className="form-label mb-1" htmlFor="menu_publicacion_edit_description">Descripción</label>
                    <textarea
                      id="menu_publicacion_edit_description"
                      className="form-control menu-pub-admin__program-input"
                      rows={3}
                      value={editDescription}
                      onChange={(event) => onChangeEditDescription?.(event.target.value)}
                      disabled={editingMenu}
                      maxLength={250}
                    />
                  </div>
                </section>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={onCloseEditModal} disabled={editingMenu}>
                Cancelar
              </button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={editingMenu || !String(editName || '').trim()}>
                {editingMenu ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MenuProgramacionPanel;
