import { useMemo } from 'react';
import { normalizePositiveIdList } from '../utils/warehouseAssignmentUtils';

const WarehouseAssignmentPicker = ({
  selectedValues = [],
  almacenes = [],
  loading = false,
  search = '',
  onSearchChange,
  onChange,
  errorMessage = ''
}) => {
  const activeAlmacenes = useMemo(() => (
    (Array.isArray(almacenes) ? almacenes : []).filter((almacen) => {
      const idAlmacen = Number.parseInt(String(almacen?.id_almacen ?? ''), 10);
      const active = almacen?.estado === undefined
        || almacen?.estado === null
        || almacen?.estado === ''
        || almacen?.estado === true
        || almacen?.estado === 'true'
        || almacen?.estado === 1
        || almacen?.estado === '1';
      return Number.isInteger(idAlmacen) && idAlmacen > 0 && active;
    })
  ), [almacenes]);

  const groupedAlmacenes = useMemo(() => {
    const grouped = activeAlmacenes.reduce((acc, almacen) => {
      const idSucursal = String(almacen?.id_sucursal ?? 'sin-sucursal');
      const nombreSucursal = String(
        almacen?.nombre_sucursal || (idSucursal === 'sin-sucursal' ? 'Sucursal sin asignar' : `Sucursal #${idSucursal}`)
      );
      if (!acc.has(idSucursal)) acc.set(idSucursal, { idSucursal, nombreSucursal, items: [] });
      acc.get(idSucursal).items.push(almacen);
      return acc;
    }, new Map());

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort((left, right) => String(left?.nombre_almacen || '').localeCompare(String(right?.nombre_almacen || ''), 'es'))
      }))
      .sort((left, right) => left.nombreSucursal.localeCompare(right.nombreSucursal, 'es'));
  }, [activeAlmacenes]);

  const filteredAlmacenGroups = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    if (!term) return groupedAlmacenes;

    return groupedAlmacenes
      .map((group) => ({
        ...group,
        items: group.items.filter((almacen) => (
          String(group.nombreSucursal || '').toLowerCase().includes(term)
          || String(almacen?.nombre_almacen || '').toLowerCase().includes(term)
        ))
      }))
      .filter((group) => group.items.length > 0);
  }, [groupedAlmacenes, search]);

  const activeAlmacenesById = useMemo(() => {
    const map = new Map();
    activeAlmacenes.forEach((almacen) => {
      const idAlmacen = Number.parseInt(String(almacen?.id_almacen ?? ''), 10);
      if (Number.isInteger(idAlmacen) && idAlmacen > 0) {
        map.set(idAlmacen, almacen);
      }
    });
    return map;
  }, [activeAlmacenes]);

  const selectedIds = useMemo(
    () => new Set(normalizePositiveIdList(selectedValues)),
    [selectedValues]
  );

  const selectedRows = useMemo(
    () => [...selectedIds].map((idAlmacen) => activeAlmacenesById.get(idAlmacen)).filter(Boolean),
    [activeAlmacenesById, selectedIds]
  );

  const canSelectAll = groupedAlmacenes.length > 0 && groupedAlmacenes.every((group) => group.items.length === 1);
  const visibleChips = selectedRows.slice(0, 3);
  const hiddenChipCount = Math.max(0, selectedRows.length - visibleChips.length);

  const updateSelection = (ids) => onChange?.(normalizePositiveIdList(ids));

  const toggleWarehouse = (almacen) => {
    const idAlmacen = Number.parseInt(String(almacen?.id_almacen ?? ''), 10);
    if (!Number.isInteger(idAlmacen) || idAlmacen <= 0) return;

    const idSucursal = String(almacen?.id_sucursal ?? 'sin-sucursal');
    const current = activeAlmacenes
      .filter((item) => {
        const itemId = Number.parseInt(String(item?.id_almacen ?? ''), 10);
        if (!selectedIds.has(itemId) || itemId === idAlmacen) return false;
        return String(item?.id_sucursal ?? 'sin-sucursal') !== idSucursal;
      })
      .map((item) => Number.parseInt(String(item.id_almacen), 10));

    if (!selectedIds.has(idAlmacen)) current.push(idAlmacen);
    updateSelection(current);
  };

  return (
    <div className={`menu-extras-admin__warehouse-picker ${errorMessage ? 'is-invalid' : ''}`}>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <div className="form-text m-0">Selecciona las sucursales donde se venderá. Cada sucursal usa su almacén activo.</div>
        <span className="menu-extras-admin__warehouse-counter">
          {selectedIds.size} {selectedIds.size === 1 ? 'seleccionado' : 'seleccionados'}
        </span>
      </div>

      <div className="menu-extras-admin__warehouse-search mb-2">
        <i className="bi bi-search" />
        <input
          type="search"
          className="form-control"
          value={search}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder="Buscar sucursal o almacén..."
          disabled={loading || activeAlmacenes.length === 0}
        />
      </div>

      {selectedRows.length > 0 ? (
        <div className="menu-extras-admin__warehouse-chips mb-2">
          {visibleChips.map((almacen) => {
            const idAlmacen = Number.parseInt(String(almacen?.id_almacen ?? ''), 10);
            return (
              <button
                key={idAlmacen}
                type="button"
                className="menu-extras-admin__warehouse-chip"
                onClick={() => updateSelection([...selectedIds].filter((id) => id !== idAlmacen))}
              >
                <span>{String(almacen?.nombre_sucursal || `Sucursal #${almacen?.id_sucursal || ''}`)}</span>
                <i className="bi bi-x-lg" />
              </button>
            );
          })}
          {hiddenChipCount > 0 ? <span className="menu-extras-admin__warehouse-chip-more">+{hiddenChipCount} más</span> : null}
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          className={`btn btn-sm ${canSelectAll ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
          onClick={() => updateSelection(groupedAlmacenes.map((group) => Number.parseInt(String(group.items[0].id_almacen), 10)))}
          disabled={loading || !canSelectAll}
        >
          Todas las sucursales
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => updateSelection([])}
          disabled={loading || selectedIds.size === 0}
        >
          Limpiar
        </button>
      </div>

      {!canSelectAll && filteredAlmacenGroups.length > 0 ? (
        <div className="form-text text-muted mb-2">Hay sucursales con varios almacenes. Selecciona manualmente un almacén para esas sucursales.</div>
      ) : null}

      <div className="menu-extras-admin__warehouse-list">
        {loading ? <div className="menu-extras-admin__warehouse-empty">Cargando almacenes...</div> : null}
        {!loading && activeAlmacenes.length === 0 ? (
          <div className="menu-extras-admin__warehouse-empty is-danger">No hay almacenes activos disponibles para asignar.</div>
        ) : null}
        {!loading && activeAlmacenes.length > 0 && filteredAlmacenGroups.length === 0 ? (
          <div className="menu-extras-admin__warehouse-empty">No se encontraron sucursales o almacenes.</div>
        ) : null}
        {!loading && filteredAlmacenGroups.map((group) => (
          group.items.map((almacen) => {
            const idAlmacen = Number.parseInt(String(almacen?.id_almacen ?? ''), 10);
            const checked = selectedIds.has(idAlmacen);
            const almacenName = String(almacen?.nombre_almacen || `Almacén #${idAlmacen}`);
            return (
              <label
                key={idAlmacen}
                className={`menu-extras-admin__warehouse-row ${checked ? 'is-selected' : ''}`}
              >
                <input
                  className="menu-extras-admin__warehouse-checkbox"
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleWarehouse(almacen)}
                />
                <span className="menu-extras-admin__warehouse-copy">
                  <strong>{group.nombreSucursal}</strong>
                  <small>{almacenName}</small>
                </span>
              </label>
            );
          })
        ))}
      </div>

      {errorMessage ? <div className="invalid-feedback d-block">{errorMessage}</div> : null}
    </div>
  );
};

export default WarehouseAssignmentPicker;
