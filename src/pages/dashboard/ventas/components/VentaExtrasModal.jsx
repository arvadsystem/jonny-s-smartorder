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
      stock_disponible: entry?.stock_disponible ?? null
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

  const maxQty = Math.max(1, Number(row?.cantidad || 1));
  const optionRows = useMemo(
    () =>
      (Array.isArray(options) ? options : [])
        .map((entry) => ({
          id_extra: Number(entry?.id_extra || 0),
          codigo: String(entry?.codigo || '').trim(),
          nombre: String(entry?.nombre || 'Extra').trim(),
          precio: Number(entry?.precio ?? entry?.precio_unitario ?? 0) || 0,
          id_insumo: Number(entry?.id_insumo || 0) || null,
          stock_disponible: entry?.stock_disponible ?? null
        }))
        .filter((entry) => entry.id_extra > 0),
    [options]
  );

  if (!open || !row) return null;

  const setQuantity = (option, nextQty) => {
    const quantity = Math.max(0, Math.min(maxQty, Number(nextQty || 0)));
    setCurrent((prev) => {
      const others = prev.filter((entry) => entry.id_extra !== option.id_extra);
      if (quantity <= 0) return others;
      return [...others, { ...option, cantidad: quantity }].sort((left, right) => left.id_extra - right.id_extra);
    });
  };

  const getSelectedQuantity = (idExtra) =>
    Number(current.find((entry) => entry.id_extra === idExtra)?.cantidad || 0);

  const subtotal = current.reduce((sum, entry) => sum + Number(entry.precio || 0) * Number(entry.cantidad || 0), 0);
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
            <span>Maximo x{maxQty} por extra</span>
            <small>Los extras son opcionales.</small>
          </div>

          {loading ? <div className="ventas-complementos-modal__empty">Cargando extras...</div> : null}
          {!loading && optionRows.length === 0 ? (
            <div className="ventas-complementos-modal__empty">No hay extras activos para este item.</div>
          ) : null}

          <div className="ventas-extras-modal__list">
            {optionRows.map((option) => {
              const qty = getSelectedQuantity(option.id_extra);
              return (
                <div className="ventas-extras-modal__card" key={option.id_extra}>
                  <div>
                    <strong>{option.nombre}</strong>
                    <span>{money(option.precio)}</span>
                  </div>
                  <div className="ventas-create-modal__qty-control">
                    <button type="button" onClick={() => setQuantity(option, qty - 1)} disabled={qty <= 0}>
                      <i className="bi bi-dash" />
                    </button>
                    <span>{qty}</span>
                    <button type="button" onClick={() => setQuantity(option, qty + 1)} disabled={qty >= maxQty}>
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
            <button type="button" className="btn btn-warning" onClick={() => onConfirm?.(current)}>
              Confirmar
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
