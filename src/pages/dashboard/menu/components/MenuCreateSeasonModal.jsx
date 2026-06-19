const MenuCreateSeasonModal = ({
  open = false,
  nextMenuNumber = null,
  createName = '',
  createDescription = '',
  creating = false,
  createSuccess = '',
  createError = '',
  onClose,
  onChangeCreateName,
  onChangeCreateDescription,
  onCreateMenu
}) => {
  if (!open) return null;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--create show">
      <div className="inv-prod-pmodal__overlay" onClick={creating ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create menu-pub-admin__create-season-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-publicacion-create-season-title"
        >
          <form
            className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create"
            onSubmit={(event) => {
              event.preventDefault();
              onCreateMenu?.();
            }}
          >
            <div className="inv-prod-pmodal__body">
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <div id="menu-publicacion-create-season-title" className="inv-ins-create-hero__title">
                    Crear menú de temporada
                  </div>
                  <div className="text-muted small">
                    {Number.isInteger(Number(nextMenuNumber || 0))
                      ? `Se creará como menú #${nextMenuNumber}.`
                      : 'Se asignará el siguiente número disponible.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar creacion de menu"
                  onClick={onClose}
                  disabled={creating}
                />
              </div>

              {createSuccess ? <div className="alert alert-success py-2 mt-3 mb-0">{createSuccess}</div> : null}
              {createError ? <div className="alert alert-danger py-2 mt-3 mb-0">{createError}</div> : null}

              <div className="inv-prod-pmodal__sections mt-3">
                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Datos del menú</div>
                    <div className="inv-prod-pmodal__section-sub">
                      Crea un menú programable para fechas especiales sin cambiar el menú público hasta que lo programes.
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label mb-1" htmlFor="menu_publicacion_create_name">Nombre del menú</label>
                    <input
                      id="menu_publicacion_create_name"
                      type="text"
                      className="form-control menu-pub-admin__program-input"
                      placeholder="Ej: Menú navideño 2026"
                      value={createName}
                      onChange={(event) => onChangeCreateName?.(event.target.value)}
                      disabled={creating}
                      maxLength={120}
                    />
                  </div>

                  <div className="mb-0">
                    <label className="form-label mb-1" htmlFor="menu_publicacion_create_description">Descripción opcional</label>
                    <textarea
                      id="menu_publicacion_create_description"
                      className="form-control menu-pub-admin__program-input"
                      rows={3}
                      placeholder="Ej: Torrejas, rompopo y especiales de temporada"
                      value={createDescription}
                      onChange={(event) => onChangeCreateDescription?.(event.target.value)}
                      disabled={creating}
                      maxLength={250}
                    />
                  </div>
                </section>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose} disabled={creating}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn inv-prod-btn-primary"
                disabled={creating || !String(createName || '').trim()}
              >
                {creating ? 'Creando menú...' : 'Crear menú'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MenuCreateSeasonModal;
