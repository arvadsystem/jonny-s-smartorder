// Panel compacto de acciones para publicacion por sucursal.
// million-ignore
const MenuProgramacionPanel = ({
  selectedSucursal = null,
  selectedMenu = null,
  loading = false,
  scheduling = false,
  editingMenu = false,
  deletingMenu = false,
  success = '',
  error = '',
  editMenuSuccess = '',
  editMenuError = '',
  editModalOpen = false,
  editName = '',
  editDescription = '',
  onOpenSchedule,
  onOpenCreateSeason,
  onEditContent,
  canEditContent = false,
  onReloadMenus,
  onCloseEditModal,
  onChangeEditName,
  onChangeEditDescription,
  onSaveEditMenu
}) => (
  <section className="menu-pub-admin__program-panel menu-pub-admin__program-panel--compact" aria-label="Acciones de publicacion por sucursal">
    {(success || error?.message) ? (
      <div className="menu-pub-admin__program-feedback">
        {success ? <div className="alert alert-success py-2 mb-0">{success}</div> : null}
        {error?.message ? (
          <div className="alert alert-danger py-2 mb-0">
            <div>{error.message}</div>
            {(error.code || error.phase || error.correlationId) ? (
              <details className="mt-1">
                <summary className="small">Detalle técnico para soporte</summary>
                <div className="small mt-1">
                  {error.code ? <div>Código: {error.code}</div> : null}
                  {error.phase ? <div>Fase: {error.phase}</div> : null}
                  {error.correlationId ? <div>Referencia: {error.correlationId}</div> : null}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null}

    <div className="menu-pub-admin__quick-actions">
      <article>
        <i className="bi bi-shuffle" aria-hidden="true" />
        <div>
          <strong>Cambiar / programar menú</strong>
          <p>Publica un menú como DEFAULT o agenda una temporada.</p>
        </div>
        <button
          type="button"
          className="btn inv-prod-btn-primary"
          onClick={onOpenSchedule}
          disabled={loading || scheduling || !selectedSucursal?.estado}
        >
          Abrir
        </button>
      </article>
      <article>
        <i className="bi bi-file-earmark-plus" aria-hidden="true" />
        <div>
          <strong>Crear menú de temporada</strong>
          <p>Crea una base nueva para promociones o fechas especiales.</p>
        </div>
        <button
          type="button"
          className="btn inv-prod-btn-subtle"
          onClick={onOpenCreateSeason}
          disabled={loading}
        >
          Crear
        </button>
      </article>
      <article>
        <i className="bi bi-pencil-square" aria-hidden="true" />
        <div>
          <strong>Editar contenido</strong>
          <p>{selectedMenu ? `#${selectedMenu.id_menu} ${selectedMenu.nombre_menu}` : 'Selecciona un menú disponible.'}</p>
        </div>
        <button
          type="button"
          className="btn inv-prod-btn-primary"
          onClick={onEditContent}
          disabled={!canEditContent || loading || scheduling}
        >
          Editar contenido
        </button>
      </article>
      <article>
        <i className="bi bi-arrow-clockwise" aria-hidden="true" />
        <div>
          <strong>Actualizar datos</strong>
          <p>Recarga sucursal, menú vigente y menús disponibles.</p>
        </div>
        <button
          type="button"
          className="btn inv-prod-btn-subtle"
          onClick={onReloadMenus}
          disabled={loading || scheduling || deletingMenu}
        >
          Recargar menús
        </button>
      </article>
    </div>

    {editModalOpen ? (
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
    ) : null}
  </section>
);

export default MenuProgramacionPanel;
