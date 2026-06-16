const truncateText = (value, maxLength = 104) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
};

const formatDateTimeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

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
  publishedMenuSummary = null,
  selectedCatalogMenuSummary = null,
  defaultMenuId = '',
  selectedSucursal = null,
  loading = false,
  viewMode = 'cards',
  onSelectMenu,
  onEditContent,
  onSetDefault,
  onProgramSeason,
  onOpenEditMenu,
  onDeleteMenu
}) => {
  const rows = normalizeMenuRows(menus);
  const currentId = Number(publishedMenuSummary?.id_menu || currentMenuId || 0);
  const selectedId = Number(selectedMenuId || 0);
  const activeSeasonId = publishedMenuSummary?.tipo_publicacion === 'TEMPORADA' ? currentId : 0;
  const resolvedDefaultId = Number(
    defaultMenuId
      || (publishedMenuSummary?.es_default === true ? publishedMenuSummary?.id_menu : 0)
      || (selectedCatalogMenuSummary?.es_default === true ? selectedCatalogMenuSummary?.id_menu : 0)
      || 0
  );
  const canUseBranch = Boolean(selectedSucursal?.estado);
  const isList = viewMode === 'list';

  const resolveStates = (menu) => {
    const menuId = Number(menu.id_menu || 0);
    const states = [];
    if (menuId > 0 && menuId === currentId) states.push('PUBLICADO AHORA');
    if (menuId > 0 && menuId === resolvedDefaultId) states.push('DEFAULT/FALLBACK');
    if (menuId > 0 && menuId === activeSeasonId) states.push('TEMPORADA ACTIVA');
    return states.length > 0 ? states : ['DISPONIBLE'];
  };

  const resolveBadgeClass = (type) => (
    type === 'TEMPORADA ACTIVA'
      ? 'menu-recetas-admin__estado-badge is-inactive'
      : type === 'DISPONIBLE'
        ? 'menu-recetas-admin__estado-badge is-neutral'
        : 'menu-recetas-admin__estado-badge is-active'
  );

  const resolveVigencia = (menu) => {
    const isCurrent = Number(menu.id_menu) === currentId;
    if (!isCurrent) return '--';
    if (formatDateTimeLabel(publishedMenuSummary?.fecha_fin)) return `Hasta ${formatDateTimeLabel(publishedMenuSummary.fecha_fin)}`;
    if (formatDateTimeLabel(publishedMenuSummary?.fecha_inicio)) return `Desde ${formatDateTimeLabel(publishedMenuSummary.fecha_inicio)}`;
    return 'Sin fecha';
  };

  return (
    <section aria-label="Menus disponibles">
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
      ) : isList ? (
        <div className="table-responsive">
          <table className="table table-hover align-middle menu-recetas-admin__table menu-pub-admin__menus-table mb-0">
            <thead>
              <tr>
                <th>Menú</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Vigencia</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((menu) => {
                const states = resolveStates(menu);
                const isCurrent = Number(menu.id_menu) === currentId;
                const isSelected = Number(menu.id_menu) === selectedId;
                const canDelete = !isCurrent;

                return (
                  <tr key={`menu-pub-list-${menu.id_menu}`} className={isSelected ? 'table-warning' : ''}>
                    <td>
                      <div className="fw-semibold">{menu.nombre_menu}</div>
                      <div className="small text-muted">#{menu.id_menu} {menu.descripcion || 'Sin descripción registrada.'}</div>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {states.map((state) => (
                          <span key={`menu-pub-list-state-${menu.id_menu}-${state}`} className={resolveBadgeClass(state)}>{state}</span>
                        ))}
                      </div>
                    </td>
                    <td>{isCurrent ? 'Publicado' : 'Disponible'}</td>
                    <td>{resolveVigencia(menu)}</td>
                    <td>
                      <div className="menu-recetas-admin__row-actions justify-content-end">
                        <button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => onSelectMenu?.(menu)} disabled={isSelected} title="Seleccionar">
                          <i className="bi bi-check2-circle" aria-hidden="true" />
                          <span className="inv-catpro-action-label">Seleccionar</span>
                        </button>
                        <button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => onEditContent?.(menu)} disabled={!canUseBranch} title="Editar contenido">
                          <i className="bi bi-pencil-square" aria-hidden="true" />
                          <span className="inv-catpro-action-label">Contenido</span>
                        </button>
                        <button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => onProgramSeason?.(menu)} disabled={!canUseBranch} title="Programar temporada">
                          <i className="bi bi-calendar2-range" aria-hidden="true" />
                          <span className="inv-catpro-action-label">Programar</span>
                        </button>
                        <button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => onOpenEditMenu?.(menu)} title="Editar menú">
                          <i className="bi bi-card-text" aria-hidden="true" />
                          <span className="inv-catpro-action-label">Editar</span>
                        </button>
                        {canDelete ? (
                          <button type="button" className="inv-catpro-action state-off inv-catpro-action-compact" onClick={() => onDeleteMenu?.(menu)} title="Eliminar">
                            <i className="bi bi-trash3" aria-hidden="true" />
                            <span className="inv-catpro-action-label">Eliminar</span>
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inv-ins-carousel-shell">
          <div className="inv-ins-carousel-meta">
            <span>Pagina 1 de 1</span>
            <span>{`${rows.length} menús visibles`}</span>
          </div>
          <div className="inv-ins-carousel-page menu-recetas-admin__carousel-page menu-pub-admin__menus-grid">
          {rows.map((menu) => {
            const isCurrent = Number(menu.id_menu) === currentId;
            const isSelected = Number(menu.id_menu) === selectedId;
            const canDelete = !isCurrent;
            const branchCount = menu?.total_sucursales || menu?.total_sucursales_activas || menu?.sucursales_count;
            const states = resolveStates(menu);
            const primaryState = states.includes('TEMPORADA ACTIVA')
              ? 'TEMPORADA ACTIVA'
              : states.includes('DEFAULT/FALLBACK')
                ? 'DEFAULT/FALLBACK'
                : states[0];
            const descripcion = truncateText(menu.descripcion || 'Sin descripción registrada.', 104);

            return (
              <article
                key={`menu-pub-card-${menu.id_menu}`}
                className={`menu-recetas-card menu-recetas-card--compact menu-pub-admin__menu-card ${isCurrent ? 'is-active' : 'is-inactive'} ${isSelected ? 'is-selected' : ''}`}
              >
                <header className="menu-recetas-card__media menu-pub-admin__menu-card-media">
                  <div className="menu-recetas-card__placeholder">
                    <i className="bi bi-journal-richtext" />
                    <span>Menú</span>
                  </div>
                  <div className="menu-recetas-card__media-top">
                    <span className={resolveBadgeClass(primaryState)}>{primaryState}</span>
                    <span className="menu-recetas-card__price-pill">#{menu.id_menu}</span>
                  </div>
                </header>

                <div className="menu-recetas-card__body">
                  <div className="menu-recetas-card__title-row">
                    <h6>{menu.nombre_menu}</h6>
                    <span className="menu-recetas-card__id">{isSelected ? 'Seleccionado' : `#${menu.id_menu}`}</span>
                  </div>
                  <p className="menu-recetas-card__description">{descripcion}</p>
                  <div className="menu-recetas-card__meta">
                    <div>
                      <small>Tipo</small>
                      <strong>{states.join(' / ')}</strong>
                    </div>
                    <div>
                      <small>Sucursal</small>
                      <strong>{selectedSucursal?.nombre_sucursal || '--'}</strong>
                    </div>
                    <div>
                      <small>Estado</small>
                      <strong>{isCurrent ? 'Publicado' : 'Disponible'}</strong>
                    </div>
                    <div>
                      <small>Vigencia</small>
                      <strong>{resolveVigencia(menu)}</strong>
                    </div>
                    <div>
                      <small>Sucursales</small>
                      <strong>{branchCount !== undefined && branchCount !== null ? branchCount : '--'}</strong>
                    </div>
                  </div>
                </div>

                <footer className="menu-recetas-card__actions menu-pub-admin__menu-card-actions">
                  <button
                    type="button"
                    className="inv-catpro-action edit inv-catpro-action-compact menu-recetas-admin__edit-action"
                    onClick={() => onSelectMenu?.(menu)}
                    disabled={isSelected}
                    title="Seleccionar"
                  >
                    <i className="bi bi-check2-circle" aria-hidden="true" />
                    <span className="inv-catpro-action-label">Seleccionar</span>
                  </button>
                  <button
                    type="button"
                    className="inv-catpro-action edit inv-catpro-action-compact menu-recetas-admin__edit-action"
                    onClick={() => onEditContent?.(menu)}
                    disabled={!canUseBranch}
                    title="Editar contenido"
                  >
                    <i className="bi bi-pencil-square" aria-hidden="true" />
                    <span className="inv-catpro-action-label">Contenido</span>
                  </button>
                  <button
                    type="button"
                    className="inv-catpro-action edit inv-catpro-action-compact"
                    onClick={() => onSetDefault?.(menu)}
                    disabled={!canUseBranch || states.includes('DEFAULT/FALLBACK')}
                    title="Establecer como DEFAULT/fallback"
                  >
                    <i className="bi bi-house-check" aria-hidden="true" />
                    <span className="inv-catpro-action-label">DEFAULT/fallback</span>
                  </button>
                  <button
                    type="button"
                    className="inv-catpro-action edit inv-catpro-action-compact"
                    onClick={() => onProgramSeason?.(menu)}
                    disabled={!canUseBranch}
                    title="Programar temporada"
                  >
                    <i className="bi bi-calendar2-range" aria-hidden="true" />
                    <span className="inv-catpro-action-label">Temporada</span>
                  </button>
                  <button
                    type="button"
                    className="inv-catpro-action edit inv-catpro-action-compact"
                    onClick={() => onOpenEditMenu?.(menu)}
                    title="Editar menú"
                  >
                    <i className="bi bi-card-text" aria-hidden="true" />
                    <span className="inv-catpro-action-label">Editar</span>
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="inv-catpro-action state-off inv-catpro-action-compact menu-recetas-admin__state-action"
                      onClick={() => onDeleteMenu?.(menu)}
                      title="Eliminar"
                    >
                      <i className="bi bi-trash3" aria-hidden="true" />
                      <span className="inv-catpro-action-label">Eliminar</span>
                    </button>
                  ) : null}
                </footer>
              </article>
            );
          })}
        </div>
        </div>
      )}
    </section>
  );
};

export default MenuPublicationCards;
