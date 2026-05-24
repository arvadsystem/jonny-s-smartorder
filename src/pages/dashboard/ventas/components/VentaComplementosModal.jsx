import { useEffect, useMemo, useState } from 'react';

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
  const [confirmSkip, setConfirmSkip] = useState(false);

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
  const missingCount = Math.max(min - selectedCount, 0);

  useEffect(() => {
    if (!open) {
      setConfirmSkip(false);
      setLocalError('');
      return;
    }
    setCurrent(normalizeIds(selected));
  }, [open, row?.cartKey, row?.id_combo, row?.id_receta, selected]);

  if (!open || !row) return null;

  const toggleOption = (id) => {
    setLocalError('');
    setConfirmSkip(false);
    setCurrent((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((entry) => entry !== id);
      if (max > 0 && prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (min > 0 && current.length < min) {
      setConfirmSkip(true);
      return;
    }
    onConfirm?.(current);
  };

  const handleConfirmAnyway = () => {
    setConfirmSkip(false);
    onConfirm?.(current);
  };

  return (
    <div className="ventas-modal-backdrop ventas-complementos-backdrop" onClick={onCancel}>
      <section
        className="ventas-modal ventas-complementos-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-complementos-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header ventas-complementos-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-list-check" />
            </span>
            <div>
              <h3 id="ventas-complementos-title">Seleccionar complementos</h3>
              <p>Elige las salsas para este producto.</p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onCancel} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-modal__body ventas-complementos-modal__body">
          <div className="ventas-complementos-modal__meta">
            <div>
              <span>Item</span>
              <strong>{row?.nombre_item || row?.descripcion_item || 'Item'}</strong>
            </div>
            <span className="ventas-complementos-modal__type">{row?.kind === 'COMBO' ? 'Combo' : 'Receta'}</span>
          </div>

          <div className="ventas-complementos-modal__hint">
            <span>{selectedCount} seleccionado(s){max > 0 ? ` de ${max}` : ''}</span>
            <small>
              {min > 0
                ? `Recomendado: ${min}. Puedes continuar con menos si el cliente lo solicita.`
                : 'Complementos opcionales.'}
            </small>
          </div>

          <div className="ventas-complementos-modal__list">
            {options.length === 0 ? (
              <div className="ventas-complementos-modal__empty">No hay complementos disponibles.</div>
            ) : (
              options.map((option) => {
                const checked = current.includes(option.id_complemento);
                return (
                  <label
                    key={option.id_complemento}
                    className={[
                      'ventas-complementos-modal__option',
                      checked ? 'is-selected' : '',
                      !option.disponible ? 'is-disabled' : ''
                    ].filter(Boolean).join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!option.disponible}
                      onChange={() => toggleOption(option.id_complemento)}
                    />
                    <span>{option.nombre}</span>
                    {checked ? <i className="bi bi-check2" aria-hidden="true" /> : null}
                  </label>
                );
              })
            )}
          </div>

          {localError || error ? (
            <div className="ventas-create-modal__error">{localError || error}</div>
          ) : null}

          {confirmSkip ? (
            <div
              className="ventas-complementos-modal__confirm-layer"
              role="presentation"
              onClick={() => setConfirmSkip(false)}
            >
              <section
                className="ventas-complementos-modal__confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="ventas-complementos-confirm-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="ventas-complementos-modal__confirm-icon">
                  <i className="bi bi-exclamation-circle" />
                </div>
                <div>
                  <h4 id="ventas-complementos-confirm-title">
                    {selectedCount === 0 ? 'Agregar sin complementos' : 'Faltan complementos'}
                  </h4>
                  <p>
                    {selectedCount === 0
                      ? 'El cliente no selecciono complementos. Puedes agregarlo al carrito sin salsas.'
                      : `Falta${missingCount === 1 ? '' : 'n'} ${missingCount} complemento(s) para llegar a la cantidad recomendada. Puedes continuar con los seleccionados.`}
                  </p>
                </div>
                <div className="ventas-complementos-modal__confirm-actions">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmSkip(false)}>
                    Seguir eligiendo
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleConfirmAnyway}>
                    Agregar de todos modos
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="ventas-detail-modal__footer ventas-complementos-modal__footer">
          <div className="ventas-detail-modal__footer-actions ventas-complementos-modal__footer-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn btn-warning" onClick={handleConfirm}>
              {mode === 'EDIT' ? 'Guardar complementos' : 'Agregar al carrito'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
