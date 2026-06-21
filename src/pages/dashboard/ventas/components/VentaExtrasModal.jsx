import { useEffect, useMemo, useState } from 'react';

const normalizeSelected = (value) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => ({
      id_extra: Number(entry?.id_extra ?? 0),
      cantidad: Number(entry?.cantidad ?? 0),
      codigo: String(entry?.codigo || '').trim(),
      nombre: String(entry?.nombre || 'Extra').trim(),
      precio: Number(entry?.precio ?? entry?.precio_unitario ?? 0) || 0,
      id_insumo: Number(entry?.id_insumo ?? 0) || null,
      id_insumo_maestro: Number(entry?.id_insumo_maestro ?? 0) || null,
      stock_disponible: entry?.stock_disponible ?? null,
      cantidad_consumo_base: entry?.cantidad_consumo_base ?? null,
      id_unidad_base: Number(entry?.id_unidad_base ?? 0) || null,
      disponible: entry?.disponible !== false,
      inventario_configurado: entry?.inventario_configurado !== false,
      motivo_no_disponible: String(entry?.motivo_no_disponible || '').trim() || null,
      codigo_no_disponible: String(entry?.codigo_no_disponible || '').trim() || null
    }))
    .filter((entry) => Number.isInteger(entry.id_extra) && entry.id_extra > 0 && Number.isInteger(entry.cantidad) && entry.cantidad > 0);

export default function VentaExtrasModal({
  open,
  row = null,
  options = [],
  selected = [],
  loading = false,
  error = '',
  formatCurrency,
  onCancel,
  onConfirm
}) {
  const [current, setCurrent] = useState(() => normalizeSelected(selected));

  useEffect(() => {
    if (!open) return;
    setCurrent(normalizeSelected(selected));
  }, [open, row?.cartKey, selected]);

  const optionRows = useMemo(
    () =>
      (Array.isArray(options) ? options : [])
        .map((entry) => ({
          id_extra: Number(entry?.id_extra || 0),
          codigo: String(entry?.codigo || '').trim(),
          nombre: String(entry?.nombre || 'Extra').trim(),
          precio: Number(entry?.precio ?? entry?.precio_unitario ?? 0) || 0,
          id_insumo: Number(entry?.id_insumo || 0) || null,
          id_insumo_maestro: Number(entry?.id_insumo_maestro || 0) || null,
          stock_disponible: entry?.stock_disponible ?? null,
          cantidad_consumo_base: entry?.cantidad_consumo_base ?? null,
          id_unidad_base: Number(entry?.id_unidad_base || 0) || null,
          disponible: entry?.disponible !== false,
          inventario_configurado: entry?.inventario_configurado !== false,
          motivo_no_disponible: String(entry?.motivo_no_disponible || '').trim() || null,
          codigo_no_disponible: String(entry?.codigo_no_disponible || '').trim() || null
        }))
        .filter((entry) => entry.id_extra > 0),
    [options]
  );

  if (!open || !row) return null;

  const setQuantity = (option, nextQty) => {
    const numeric = Number(nextQty || 0);
    const quantity = Number.isSafeInteger(numeric) ? Math.max(0, numeric) : 0;
    setCurrent((prev) => {
      const currentQuantity = Number(prev.find((entry) => entry.id_extra === option.id_extra)?.cantidad || 0);
      if (option.disponible !== true && quantity > currentQuantity) return prev;
      const others = prev.filter((entry) => entry.id_extra !== option.id_extra);
      if (quantity <= 0) return others;
      return [...others, { ...option, cantidad: quantity }].sort((left, right) => left.id_extra - right.id_extra);
    });
  };

  const getSelectedQuantity = (idExtra) =>
    Number(current.find((entry) => entry.id_extra === idExtra)?.cantidad || 0);

  const subtotal = current.reduce((sum, entry) => sum + Number(entry.precio || 0) * Number(entry.cantidad || 0), 0);
  const optionById = new Map(optionRows.map((option) => [option.id_extra, option]));
  const hasUnavailableSelection = current.some((entry) => optionById.get(entry.id_extra)?.disponible !== true);
  const money = typeof formatCurrency === 'function'
    ? formatCurrency
    : (value) => `L. ${Number(value || 0).toFixed(2)}`;

  return (
    <div className="ventas-modal-backdrop ventas-complementos-backdrop" onClick={onCancel}>
      <section
        className="ventas-modal ventas-complementos-modal ventas-extras-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-extras-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header ventas-complementos-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-plus-square" />
            </span>
            <div>
              <h3 id="ventas-extras-title">Extras</h3>
              <p>{row.nombre_item || 'Item'}</p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onCancel} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-modal__body ventas-complementos-modal__body">
          <div className="ventas-complementos-modal__hint">
            <span>Selecciona la cantidad de extras</span>
            <small>Los extras son opcionales.</small>
          </div>

          {loading ? <div className="ventas-complementos-modal__empty">Cargando extras...</div> : null}
          {!loading && optionRows.length === 0 ? (
            <div className="ventas-complementos-modal__empty">No hay extras activos para este item.</div>
          ) : null}

          <div className="ventas-extras-modal__list">
            {optionRows.map((option) => {
              const qty = getSelectedQuantity(option.id_extra);
              const unavailable = option.disponible !== true;
              const soldOut = option.codigo_no_disponible === 'EXTRA_STOCK_INSUFICIENTE';
              return (
                <div
                  className={`ventas-extras-modal__card${unavailable ? ' is-unavailable' : ''}`}
                  key={option.id_extra}
                  data-testid="ventas-extra-option"
                >
                  <div>
                    <strong>{option.nombre}</strong>
                    <span>{money(option.precio)}</span>
                    {unavailable ? (
                      <small>No disponible: {option.motivo_no_disponible || 'Este extra no esta disponible.'}</small>
                    ) : null}
                  </div>
                  {unavailable ? (
                    <span className="badge text-bg-light border">
                      {soldOut ? 'Agotado' : 'Configuracion pendiente'}
                    </span>
                  ) : null}
                  <div className="ventas-create-modal__qty-control">
                    <button type="button" data-testid="ventas-extra-decrement" onClick={() => setQuantity(option, qty - 1)} disabled={qty <= 0}>
                      <i className="bi bi-dash" />
                    </button>
                    <span>{qty}</span>
                    <button type="button" data-testid="ventas-extra-increment" onClick={() => setQuantity(option, qty + 1)} disabled={unavailable}>
                      <i className="bi bi-plus-lg" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error ? <div className="ventas-create-modal__error">{error}</div> : null}
        </div>

        <footer className="ventas-detail-modal__footer ventas-complementos-modal__footer ventas-extras-modal__footer">
          <strong>Extras seleccionados: {money(subtotal)}</strong>
          <div className="ventas-detail-modal__footer-actions ventas-complementos-modal__footer-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn btn-warning" data-testid="ventas-extras-confirmar" onClick={() => onConfirm?.(current)} disabled={hasUnavailableSelection}>
              Confirmar
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
