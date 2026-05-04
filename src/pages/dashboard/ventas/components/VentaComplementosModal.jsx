import { useMemo, useState } from 'react';

const normalizeIds = (value) =>
  [...new Set(
    (Array.isArray(value) ? value : [])
      .map((entry) => Number(entry?.id_complemento ?? entry))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];

export default function VentaComplementosModal({
  open,
  mode = 'ADD',
  row = null,
  selected = [],
  error = '',
  onCancel,
  onConfirm
}) {
  const [current, setCurrent] = useState(() => normalizeIds(selected));
  const [localError, setLocalError] = useState('');

  const options = useMemo(
    () =>
      (Array.isArray(row?.complementos_disponibles) ? row.complementos_disponibles : [])
        .map((entry) => ({
          id_complemento: Number(entry?.id_complemento ?? 0) || null,
          nombre: String(entry?.nombre ?? 'Complemento').trim(),
          disponible: entry?.disponible !== false
        }))
        .filter((entry) => entry.id_complemento),
    [row]
  );

  const min = Number(row?.minimo_complementos ?? 0) || 0;
  const max = Number(row?.maximo_complementos ?? 0) || 0;
  const selectedCount = current.length;
  const canConfirm = min <= 0 || selectedCount >= min;

  if (!open || !row) return null;

  const toggleOption = (id) => {
    setLocalError('');
    setCurrent((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((entry) => entry !== id);
      if (max > 0 && prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (min > 0 && current.length < min) {
      setLocalError('Selecciona al menos 1 complemento.');
      return;
    }
    onConfirm?.(current);
  };

  return (
    <div className="ventas-modal-backdrop" onClick={onCancel}>
      <section
        className="ventas-modal ventas-complementos-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-list-check" />
            </span>
            <div>
              <h3>Seleccionar complementos</h3>
              <p>Elige las salsas para este producto.</p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onCancel} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-modal__body ventas-complementos-modal__body">
          <div className="ventas-complementos-modal__meta">
            <strong>{row?.nombre_item || row?.descripcion_item || 'Item'}</strong>
            <span>{row?.kind === 'COMBO' ? 'Combo' : 'Receta'}</span>
          </div>

          <div className="ventas-complementos-modal__hint">
            {min > 0 ? `Selecciona al menos ${min} complemento(s).` : 'Complementos opcionales.'}
            {max > 0 ? ` Máximo permitido: ${max}.` : ''}
          </div>

          <div className="ventas-complementos-modal__list">
            {options.length === 0 ? (
              <div className="ventas-complementos-modal__empty">No hay complementos disponibles.</div>
            ) : (
              options.map((option) => {
                const checked = current.includes(option.id_complemento);
                return (
                  <label key={option.id_complemento} className="ventas-complementos-modal__option">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!option.disponible}
                      onChange={() => toggleOption(option.id_complemento)}
                    />
                    <span>{option.nombre}</span>
                  </label>
                );
              })
            )}
          </div>

          {localError || error ? (
            <div className="ventas-create-modal__error">{localError || error}</div>
          ) : null}
        </div>

        <footer className="ventas-detail-modal__footer">
          <div className="ventas-detail-modal__footer-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn btn-warning" disabled={!canConfirm} onClick={handleConfirm}>
              {mode === 'EDIT' ? 'Guardar complementos' : 'Agregar al carrito'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
