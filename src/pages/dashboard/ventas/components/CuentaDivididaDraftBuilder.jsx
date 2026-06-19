import { useMemo } from 'react';

const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const resolveItemId = (item) => Number(item?.id_detalle_pedido ?? 0) || null;

const fallbackCurrency = (value) =>
  new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    minimumFractionDigits: 2
  }).format(Number(value || 0));

export default function CuentaDivididaDraftBuilder({
  enabled,
  onEnabledChange,
  divisions = [],
  items = [],
  selectedDivisionId,
  onSelectedDivisionChange,
  onAddDivision,
  onUpdateDivisionLabel,
  onAssignItem,
  onUnassignItem,
  loadingItems = false,
  disabled = false,
  formatCurrency = fallbackCurrency,
  toggleLabel = 'Dividir cuenta',
  labelOffset = 0
}) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeDivisions = Array.isArray(divisions) ? divisions : [];

  const itemById = useMemo(() => {
    const map = new Map();
    safeItems.forEach((item) => {
      const id = resolveItemId(item);
      if (id) map.set(id, item);
    });
    return map;
  }, [safeItems]);

  const itemOrderById = useMemo(() => {
    const map = new Map();
    safeItems.forEach((item, index) => {
      const id = resolveItemId(item);
      if (id) map.set(id, index + 1);
    });
    return map;
  }, [safeItems]);

  const assignedDivisionByItemId = useMemo(() => {
    const map = new Map();
    safeDivisions.forEach((division) => {
      (Array.isArray(division.itemIds) ? division.itemIds : []).forEach((idDetallePedido) => {
        if (itemById.has(idDetallePedido)) map.set(idDetallePedido, division.id);
      });
    });
    return map;
  }, [itemById, safeDivisions]);

  const availableItems = useMemo(
    () => safeItems.filter((item) => !assignedDivisionByItemId.has(resolveItemId(item))),
    [assignedDivisionByItemId, safeItems]
  );

  const selectedDivision = safeDivisions.find((division) => division.id === selectedDivisionId) || safeDivisions[0] || null;
  const assignedCount = Math.max(safeItems.length - availableItems.length, 0);

  const divisionSummaries = useMemo(
    () => safeDivisions.map((division) => {
      const selectedItems = (Array.isArray(division.itemIds) ? division.itemIds : [])
        .map((idDetallePedido) => itemById.get(idDetallePedido))
        .filter(Boolean);
      const total = selectedItems.reduce((sum, item) => roundMoney(sum + Number(item.total_linea || 0)), 0);
      return { division, selectedItems, total };
    }),
    [itemById, safeDivisions]
  );

  const handleSelectDivision = (divisionId) => {
    onSelectedDivisionChange?.(divisionId);
  };

  const getDivisionSequenceLabel = (divisionId) => {
    const index = safeDivisions.findIndex((division) => division.id === divisionId);
    return index >= 0 ? `Persona ${labelOffset + index + 1}` : 'persona';
  };

  return (
    <div className="ventas-registrar-pago-modal__split-draft ventas-cuenta-dividida">
      <label className="ventas-cuenta-dividida__toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange?.(event.target.checked)}
          disabled={loadingItems || disabled}
        />
        <span>{toggleLabel}</span>
      </label>

      {enabled ? (
        <>
          <div className="ventas-cuenta-dividida__toolbar">
            <span>Asignado: {assignedCount}/{safeItems.length}</span>
            <strong>{loadingItems ? 'Cargando lineas...' : `Sin asignar: ${availableItems.length}`}</strong>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onAddDivision}
              disabled={disabled || loadingItems}
            >
              <i className="bi bi-person-plus" /> Agregar persona
            </button>
          </div>

          <div className="ventas-cuenta-dividida-builder">
            <section className="ventas-cuenta-dividida-builder__available" aria-label="Items disponibles">
              <header className="ventas-cuenta-dividida-builder__section-head">
                <div>
                  <span>Items disponibles</span>
                  <strong>{availableItems.length}</strong>
                </div>
                <small>{selectedDivision ? `Agregar a ${getDivisionSequenceLabel(selectedDivision.id)}` : 'Sin persona activa'}</small>
              </header>

              <div className="ventas-cuenta-dividida-builder__available-list">
                {loadingItems ? (
                  <div className="ventas-cuenta-dividida-builder__empty">
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Cargando lineas...
                  </div>
                ) : availableItems.length > 0 ? (
                  availableItems.map((item) => {
                    const idDetallePedido = resolveItemId(item);
                    return (
                      <button
                        key={idDetallePedido}
                        type="button"
                        className="ventas-cuenta-dividida-builder__available-item"
                        onClick={() => {
                          if (!selectedDivision?.id || !idDetallePedido) return;
                          onAssignItem?.(idDetallePedido, selectedDivision.id);
                        }}
                        disabled={disabled || !selectedDivision}
                      >
                        <span>
                          <small>{itemOrderById.get(idDetallePedido)}.</small>
                          {item.nombre_item}
                        </span>
                        <strong>{formatCurrency(item.total_linea)}</strong>
                        <i className="bi bi-plus-lg" aria-hidden="true" />
                      </button>
                    );
                  })
                ) : (
                  <div className="ventas-cuenta-dividida-builder__empty">Todas las lineas estan asignadas.</div>
                )}
              </div>
            </section>

            <section className="ventas-cuenta-dividida-builder__people" aria-label="Personas de la cuenta dividida">
              {divisionSummaries.map(({ division, selectedItems, total }, divisionIndex) => {
                const isSelected = selectedDivision?.id === division.id;
                const sequenceLabel = `Persona ${labelOffset + divisionIndex + 1}`;
                return (
                  <article
                    key={division.id}
                    className={`ventas-cuenta-dividida-builder__person ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="ventas-cuenta-dividida-builder__person-head">
                      <div className="ventas-cuenta-dividida-builder__person-label">
                        <span>Persona</span>
                        <strong>{sequenceLabel}</strong>
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleSelectDivision(division.id)}
                        disabled={disabled}
                        aria-pressed={isSelected}
                      >
                        {isSelected ? 'Persona activa' : 'Seleccionar'}
                      </button>
                    </div>

                    <div className="ventas-cuenta-dividida-builder__assigned-list">
                      {selectedItems.length > 0 ? (
                        selectedItems.map((item) => {
                          const idDetallePedido = resolveItemId(item);
                          return (
                            <div key={`${division.id}-${idDetallePedido}`} className="ventas-cuenta-dividida-builder__assigned-item">
                              <span>
                                <small>{itemOrderById.get(idDetallePedido)}.</small>
                                {item.nombre_item}
                              </span>
                              <strong>{formatCurrency(item.total_linea)}</strong>
                              <button
                                type="button"
                                onClick={() => onUnassignItem?.(idDetallePedido)}
                                disabled={disabled}
                                title="Quitar linea"
                                aria-label={`Quitar ${item.nombre_item}`}
                              >
                                <i className="bi bi-x-lg" aria-hidden="true" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="ventas-cuenta-dividida-builder__empty is-compact">Sin lineas asignadas.</div>
                      )}
                    </div>

                    <div className="ventas-cuenta-dividida-builder__person-total">
                      <span>{selectedItems.length} lineas</span>
                      <strong>{formatCurrency(total)}</strong>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
