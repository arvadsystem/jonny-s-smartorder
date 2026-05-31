import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildPageRangeLabel,
  buildVisiblePageNumbers
} from '../../personas/components/common/paginationWindow';

// Tabla editable de visibilidad, precio publico y orden por item.
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
  onChangeOrden
}) => {
  const headerCheckboxRef = useRef(null);
  const [typeFilter, setTypeFilter] = useState('TODOS');
  const [page, setPage] = useState(1);

  const safeItems = Array.isArray(items) ? items : [];
  const typeOptions = useMemo(() => {
    const uniqueTypes = new Set(
      safeItems
        .map((row) => String(row?.tipo_item || '').trim().toUpperCase())
        .filter(Boolean)
    );
    return ['TODOS', ...Array.from(uniqueTypes).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [safeItems]);

  const filteredItems = useMemo(() => {
    if (typeFilter === 'TODOS') return safeItems;
    return safeItems.filter((row) => String(row?.tipo_item || '').trim().toUpperCase() === typeFilter);
  }, [safeItems, typeFilter]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const activableItems = useMemo(
    () => paginatedItems.filter((row) => Boolean(row?.estado_item)),
    [paginatedItems]
  );
  const totalActivable = activableItems.length;
  const visibleActivable = activableItems.filter((row) => Boolean(row?.visible)).length;
  const allChecked = totalActivable > 0 && visibleActivable === totalActivable;
  const someChecked = visibleActivable > 0 && visibleActivable < totalActivable;
  const visiblePageNumbers = useMemo(() => buildVisiblePageNumbers(page, totalPages), [page, totalPages]);
  const pageWindowLabel = useMemo(
    () => buildPageRangeLabel({ page, limit: PAGE_SIZE, total, currentLength: paginatedItems.length }),
    [page, total, paginatedItems.length]
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
        <div className="menu-pub-admin__filter-select-wrap">
          <label htmlFor="menu-pub-filter-tipo" className="form-label mb-1">
            Tipo
          </label>
          <select
            id="menu-pub-filter-tipo"
            className="form-select form-select-sm"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'TODOS' ? 'Todos los tipos' : option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-responsive menu-pub-admin__table-wrap">
        <table className="table table-sm align-middle mb-0 menu-pub-admin__table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Item</th>
              <th>Estado</th>
              <th className="text-center">
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
              </th>
              <th>Precio publico</th>
              <th>Orden</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="menu-pub-admin__empty-state">No se encontraron resultados para el tipo seleccionado.</div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((row) => {
                const isActive = Boolean(row?.estado_item);
                const basePrice = Number(row?.precio_base);
                return (
                  <tr key={row.item_key}>
                    <td>
                      <TypeBadge tipoItem={row.tipo_item} />
                    </td>
                    <td>
                      <div className="fw-semibold">{row.nombre_item}</div>
                      <div className="small text-muted">
                        #{row.id_item_origen} - Base: {formatMoney(basePrice)}
                      </div>
                    </td>
                    <td>
                      <span className={`menu-recetas-admin__estado-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                        {isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={Boolean(row.visible)}
                        disabled={!isActive}
                        title={isActive ? 'Cambiar visibilidad' : 'Item inactivo: no se puede publicar'}
                        aria-label={`Visibilidad ${row.nombre_item || row.item_key}`}
                        onChange={(event) => onToggleVisible?.(row.item_key, event.target.checked)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-control form-control-sm menu-pub-admin__table-input"
                        value={row.precio_publico_input}
                        onChange={(event) => onChangePrecioPublico?.(row.item_key, event.target.value)}
                        placeholder={Number.isFinite(basePrice) ? String(basePrice) : 'Sin precio'}
                        disabled={!isActive}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control form-control-sm menu-pub-admin__table-input"
                        value={row.orden_input}
                        onChange={(event) => onChangeOrden?.(row.item_key, event.target.value)}
                        disabled={!row.visible || !isActive}
                      />
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
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
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
                className={`inv-warehouse-moves__page-number ${pageNumber === page ? 'is-active' : ''}`.trim()}
                onClick={() => setPage(pageNumber)}
                aria-label={`Ir a la pagina ${pageNumber}`}
                aria-current={pageNumber === page ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">{`Pagina ${page} de ${totalPages}`}</div>

          <button
            type="button"
            className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages}
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
