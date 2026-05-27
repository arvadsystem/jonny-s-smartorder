import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateRequiredSauces,
  getItemAllowedSauces,
  getItemExtraOptions,
  isWingsOrTendersItem
} from '../../utils/publicMenuItemConfig';

const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

const MAX_LINE_NOTE_LENGTH = 100;

const toPositiveInt = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const normalizeNote = (value) =>
  String(value ?? '')
    .slice(0, MAX_LINE_NOTE_LENGTH)
    .replace(/\r/g, '');

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const sumSauceCount = (rawMap = {}) =>
  Object.values(rawMap).reduce((sum, value) => sum + Number(value || 0), 0);

// Hoja de configuracion para items con extras/salsas y nota por producto.
const ProductDetailSheet = ({ open, item, loading, error, onClose, onRetry, onAdd }) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedExtraIds, setSelectedExtraIds] = useState([]);
  const [sauceCounts, setSauceCounts] = useState({});
  const [isSauceSectionOpen, setIsSauceSectionOpen] = useState(false);
  const [lineNote, setLineNote] = useState('');
  const [validationError, setValidationError] = useState('');
  const backdropPressRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setQuantity(1);
    setSelectedExtraIds([]);
    setSauceCounts({});
    setIsSauceSectionOpen(false);
    setLineNote('');
    setValidationError('');
  }, [open, item?.id_detalle_menu]);

  const extraOptions = useMemo(() => getItemExtraOptions(item), [item]);
  const allowedSauces = useMemo(() => getItemAllowedSauces(item), [item]);
  const availableSauces = useMemo(
    () => allowedSauces.filter((sauce) => sauce?.disponible !== false),
    [allowedSauces]
  );

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
  const descriptionText = String(item?.descripcion || '').trim();
  const shouldShowDescription =
    descriptionText && normalizeText(descriptionText) !== normalizeText(item?.nombre);
  const requiredSauceCount = calculateRequiredSauces(item, quantity);
  const requiresSauceSelection =
    item?.salsas_requiere_seleccion === true ||
    requiredSauceCount > 0 ||
    allowedSauces.length > 0;
  const selectedSauceCount = sumSauceCount(sauceCounts);
  const canIncreaseSauce = requiredSauceCount <= 0 || selectedSauceCount < requiredSauceCount;
  const isSingleSauceSelection = requiresSauceSelection && requiredSauceCount === 1;
  const popularSauce = availableSauces[0] || null;
  const shouldShowWingOrderNotice = isWingsOrTendersItem(item);

  const handleBackdropClick = (event) => {
    // Evita cierres accidentales cuando el click nace dentro del modal
    // y por bubbling/touch llega al backdrop.
    if (!backdropPressRef.current) return;
    if (event.target !== event.currentTarget) return;
    backdropPressRef.current = false;
    onClose?.();
  };

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

  // Modo tipo radio cuando solo se debe elegir 1 salsa.
  const selectSingleSauce = (idSalsa) => {
    if (!isSingleSauceSelection) return;
    setValidationError('');
    setSauceCounts({ [idSalsa]: 1 });
  };

  const togglePopularSauce = () => {
    if (!popularSauce || !isSingleSauceSelection) return;
    setValidationError('');
    const sauceId = Number(popularSauce.id_salsa || 0);
    if (!sauceId) return;
    const active = Number(sauceCounts?.[sauceId] || 0) > 0;
    setSauceCounts(active ? {} : { [sauceId]: 1 });
  };

  const handleAdd = () => {
    if (!item?.disponibilidad?.available) return;

    if (requiresSauceSelection && requiredSauceCount > 0 && availableSauces.length === 0) {
      setValidationError('Este item requiere salsas, pero no tiene salsas disponibles.');
      return;
    }

    if (requiresSauceSelection && requiredSauceCount > 0 && selectedSauceCount !== requiredSauceCount) {
      setValidationError(`Debes seleccionar exactamente ${requiredSauceCount} salsa(s).`);
      return;
    }

    const salsasPorUnidad = availableSauces
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
      salsasPorUnidad,
      nota: normalizeNote(lineNote).trim()
    });
  };

  return (
    <div
      className="pm-detail-sheet__backdrop"
      role="presentation"
      onPointerDown={(event) => {
        backdropPressRef.current = event.target === event.currentTarget;
      }}
      onClick={handleBackdropClick}
    >
      <section
        className="pm-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-detail-sheet-title"
        onPointerDownCapture={() => {
          backdropPressRef.current = false;
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="pm-detail-sheet__header">
          <h2 id="pm-detail-sheet-title" className="pm-detail-sheet__title">
            {item?.nombre || 'Configurar producto'}
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

            {shouldShowDescription ? (
              <p className="pm-detail-sheet__description">{descriptionText}</p>
            ) : null}

            <div className="pm-detail-sheet__price-wrap">
              <span className="pm-detail-sheet__price-label">Precio unitario</span>
              <strong className="pm-detail-sheet__price-value">
                {item.precio.final === null || item.precio.final === undefined
                  ? 'Precio pendiente'
                  : currencyFormatter.format(unitPrice)}
              </strong>
            </div>

            {shouldShowWingOrderNotice ? (
              <div className="pm-detail-sheet__order-includes" role="note">
                TODAS LAS ORDENES INCLUYEN PAPAS SAZONADAS Y SALSA RANCH
              </div>
            ) : null}

            <section className="pm-detail-sheet__section">
              <div className="pm-detail-sheet__section-head">
                <strong>Cantidad</strong>
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
                        aria-pressed={isSelected}
                      >
                        <span className="pm-detail-sheet__option-main">
                          <span className="pm-detail-sheet__option-check" aria-hidden="true">
                            {isSelected ? <i className="bi bi-check-lg" /> : null}
                          </span>
                          <span>{extra.nombre}</span>
                        </span>
                        <strong>+{currencyFormatter.format(extra.precio_adicional || 0)}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {requiresSauceSelection ? (
              <section className="pm-detail-sheet__section">
                {isSingleSauceSelection && popularSauce ? (
                  <button
                    type="button"
                    className="pm-detail-sheet__popular"
                    onClick={togglePopularSauce}
                  >
                    <div className="pm-detail-sheet__popular-copy">
                      <strong>Personalizacion mas popular</strong>
                      <small>{popularSauce.nombre}</small>
                    </div>
                    <span
                      className={`pm-detail-sheet__switch ${
                        Number(sauceCounts?.[popularSauce.id_salsa] || 0) > 0 ? 'is-on' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                ) : null}

                <button
                  type="button"
                  className="pm-detail-sheet__sauce-toggle"
                  onClick={() => setIsSauceSectionOpen((current) => !current)}
                  aria-expanded={isSauceSectionOpen}
                >
                  <strong>Elegi tu salsa</strong>
                  <span className="pm-detail-sheet__sauce-toggle-side">
                    <span className="pm-detail-sheet__tag-required">
                      {requiredSauceCount > 0 ? 'Requerido' : 'Opcional'}
                    </span>
                    <i
                      className={`bi ${isSauceSectionOpen ? 'bi-chevron-up' : 'bi-chevron-down'}`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {isSauceSectionOpen ? (
                  <>
                    <p className="pm-detail-sheet__hint">
                      {requiredSauceCount > 0
                        ? `Elegi ${requiredSauceCount} opcion${requiredSauceCount > 1 ? 'es' : ''}.`
                        : 'No requiere seleccion de salsa para esta cantidad.'}
                    </p>

                    {allowedSauces.length > 0 ? (
                      <div className="pm-detail-sheet__sauces">
                        {allowedSauces.map((sauce) => {
                          const sauceId = Number(sauce?.id_salsa || 0);
                          const currentCount = Number(sauceCounts?.[sauceId] || 0);
                          const isUnavailable = sauce?.disponible === false;
                          const selected = currentCount > 0;

                          if (isSingleSauceSelection) {
                            return (
                              <button
                                key={sauceId}
                                type="button"
                                className={`pm-detail-sheet__sauce-choice ${selected ? 'is-selected' : ''}`}
                                onClick={() => selectSingleSauce(sauceId)}
                                disabled={isUnavailable}
                              >
                                <span>{sauce.nombre}</span>
                                {isUnavailable ? (
                                  <strong className="pm-detail-sheet__sauce-unavailable">Agotado</strong>
                                ) : (
                                  <span className={`pm-detail-sheet__radio ${selected ? 'is-on' : ''}`} aria-hidden="true" />
                                )}
                              </button>
                            );
                          }

                          return (
                            <div key={sauceId} className="pm-detail-sheet__sauce-row">
                              <div className="pm-detail-sheet__sauce-copy">
                                <strong>{sauce.nombre}</strong>
                                {isUnavailable ? (
                                  <small className="pm-detail-sheet__sauce-unavailable">Agotado</small>
                                ) : null}
                              </div>

                              <div className="pm-detail-sheet__qty pm-detail-sheet__qty--mini">
                                <button
                                  type="button"
                                  onClick={() => changeSauceCount(sauceId, -1)}
                                  disabled={currentCount <= 0 || isUnavailable}
                                  aria-label={`Quitar salsa ${sauce.nombre}`}
                                >
                                  -
                                </button>
                                <span>{currentCount}</span>
                                <button
                                  type="button"
                                  onClick={() => changeSauceCount(sauceId, 1)}
                                  disabled={!canIncreaseSauce || isUnavailable}
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
                  </>
                ) : null}
              </section>
            ) : null}

            <section className="pm-detail-sheet__section">
              <div className="pm-detail-sheet__section-head">
                <strong>Instrucciones para cocina</strong>
                <span>{normalizeNote(lineNote).length}/{MAX_LINE_NOTE_LENGTH}</span>
              </div>
              <p className="pm-detail-sheet__hint">
                El restaurante intentara seguirlas cuando lo prepare.
              </p>
              <textarea
                className="pm-detail-sheet__note-input"
                value={lineNote}
                onChange={(event) => setLineNote(normalizeNote(event.target.value))}
                placeholder="Ej: sin cebolla, sin mayonesa, bien tostado"
                rows={3}
                maxLength={MAX_LINE_NOTE_LENGTH}
              />
            </section>

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
              {item.disponibilidad.available ? (
                <>
                  <i className="bi bi-cart3" aria-hidden="true" />
                  <span>Agregar al Carrito</span>
                </>
              ) : (
                'No disponible para agregar'
              )}
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default ProductDetailSheet;
