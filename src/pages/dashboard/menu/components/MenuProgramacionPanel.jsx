// Panel para activar menu por sucursal y crear menus de temporada desde frontend.
// million-ignore
const MenuProgramacionPanel = ({
  selectedSucursal = null,
  menus = [],
  selectedMenuId = '',
  currentMenuId = '',
  loading = false,
  scheduling = false,
  success = '',
  error = '',
  onChangeMenu,
  onProgramar,
  onReloadMenus,
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
          {error ? <div className="alert alert-danger py-2 mb-2">{error}</div> : null}

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
                className="btn inv-prod-btn-primary w-100"
                disabled={loading || scheduling || !selectedSucursal || !selectedMenuId || selectedIsCurrent}
                onClick={onProgramar}
              >
                {scheduling ? 'Cambiando...' : 'Activar menu ahora'}
              </button>
            </div>
          </div>
          <div className="menu-pub-admin__program-info-note">
            <i className="bi bi-info-circle-fill" aria-hidden="true" />
            <div>
              <strong>Que cambia al activar un menu?</strong>
              <p className="mb-0">El menu seleccionado sera el que veran los clientes al realizar pedidos en esta sucursal.</p>
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
    </section>
  );
};

export default MenuProgramacionPanel;

