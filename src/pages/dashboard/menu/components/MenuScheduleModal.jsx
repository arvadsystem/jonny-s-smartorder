const MenuScheduleModal = ({
  open = false,
  selectedSucursal = null,
  menus = [],
  selectedMenuId = '',
  selectedMenu = null,
  currentMenuId = '',
  defaultMenuId = '',
  publicationType = 'DEFAULT',
  seasonStartDate = '',
  seasonEndDate = '',
  seasonPriority = '100',
  loading = false,
  scheduling = false,
  error = null,
  success = '',
  menuSummary = null,
  onClose,
  onChangeMenu,
  onChangePublicationType,
  onChangeSeasonStartDate,
  onChangeSeasonEndDate,
  onChangeSeasonPriority,
  onProgramar,
  onReloadMenus
}) => {
  if (!open) return null;

  const menuRows = (Array.isArray(menus) ? menus : [])
    .map((menu, index) => {
      const id = Number(menu?.id_menu || menu?.id || 0);
      const name = String(menu?.nombre_menu || menu?.nombre || `Menu ${index + 1}`).trim();
      return { id_menu: id, nombre_menu: name };
    })
    .filter((menu) => Number.isInteger(menu.id_menu) && menu.id_menu > 0);

  const isSeason = publicationType === 'TEMPORADA';
  const selectedId = Number(selectedMenuId || 0);
  const resolvedDefaultId = Number(
    defaultMenuId
      || (menuSummary?.es_default === true ? currentMenuId : 0)
      || 0
  );
  const defaultAlreadySelected = !isSeason && selectedId > 0 && selectedId === resolvedDefaultId;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--create show">
      <div className="inv-prod-pmodal__overlay" onClick={scheduling ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create menu-pub-admin__schedule-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-publicacion-schedule-title"
        >
          <div className="inv-prod-pmodal__body">
            <div className="d-flex align-items-start justify-content-between gap-3">
              <div>
                <div id="menu-publicacion-schedule-title" className="inv-ins-create-hero__title">
                  Cambiar / programar menú
                </div>
                <div className="text-muted small">
                  {selectedSucursal
                    ? `Sucursal: ${selectedSucursal.nombre_sucursal}`
                    : 'Selecciona una sucursal antes de publicar.'}
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar programacion de menu"
                onClick={onClose}
                disabled={scheduling}
              />
            </div>

            {success ? <div className="alert alert-success py-2 mt-3 mb-0">{success}</div> : null}
            {error?.message ? (
              <div className="alert alert-danger py-2 mt-3 mb-0">
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

            <div className="inv-prod-pmodal__sections mt-3">
              <section className="inv-prod-pmodal__section">
                <div className="inv-prod-pmodal__section-head">
                  <div className="inv-prod-pmodal__section-title">Destino de publicación</div>
                  <div className="inv-prod-pmodal__section-sub">
                    Define si el menú será normal de respaldo o una temporada con fecha de vencimiento.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label mb-1" htmlFor="menu_publicacion_schedule_menu">Menú activo destino</label>
                  <select
                    id="menu_publicacion_schedule_menu"
                    className="form-select menu-pub-admin__program-select"
                    value={String(selectedMenuId || '')}
                    onChange={(event) => onChangeMenu?.(event.target.value)}
                    onFocus={() => {
                      if (!menuRows.length) onReloadMenus?.();
                    }}
                    disabled={loading || scheduling}
                  >
                    <option value="">Selecciona menú</option>
                    {menuRows.map((menu) => (
                      <option key={`menu-schedule-opt-${menu.id_menu}`} value={String(menu.id_menu)}>
                        #{menu.id_menu} - {menu.nombre_menu}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    {selectedMenu
                      ? `Seleccionado: #${selectedMenu.id_menu} ${selectedMenu.nombre_menu}`
                      : `Menús disponibles: ${menuRows.length}`}
                  </div>
                </div>

                <div className="row g-2 align-items-start">
                  <div className="col-12 col-lg-4">
                    <label className="form-label mb-1" htmlFor="menu_publicacion_schedule_type">Publicar como</label>
                    <select
                      id="menu_publicacion_schedule_type"
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
                        <label className="form-label mb-1" htmlFor="menu_publicacion_schedule_start">Fecha/hora inicio opcional</label>
                        <input
                          id="menu_publicacion_schedule_start"
                          type="datetime-local"
                          className="form-control menu-pub-admin__program-input"
                          value={seasonStartDate}
                          onChange={(event) => onChangeSeasonStartDate?.(event.target.value)}
                          disabled={loading || scheduling}
                        />
                      </div>
                      <div className="col-12 col-lg-4">
                        <label className="form-label mb-1" htmlFor="menu_publicacion_schedule_end">Fecha/hora fin obligatorio</label>
                        <input
                          id="menu_publicacion_schedule_end"
                          type="datetime-local"
                          className="form-control menu-pub-admin__program-input"
                          value={seasonEndDate}
                          onChange={(event) => onChangeSeasonEndDate?.(event.target.value)}
                          disabled={loading || scheduling}
                        />
                      </div>
                      <div className="col-12 col-lg-4">
                        <label className="form-label mb-1" htmlFor="menu_publicacion_schedule_priority">Prioridad opcional</label>
                        <input
                          id="menu_publicacion_schedule_priority"
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
                            : 'Este menú quedará como menú por defecto de la sucursal. Si existe una temporada activa, será visible cuando la temporada termine o sea cancelada.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
            <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose} disabled={scheduling}>
              Cerrar
            </button>
            <button
              type="button"
              className="btn inv-prod-btn-primary"
              disabled={loading || scheduling || !selectedSucursal || !selectedMenuId || defaultAlreadySelected}
              onClick={onProgramar}
            >
              {scheduling ? 'Guardando...' : isSeason ? 'Programar temporada' : 'Establecer como DEFECTO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuScheduleModal;
