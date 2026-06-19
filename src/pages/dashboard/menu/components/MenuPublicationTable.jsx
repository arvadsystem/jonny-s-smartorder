import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPageRangeLabel,
  buildVisiblePageNumbers
} from '../../personas/components/common/paginationWindow';

// AM: Tabla editable de visibilidad y override de precio por item.
const formatMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'L. --';
  return `L. ${parsed.toFixed(2)}`;
};

const TypeBadge = ({ tipoItem }) => {
  const type = String(tipoItem || '').toUpperCase();
  const className =
    type === 'RECETA'
      ? 'menu-pub-admin__type-badge is-receta'
      : type === 'COMBO'
      ? 'menu-pub-admin__type-badge is-combo'
      : 'menu-pub-admin__type-badge is-producto';

  return <span className={className}>{type || 'ITEM'}</span>;
};

const PAGE_SIZE = 10;

const MenuPublicationTable = ({
  items = [],
  loading = false,
  onToggleVisible,
  onToggleAllVisible,
  onChangePrecioPublico,
  onUseOriginalPriceForAll
}) => {
  const headerCheckboxRef = useRef(null);
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const typeOptions = useMemo(() => {
    const uniqueTypes = new Set(
      safeItems
        .map((row) => String(row?.tipo_item || '').trim().toUpperCase())
        .filter(Boolean)
    );
    return ['TODOS', ...Array.from(uniqueTypes).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [safeItems]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
    return safeItems.filter((row) => {
      const rowType = String(row?.tipo_item || '').trim().toUpperCase();
      const typeMatch = typeFilter === 'TODOS' ? true : rowType === typeFilter;
      if (!typeMatch) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        row?.nombre_item,
        row?.item_key,
        row?.id_item_origen,
        row?.tipo_item
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [safeItems, typeFilter, searchTerm]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredItems]);

  const activableItems = useMemo(
    () => paginatedItems.filter((row) => Boolean(row?.estado_item)),
    [paginatedItems]
  );
  const totalActivable = activableItems.length;
  const visibleActivable = activableItems.filter((row) => Boolean(row?.visible)).length;
  const allChecked = totalActivable > 0 && visibleActivable === totalActivable;
  const someChecked = visibleActivable > 0 && visibleActivable < totalActivable;
  const itemsWithPriceOverride = safeItems.filter(
    (row) => String(row?.precio_publico_input || '').trim() !== ''
  );
  const allUsingOriginalPrice = itemsWithPriceOverride.length === 0;
  const visiblePageNumbers = useMemo(() => buildVisiblePageNumbers(currentPage, totalPages), [currentPage, totalPages]);
  const pageWindowLabel = useMemo(
    () => buildPageRangeLabel({ page: currentPage, limit: PAGE_SIZE, total, currentLength: paginatedItems.length }),
    [currentPage, total, paginatedItems.length]
  );

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someChecked;
  }, [someChecked]);

  if (loading) {
    return (
      <div className="menu-pub-admin__table-shell">
        <div className="menu-pub-admin__table-toolbar">
          <div className="menu-pub-admin__table-toolbar-title">
            <i className="bi bi-filter-circle" aria-hidden="true" />
            <span>Filtrar publicaciones</span>
          </div>
        </div>
        <div className="menu-pub-admin__table-wrap">
          <div className="text-center py-5 fw-semibold text-muted">Cargando catalogo de publicacion...</div>
        </div>
      </div>
    );
  }

  if (safeItems.length === 0) {
    return (
      <div className="menu-pub-admin__table-shell">
        <div className="menu-pub-admin__table-toolbar">
          <div className="menu-pub-admin__table-toolbar-title">
            <i className="bi bi-filter-circle" aria-hidden="true" />
            <span>Filtrar publicaciones</span>
          </div>
          <div className="menu-pub-admin__filter-select-wrap">
            <label className="form-label mb-1">Tipo</label>
            <select className="form-select form-select-sm" value="TODOS" disabled>
              <option value="TODOS">Todos</option>
            </select>
          </div>
        </div>
        <div className="alert alert-warning mb-0">No hay items para publicar en esta sucursal.</div>
      </div>
    );
  }

  return (
    <div className="menu-pub-admin__table-shell">
      <div className="menu-pub-admin__table-toolbar">
        <div className="menu-pub-admin__table-toolbar-title">
          <i className="bi bi-filter-circle" aria-hidden="true" />
          <span>Filtrar publicaciones</span>
        </div>
        <div className="menu-pub-admin__toolbar-filters">
          <div className="menu-pub-admin__filter-search-wrap">
            <label htmlFor="menu-pub-filter-search" className="form-label mb-1">
              Buscar item
            </label>
            <div className="menu-pub-admin__search-input-wrap">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                id="menu-pub-filter-search"
                type="text"
                className="form-control form-control-sm"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setPage(1);
                }}
                placeholder="Nombre, ID o tipo..."
              />
            </div>
          </div>
          <div className="menu-pub-admin__filter-select-wrap">
            <label htmlFor="menu-pub-filter-tipo" className="form-label mb-1">
              Tipo
            </label>
            <select
              id="menu-pub-filter-tipo"
              className="form-select form-select-sm"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'TODOS' ? 'Todos los tipos' : option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-responsive menu-pub-admin__table-wrap">
        <table className="table table-sm align-middle mb-0 menu-pub-admin__table">
          <thead>
            <tr>
              <th>
                <div className="menu-pub-admin__column-head">
                  <span>Tipo</span>
                  <small>Clasificacion</small>
                </div>
              </th>
              <th>
                <div className="menu-pub-admin__column-head">
                  <span>Item</span>
                  <small>Nombre y seguimiento</small>
                </div>
              </th>
              <th className="text-center">
                <div className="menu-pub-admin__column-head menu-pub-admin__column-head--center">
                  <span>Estado</span>
                  <small>Condicion operativa</small>
                </div>
              </th>
              <th className="text-center">
                <div className="menu-pub-admin__column-head menu-pub-admin__column-head--center">
                  <div className="d-inline-flex align-items-center gap-2">
                    <span>Visible</span>
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      className="form-check-input"
                      checked={allChecked}
                      disabled={totalActivable === 0}
                      title="Seleccionar todos"
                      aria-label="Seleccionar todos los items visibles"
                      onChange={(event) => onToggleAllVisible?.(event.target.checked)}
                    />
                  </div>
                  <small>Controla lo que el cliente ve en la landing</small>
                </div>
              </th>
              <th>
                <div className="menu-pub-admin__column-head">
                  <div className="d-inline-flex align-items-center gap-2">
                    <span>Precio público personalizado</span>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allUsingOriginalPrice}
                    disabled={allUsingOriginalPrice}
                    title="Usar el precio original en todos los items"
                    aria-label="Usar precio original en todos los items"
                    onChange={(event) => {
                      if (event.target.checked) onUseOriginalPriceForAll?.();
                    }}
                    />
                  </div>
                  <small>Deja vacio para heredar el precio base</small>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="menu-pub-admin__empty-state">No se encontraron resultados para el tipo seleccionado.</div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((row) => {
                const isActive = Boolean(row?.estado_item);
                const basePrice = Number(row?.precio_base);
                const hasPriceOverride = String(row?.precio_publico_input || '').trim() !== '';
                return (
                  <tr key={row.item_key}>
                    <td>
                      <TypeBadge tipoItem={row.tipo_item} />
                    </td>
                    <td>
                      <div className="menu-pub-admin__item-cell">
                        <div className="menu-pub-admin__item-title">{row.nombre_item}</div>
                        <div className="menu-pub-admin__item-meta">
                          <span>ID #{row.id_item_origen}</span>
                          <span>{row.publicado ? 'En detalle_menu' : 'Pendiente de publicar'}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="menu-pub-admin__status-cell">
                        <span className={`menu-recetas-admin__estado-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                          {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className="menu-pub-admin__cell-note">
                          {isActive ? 'Listo para publicación.' : 'No se puede publicar mientras este inactivo.'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="menu-pub-admin__visibility-cell">
                        <div className="menu-pub-admin__visibility-toggle">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={Boolean(row.visible)}
                            disabled={!isActive}
                            title={isActive ? 'Cambiar visibilidad' : 'Item inactivo: no se puede publicar'}
                            aria-label={`Visibilidad ${row.nombre_item || row.item_key}`}
                            onChange={(event) => onToggleVisible?.(row.item_key, event.target.checked)}
                          />
                          <span
                            className={`menu-pub-admin__visibility-pill ${
                              row.visible ? 'is-visible' : 'is-hidden'
                            }`.trim()}
                          >
                            {row.visible ? 'Visible en landing' : 'Oculto al cliente'}
                          </span>
                        </div>
                        <span className="menu-pub-admin__cell-note">
                          {row.visible ? 'Se mostrará en el menú público.' : 'Actívalo para incluirlo en la landing.'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="menu-pub-admin__price-cell">
                        <div className="menu-pub-admin__price-summary">
                          <span className="menu-pub-admin__price-label">Precio heredado</span>
                          <strong>{formatMoney(basePrice)}</strong>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control form-control-sm menu-pub-admin__table-input"
                          value={row.precio_publico_input}
                          onChange={(event) => onChangePrecioPublico?.(row.item_key, event.target.value)}
                          placeholder="Opcional: usa el precio heredado"
                          disabled={!isActive}
                          aria-label={`Precio público personalizado de ${row.nombre_item || row.item_key}`}
                        />
                        {hasPriceOverride ? (
                          <span className="menu-pub-admin__price-state is-override">
                            Personalizado: <strong>{formatMoney(row.precio_publico_input)}</strong>
                          </span>
                        ) : (
                          <span className="menu-pub-admin__price-state is-inherited">Usando precio original</span>
                        )}
                        <span className="menu-pub-admin__cell-note">Deja el campo vacío para volver al precio base.</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="menu-pub-admin__table-footer inv-warehouse-moves__pagination inv-ins-pagination">
        <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">{`Mostrando ${pageWindowLabel} de ${total}`}</div>

        <div className="inv-warehouse-moves__pagination-controls">
          <button
            type="button"
            className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            aria-label="Pagina anterior"
          >
            <i className="bi bi-chevron-left" aria-hidden="true" />
            <span>Anterior</span>
          </button>

          <div className="inv-warehouse-moves__pagination-pages">
            {visiblePageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`inv-warehouse-moves__page-number ${pageNumber === currentPage ? 'is-active' : ''}`.trim()}
                onClick={() => setPage(pageNumber)}
                aria-label={`Ir a la pagina ${pageNumber}`}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">{`Pagina ${currentPage} de ${totalPages}`}</div>

          <button
            type="button"
            className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            aria-label="Pagina siguiente"
          >
            <span>Siguiente</span>
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuPublicationTable;
