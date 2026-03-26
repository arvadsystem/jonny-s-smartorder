import { useEffect, useMemo, useState } from 'react';
import {
  calculateRequiredSauces,
  getItemAllowedSauces,
  getItemExtraOptions
} from '../../utils/publicMenuItemConfig';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const sumSauceCount = (rawMap = {}) =>
  Object.values(rawMap).reduce((sum, value) => sum + Number(value || 0), 0);

// Hoja de configuracion para items con extras o salsas requeridas.
const ProductDetailSheet = ({ open, item, loading, error, onClose, onRetry, onAdd }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedExtraIds, setSelectedExtraIds] = useState([]);
  const [sauceCounts, setSauceCounts] = useState({});
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setSelectedExtraIds([]);
    setSauceCounts({});
    setValidationError('');
  }, [open, item?.id_detalle_menu]);

  const extraOptions = useMemo(() => getItemExtraOptions(item), [item]);
  const allowedSauces = useMemo(() => getItemAllowedSauces(item), [item]);
  const selectedExtras = useMemo(() => {
    const selectedIdSet = new Set(selectedExtraIds);
    return extraOptions.filter((extra) => selectedIdSet.has(extra.id_extra));
  }, [extraOptions, selectedExtraIds]);
  const extraAmountPerUnit = selectedExtras.reduce(
    (sum, extra) => sum + Number(extra?.precio_adicional || 0),
    0
  );

  const unitBase = Number(item?.precio?.final || 0);
  const unitPrice = Number((unitBase + extraAmountPerUnit).toFixed(2));
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const requiresSauceSelection = item?.salsas_requiere_seleccion === true;
  const requiredSauceCount = calculateRequiredSauces(item, quantity);
  const selectedSauceCount = sumSauceCount(sauceCounts);
  const canIncreaseSauce = requiredSauceCount <= 0 || selectedSauceCount < requiredSauceCount;

  if (!open) return null;

  const toggleExtra = (extraId) => {
    setValidationError('');
    setSelectedExtraIds((current) => (
      current.includes(extraId)
        ? current.filter((id) => id !== extraId)
        : [...current, extraId]
    ));
  };

  const changeSauceCount = (idSalsa, delta) => {
    setValidationError('');
    setSauceCounts((current) => {
      const currentValue = Number(current?.[idSalsa] || 0);
      const nextValue = Math.max(0, currentValue + delta);
      const currentTotal = sumSauceCount(current);

      if (delta > 0 && requiredSauceCount > 0 && currentTotal >= requiredSauceCount) {
        return current;
      }

      return {
        ...current,
        [idSalsa]: nextValue
      };
    });
  };

  const handleAdd = () => {
    if (!item?.disponibilidad?.available) return;

    if (requiresSauceSelection && requiredSauceCount > 0 && allowedSauces.length === 0) {
      setValidationError('Este item requiere salsas, pero no tiene salsas configuradas.');
      return;
    }

    if (requiresSauceSelection && requiredSauceCount > 0 && selectedSauceCount !== requiredSauceCount) {
      setValidationError(`Debes seleccionar exactamente ${requiredSauceCount} salsa(s).`);
      return;
    }

    const salsasPorUnidad = allowedSauces
      .map((sauce) => ({
        id_salsa: Number(sauce?.id_salsa || 0),
        nombre: String(sauce?.nombre || 'Salsa'),
        cantidad: Number(sauceCounts?.[sauce.id_salsa] || 0)
      }))
      .filter((sauce) => sauce.id_salsa > 0 && sauce.cantidad > 0);

    onAdd?.(item, {
      cantidad: toPositiveInt(quantity, 1),
      extras: selectedExtras.map((extra) => ({
        id_extra: extra.id_extra,
        codigo: extra.codigo,
        nombre: extra.nombre,
        precio_adicional: Number(extra.precio_adicional || 0)
      })),
      salsasPorUnidad
    });
  };

  return (
    <div className="pm-detail-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className="pm-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-detail-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pm-detail-sheet__header">
          <h2 id="pm-detail-sheet-title" className="pm-detail-sheet__title">
            Configurar item
          </h2>

          <button
            type="button"
            className="pm-detail-sheet__close"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        {loading ? <p className="pm-detail-sheet__state">Cargando detalle...</p> : null}

        {!loading && error ? (
          <div className="pm-detail-sheet__state pm-detail-sheet__state--error">
            <p>{error}</p>
            {typeof onRetry === 'function' ? (
              <button type="button" className="btn btn-outline-dark btn-sm" onClick={onRetry}>
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && item ? (
          <>
            {item.imagen_url ? (
              <img
                src={item.imagen_url}
                alt={item.nombre}
                className="pm-detail-sheet__image"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : null}

            <p className="pm-detail-sheet__category">{item.categoria.nombre}</p>
            <h3 className="pm-detail-sheet__name">{item.nombre}</h3>
            <p className="pm-detail-sheet__description">{item.descripcion}</p>

            <div className="pm-detail-sheet__price-wrap">
              <span className="pm-detail-sheet__price-label">Precio unitario</span>
              <strong className="pm-detail-sheet__price-value">
                {item.precio.final === null || item.precio.final === undefined
                  ? 'Precio pendiente'
                  : currencyFormatter.format(unitPrice)}
              </strong>
            </div>

            <div
              className={`pm-detail-sheet__availability ${
                item.disponibilidad.available ? 'is-available' : 'is-unavailable'
              }`}
            >
              {item.disponibilidad.available
                ? 'Disponible para pedido'
                : item.disponibilidad.message || 'No disponible por ahora'}
            </div>

            <section className="pm-detail-sheet__section">
              <div className="pm-detail-sheet__section-head">
                <strong>Cantidad</strong>
                <span>{currencyFormatter.format(subtotal)}</span>
              </div>

              <div className="pm-detail-sheet__qty">
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  aria-label="Disminuir cantidad"
                >
                  -
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((current) => Math.max(1, current + 1))}
                  aria-label="Aumentar cantidad"
                >
                  +
                </button>
              </div>
            </section>

            {extraOptions.length > 0 ? (
              <section className="pm-detail-sheet__section">
                <div className="pm-detail-sheet__section-head">
                  <strong>Extras</strong>
                  <span>Opcional</span>
                </div>

                <div className="pm-detail-sheet__options">
                  {extraOptions.map((extra) => {
                    const isSelected = selectedExtraIds.includes(extra.id_extra);
                    return (
                      <button
                        key={extra.id_extra}
                        type="button"
                        className={`pm-detail-sheet__option ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => toggleExtra(extra.id_extra)}
                      >
                        <span>{extra.nombre}</span>
                        <strong>+{currencyFormatter.format(extra.precio_adicional || 0)}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {requiresSauceSelection ? (
              <section className="pm-detail-sheet__section">
                <div className="pm-detail-sheet__section-head">
                  <strong>Salsas</strong>
                  <span>
                    {selectedSauceCount}/{requiredSauceCount}
                  </span>
                </div>

                {requiredSauceCount > 0 ? (
                  <p className="pm-detail-sheet__hint">
                    Para {quantity} unidad(es), debes elegir exactamente {requiredSauceCount} salsa(s).
                  </p>
                ) : (
                  <p className="pm-detail-sheet__hint">
                    Este item no requiere seleccion de salsas para esta cantidad.
                  </p>
                )}

                {allowedSauces.length > 0 ? (
                  <div className="pm-detail-sheet__sauces">
                    {allowedSauces.map((sauce) => {
                      const sauceId = Number(sauce?.id_salsa || 0);
                      const currentCount = Number(sauceCounts?.[sauceId] || 0);
                      return (
                        <div key={sauceId} className="pm-detail-sheet__sauce-row">
                          <div className="pm-detail-sheet__sauce-copy">
                            <strong>{sauce.nombre}</strong>
                            <small>Picante: {Number(sauce?.nivel_picante || 0)}</small>
                          </div>
                          <div className="pm-detail-sheet__qty pm-detail-sheet__qty--mini">
                            <button
                              type="button"
                              onClick={() => changeSauceCount(sauceId, -1)}
                              disabled={currentCount <= 0}
                              aria-label={`Quitar salsa ${sauce.nombre}`}
                            >
                              -
                            </button>
                            <span>{currentCount}</span>
                            <button
                              type="button"
                              onClick={() => changeSauceCount(sauceId, 1)}
                              disabled={!canIncreaseSauce}
                              aria-label={`Agregar salsa ${sauce.nombre}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="pm-detail-sheet__hint">No hay salsas configuradas para este item.</p>
                )}
              </section>
            ) : null}

            {validationError ? (
              <div className="pm-detail-sheet__state pm-detail-sheet__state--error">
                <p>{validationError}</p>
              </div>
            ) : null}

            <button
              type="button"
              className="btn btn-dark pm-detail-sheet__cta"
              disabled={!item.disponibilidad.available}
              aria-disabled={!item.disponibilidad.available}
              onClick={handleAdd}
            >
              {item.disponibilidad.available ? 'Agregar al carrito' : 'No disponible para agregar'}
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default ProductDetailSheet;
