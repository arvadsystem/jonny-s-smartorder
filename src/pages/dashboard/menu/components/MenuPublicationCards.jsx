const normalizeMenuRows = (menus) => (Array.isArray(menus) ? menus : [])
  .map((menu, index) => ({
    ...menu,
    id_menu: Number(menu?.id_menu || menu?.id || 0),
    nombre_menu: String(menu?.nombre_menu || menu?.nombre || `Menu ${index + 1}`).trim(),
    descripcion: String(menu?.descripcion || menu?.menu_descripcion || '').trim()
  }))
  .filter((menu) => Number.isInteger(menu.id_menu) && menu.id_menu > 0);

const MenuPublicationCards = ({
  menus = [],
  selectedMenuId = '',
  currentMenuId = '',
  menuSummary = null,
  selectedSucursal = null,
  loading = false,
  viewMode = 'cards',
  onChangeViewMode,
  onSelectMenu,
  onEditContent,
  onSetDefault,
  onProgramSeason,
  onOpenCreateSeason,
  onOpenEditMenu,
  onDeleteMenu
}) => {
  const rows = normalizeMenuRows(menus);
  const currentId = Number(menuSummary?.id_menu || currentMenuId || 0);
  const selectedId = Number(selectedMenuId || 0);
  const isList = viewMode === 'list';
  const canUseBranch = Boolean(selectedSucursal?.estado);

  return (
    <section className="menu-pub-admin__menus-section" aria-label="Menus disponibles">
      <header className="menu-pub-admin__menus-head">
        <div>
          <div className="fw-semibold">Menús disponibles</div>
          <div className="text-muted small">
            Selecciona un menú y ejecuta acciones sin abrir formularios permanentes.
          </div>
        </div>
        <div className="menu-pub-admin__menus-actions">
          <div className="btn-group btn-group-sm" role="group" aria-label="Vista de menus">
            <button
              type="button"
              className={`btn inv-prod-btn-subtle ${!isList ? 'is-active' : ''}`}
              onClick={() => onChangeViewMode?.('cards')}
            >
              <i className="bi bi-grid-3x3-gap" aria-hidden="true" />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`btn inv-prod-btn-subtle ${isList ? 'is-active' : ''}`}
              onClick={() => onChangeViewMode?.('list')}
            >
              <i className="bi bi-list-ul" aria-hidden="true" />
              <span>Lista</span>
            </button>
          </div>
          <button type="button" className="btn inv-prod-btn-subtle" onClick={onOpenCreateSeason}>
            <i className="bi bi-file-earmark-plus" aria-hidden="true" />
            Crear menú de temporada
          </button>
        </div>
      </header>

      {loading ? (
        <div className="menu-pub-admin__menus-empty">
          <i className="bi bi-arrow-repeat" aria-hidden="true" />
          <span>Cargando menús disponibles...</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="menu-pub-admin__menus-empty">
          <i className="bi bi-journal-x" aria-hidden="true" />
          <span>No hay menús programables disponibles.</span>
        </div>
      ) : (
        <div className={isList ? 'menu-pub-admin__menus-list' : 'menu-pub-admin__menus-grid'}>
          {rows.map((menu) => {
            const isCurrent = Number(menu.id_menu) === currentId;
            const isSelected = Number(menu.id_menu) === selectedId;
            const isDefault = isCurrent && menuSummary?.es_default === true;
            const isSeason = isCurrent && menuSummary?.tipo_publicacion === 'TEMPORADA';
            const canDelete = !isCurrent;
            const branchCount = menu?.total_sucursales || menu?.total_sucursales_activas || menu?.sucursales_count;

            return (
              <article
                key={`menu-pub-card-${menu.id_menu}`}
                className={`menu-pub-admin__menu-card ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''} ${isList ? 'is-list' : ''}`}
              >
                <div className="menu-pub-admin__menu-card-main">
                  <div className="menu-pub-admin__menu-card-icon">
                    <i className="bi bi-journal-richtext" aria-hidden="true" />
                  </div>
                  <div className="menu-pub-admin__menu-card-copy">
                    <div className="menu-pub-admin__menu-card-title-row">
                      <h6>{menu.nombre_menu}</h6>
                      <span className="menu-recetas-card__id">#{menu.id_menu}</span>
                    </div>
                    <p>{menu.descripcion || 'Sin descripción registrada.'}</p>
                    <div className="menu-pub-admin__menu-card-badges">
                      {isCurrent ? <span className="badge text-bg-primary">ACTUAL</span> : null}
                      {isDefault ? <span className="badge text-bg-success">DEFAULT</span> : null}
                      {isSeason ? <span className="badge text-bg-warning">TEMPORADA</span> : null}
                      {isSelected ? <span className="badge text-bg-light">Seleccionado</span> : null}
                    </div>
                  </div>
                </div>

                <div className="menu-recetas-card__meta menu-pub-admin__menu-card-meta">
                  <div>
                    <small>Sucursales</small>
                    <strong>{branchCount !== undefined && branchCount !== null ? branchCount : '--'}</strong>
                  </div>
                  <div>
                    <small>Estado</small>
                    <strong>{isCurrent ? 'Publicado' : 'Disponible'}</strong>
                  </div>
                </div>

                <footer className="menu-pub-admin__menu-card-actions">
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle"
                    onClick={() => onSelectMenu?.(menu)}
                    disabled={isSelected}
                  >
                    Seleccionar
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-primary"
                    onClick={() => onEditContent?.(menu)}
                    disabled={!canUseBranch}
                  >
                    Editar contenido
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle"
                    onClick={() => onSetDefault?.(menu)}
                    disabled={!canUseBranch || isDefault}
                  >
                    Establecer DEFAULT
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle"
                    onClick={() => onProgramSeason?.(menu)}
                    disabled={!canUseBranch}
                  >
                    Programar temporada
                  </button>
                  <button
                    type="button"
                    className="btn inv-prod-btn-subtle"
                    onClick={() => onOpenEditMenu?.(menu)}
                  >
                    Editar menú
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => onDeleteMenu?.(menu)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default MenuPublicationCards;
