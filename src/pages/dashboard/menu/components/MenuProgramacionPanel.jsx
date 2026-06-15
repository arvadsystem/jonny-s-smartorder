// Panel para activar menu por sucursal y crear menus de temporada desde frontend.
// million-ignore
const MenuProgramacionPanel = ({
  selectedSucursal = null,
  menus = [],
  selectedMenuId = '',
  currentMenuId = '',
  publicationType = 'DEFAULT',
  seasonStartDate = '',
  seasonEndDate = '',
  seasonPriority = '100',
  menuSummary = null,
  loading = false,
  scheduling = false,
  success = '',
  error = '',
  onChangeMenu,
  onChangePublicationType,
  onChangeSeasonStartDate,
  onChangeSeasonEndDate,
  onChangeSeasonPriority,
  onProgramar,
  onEditContent,
  canEditContent = false,
  onReloadMenus,
  selectedMenu = null,
  editingMenu = false,
  deletingMenu = false,
  editMenuSuccess = '',
  editMenuError = '',
  editModalOpen = false,
  editName = '',
  editDescription = '',
  onOpenEditModal,
  onCloseEditModal,
  onChangeEditName,
  onChangeEditDescription,
  onSaveEditMenu,
  onDeleteMenu,
  nextMenuNumber = null,
  createName = '',
  createDescription = '',
  creating = false,
  createSuccess = '',
  createError = '',
  onChangeCreateName,
  onChangeCreateDescription,
  onCreateMenu
}) => {
  // Normaliza filas para garantizar render del select aunque cambie el shape del backend.
  const menuRows = (Array.isArray(menus) ? menus : [])
    .map((menu, index) => {
      const id = Number(menu?.id_menu || menu?.id || 0);
      const name = String(menu?.nombre_menu || menu?.nombre || `Menu ${index + 1}`).trim();
      return { id_menu: id, nombre_menu: name };
    })
    .filter((menu) => Number.isInteger(menu.id_menu) && menu.id_menu > 0);

  const selectedIsCurrent = Number(selectedMenuId || 0) > 0 && Number(selectedMenuId || 0) === Number(currentMenuId || 0);
  const isSeason = publicationType === 'TEMPORADA';
  const defaultAlreadySelected = !isSeason && selectedIsCurrent && menuSummary?.es_default === true;

  return (
    <section className="menu-pub-admin__program-panel" aria-label="Gestion de menu por sucursal">
      <div className="row g-3">
        <div className="col-12 col-xl-7">
          <div className="menu-pub-admin__program-card">
            <header className="menu-pub-admin__program-card-head">
              <div className="menu-pub-admin__program-card-title-wrap">
                <div className="menu-pub-admin__program-card-icon">
                  <i className="bi bi-shuffle" aria-hidden="true" />
                </div>
                <div>
                  <div className="fw-semibold">Cambiar menu activo por sucursal</div>
                  <div className="text-muted small">
                    Activa un menu existente como menu normal o de temporada.
                  </div>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end">
                {selectedSucursal ? (
                  <span className="menu-pub-admin__program-branch-chip">Sucursal seleccionada: {selectedSucursal.nombre_sucursal}</span>
                ) : null}
              </div>
            </header>

          {success ? <div className="alert alert-success py-2 mb-2">{success}</div> : null}
          {error?.message ? (
            <div className="alert alert-danger py-2 mb-2">
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

          <label className="form-label mb-1">Menu activo destino</label>

          <div className="row g-2 align-items-start">
            <div className="col-12 col-lg-8">
              <select
                className="form-select menu-pub-admin__program-select"
                value={String(selectedMenuId || '')}
                onChange={(event) => onChangeMenu?.(event.target.value)}
                onFocus={() => {
                  if (!menuRows.length) onReloadMenus?.();
                }}
                disabled={loading || scheduling}
              >
                <option value="">Selecciona menu</option>
                {menuRows.map((menu) => (
                  <option key={`menu-opt-${menu.id_menu}`} value={String(menu.id_menu)}>
                    #{menu.id_menu} - {menu.nombre_menu}
                  </option>
                ))}
              </select>
              <div className="form-text">Menus disponibles: {menuRows.length}</div>
            </div>

            <div className="col-12 col-lg-4 d-grid gap-2">
              <button
                type="button"
                className="btn inv-prod-btn-subtle w-100"
                disabled={loading || scheduling || !selectedMenu}
                onClick={onOpenEditModal}
              >
                Editar menu
              </button>
              <button
                type="button"
                className="btn btn-outline-danger w-100"
                disabled={loading || scheduling || deletingMenu || !selectedMenu || selectedIsCurrent}
                onClick={onDeleteMenu}
                title={selectedIsCurrent ? 'No puedes eliminar el menu activo de la sucursal.' : 'Eliminar menu sin uso'}
              >
                {deletingMenu ? 'Eliminando...' : 'Eliminar menu'}
              </button>
            </div>
          </div>

          <div className="row g-2 align-items-start mt-2">
            <div className="col-12 col-lg-4">
              <label className="form-label mb-1">Publicar como</label>
              <select
                className="form-select menu-pub-admin__program-select"
                value={publicationType}
                onChange={(event) => onChangePublicationType?.(event.target.value)}
                disabled={loading || scheduling}
              >
                <option value="DEFAULT">Menú normal / DEFAULT</option>
                <option value="TEMPORADA">Menú de temporada</option>
              </select>
            </div>

            {isSeason ? (
              <>
                <div className="col-12 col-lg-4">
                  <label className="form-label mb-1">Fecha/hora inicio opcional</label>
                  <input
                    type="datetime-local"
                    className="form-control menu-pub-admin__program-input"
                    value={seasonStartDate}
                    onChange={(event) => onChangeSeasonStartDate?.(event.target.value)}
                    disabled={loading || scheduling}
                  />
                </div>
                <div className="col-12 col-lg-4">
                  <label className="form-label mb-1">Fecha/hora fin obligatorio</label>
                  <input
                    type="datetime-local"
                    className="form-control menu-pub-admin__program-input"
                    value={seasonEndDate}
                    onChange={(event) => onChangeSeasonEndDate?.(event.target.value)}
                    disabled={loading || scheduling}
                  />
                </div>
                <div className="col-12 col-lg-4">
                  <label className="form-label mb-1">Prioridad opcional</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-control menu-pub-admin__program-input"
                    value={seasonPriority}
                    onChange={(event) => onChangeSeasonPriority?.(event.target.value)}
                    disabled={loading || scheduling}
                    placeholder="100"
                  />
                </div>
              </>
            ) : null}

            <div className={isSeason ? 'col-12 col-lg-8' : 'col-12'}>
              <div className="menu-pub-admin__program-info-note h-100">
                <i className={isSeason ? 'bi bi-calendar2-range' : 'bi bi-house-check'} aria-hidden="true" />
                <div>
                  <strong>{isSeason ? 'Menú de temporada' : 'Menú normal / DEFAULT'}</strong>
                  <p className="mb-0">
                    {isSeason
                      ? 'Al vencer, la sucursal vuelve automáticamente al DEFAULT.'
                      : 'Reemplaza el menú normal de la sucursal. Las temporadas activas no se eliminan.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="d-grid d-lg-flex justify-content-lg-end mt-2">
            <button
              type="button"
              className="btn inv-prod-btn-primary"
              disabled={loading || scheduling || !selectedSucursal || !selectedMenuId || defaultAlreadySelected}
              onClick={onProgramar}
            >
              {scheduling ? 'Guardando...' : isSeason ? 'Programar temporada' : 'Establecer como DEFAULT'}
            </button>
          </div>
          {selectedMenu ? (
            <div className="menu-pub-admin__program-info-note mt-2">
              <i className="bi bi-card-text" aria-hidden="true" />
              <div className="flex-grow-1">
                <strong>Menu seleccionado</strong>
                <p className="mb-0">
                  #{selectedMenu.id_menu} {selectedMenu.nombre_menu}
                  {selectedMenu.descripcion ? ` - ${selectedMenu.descripcion}` : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm inv-prod-btn-primary"
                onClick={onEditContent}
                disabled={!canEditContent || loading || scheduling}
              >
                <i className="bi bi-pencil-square me-1" aria-hidden="true" />
                Editar contenido
              </button>
            </div>
          ) : null}
          <div className="menu-pub-admin__program-info-note">
            <i className="bi bi-info-circle-fill" aria-hidden="true" />
            <div>
              <strong>Que cambia al activar un menu?</strong>
              <p className="mb-0">
                Solo cambia el menu vigente de esta sucursal. No copia, limpia ni publica items automaticamente.
              </p>
            </div>
          </div>
          <div className="menu-pub-admin__program-card-foot">
            <i className="bi bi-shield-lock" aria-hidden="true" />
            <span>No se modificara la base de datos manualmente.</span>
          </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="menu-pub-admin__program-card is-soft">
            <header className="menu-pub-admin__program-card-head">
              <div className="menu-pub-admin__program-card-title-wrap">
                <div className="menu-pub-admin__program-card-icon">
                  <i className="bi bi-file-earmark-plus" aria-hidden="true" />
                </div>
                <div>
                  <div className="fw-semibold">Crear menu de temporada</div>
                  <div className="text-muted small">Se creara un nuevo menu como copia del menu actual.</div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm inv-prod-btn-subtle"
                onClick={onReloadMenus}
                disabled={loading || creating || scheduling}
              >
                Recargar menus
              </button>
            </header>
            <div className="small text-muted mb-2">
              {Number.isInteger(Number(nextMenuNumber || 0))
                ? `Se creara como menu #${nextMenuNumber}.`
                : 'Se asignara el siguiente numero disponible.'}
            </div>

            {createSuccess ? <div className="alert alert-success py-2 mb-2">{createSuccess}</div> : null}
            {createError ? <div className="alert alert-danger py-2 mb-2">{createError}</div> : null}

            <div className="mb-2">
              <label className="form-label mb-1">Nombre del menu</label>
              <input
                type="text"
                className="form-control menu-pub-admin__program-input"
                placeholder="Ej: Menu navideno 2026"
                value={createName}
                onChange={(event) => onChangeCreateName?.(event.target.value)}
                disabled={creating || loading}
                maxLength={120}
              />
            </div>

            <div className="mb-2">
              <label className="form-label mb-1">Descripcion (opcional)</label>
              <textarea
                className="form-control menu-pub-admin__program-input"
                rows={2}
                placeholder="Ej: Torrejas, rompopo y especiales de temporada"
                value={createDescription}
                onChange={(event) => onChangeCreateDescription?.(event.target.value)}
                disabled={creating || loading}
                maxLength={250}
              />
            </div>

            <button
              type="button"
              className="btn inv-prod-btn-subtle w-100 menu-pub-admin__program-create-btn"
              disabled={creating || loading || !String(createName || '').trim()}
              onClick={onCreateMenu}
            >
              {creating ? 'Creando menu...' : 'Crear menu'}
            </button>
          </div>
        </div>
      </div>

      <div className="menu-pub-admin__program-highlights" aria-label="Resumen operativo">
        <article>
          <i className="bi bi-calendar2-week" aria-hidden="true" />
          <div>
            <strong>Menus de temporada</strong>
            <p>Crea menus temporales para fechas especiales sin afectar tu menu normal.</p>
          </div>
        </article>
        <article>
          <i className="bi bi-clock-history" aria-hidden="true" />
          <div>
            <strong>Cambios inmediatos</strong>
            <p>Los cambios se reflejan al instante en la sucursal seleccionada.</p>
          </div>
        </article>
        <article>
          <i className="bi bi-shield-check" aria-hidden="true" />
          <div>
            <strong>Datos seguros</strong>
            <p>Tu menu normal siempre esta protegido. Los temporales son copias.</p>
          </div>
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
                        Editar menu
                      </div>
                      <div className="text-muted small">
                        Actualiza nombre y descripcion del menu seleccionado.
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
                        <div className="inv-prod-pmodal__section-title">Datos del menu</div>
                        <div className="inv-prod-pmodal__section-sub">
                          Se mantiene el mismo `id_menu`; solo cambia su presentacion.
                        </div>
                      </div>

                      <div className="mb-3">
                        <label className="form-label mb-1" htmlFor="menu_publicacion_edit_name">Nombre del menu</label>
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
                        <label className="form-label mb-1" htmlFor="menu_publicacion_edit_description">Descripcion</label>
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
};

export default MenuProgramacionPanel;

