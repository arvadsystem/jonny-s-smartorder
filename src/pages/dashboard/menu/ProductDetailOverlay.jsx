import { memo, useEffect, useState } from 'react';
import { FaImage, FaPlus, FaTimes } from 'react-icons/fa';
import ProductExtrasSelector from './components/pos/ProductExtrasSelector';
import ProductQuantityControl from './components/pos/ProductQuantityControl';
import { resolveMenuItemImageSrc } from './menuImage';
import { toDisplayTitle } from './textFormat';
import { getProductExtraOptions } from './utils/menuPosProductConfig';
import {
  calculateConfiguredUnitPrice,
  calculateLineSubtotal,
  formatMoney
} from './utils/menuPosOrderUtils';

const ANIMATION_MS = 260;

const getSalsaComponents = (product) => (
  Array.isArray(product?.salsas_componentes) ? product.salsas_componentes : []
);

const getAllowedSauces = (product) => (
  Array.isArray(product?.salsas_permitidas) ? product.salsas_permitidas : []
);

const findMatchingRule = (rules, unidades) => {
  const units = Number(unidades);
  if (!Number.isFinite(units) || units <= 0) return null;

  const orderedRules = [...(Array.isArray(rules) ? rules : [])].sort((a, b) => (
    Number(a?.min_unidades || 0) - Number(b?.min_unidades || 0)
  ));

  return orderedRules.find((rule) => {
    const min = Number(rule?.min_unidades || 0);
    const max = rule?.max_unidades === null || rule?.max_unidades === undefined
      ? null
      : Number(rule.max_unidades);

    if (!Number.isFinite(min) || units < min) return false;
    if (max !== null && Number.isFinite(max) && units > max) return false;
    return true;
  }) || null;
};

const calculateRequiredSauces = (product, quantity = 1) => (
  getSalsaComponents(product).reduce((total, component) => {
    const multiplier = Math.max(1, Number(component?.multiplicador || 1));
    const units = Math.max(1, Number(quantity || 1)) * multiplier;
    const rule = findMatchingRule(component?.reglas, units);
    return total + Number(rule?.salsas_requeridas || 0);
  }, 0)
);

const countSelectedSauces = (sauceCounts) => (
  Object.values(sauceCounts || {}).reduce((total, value) => total + Number(value || 0), 0)
);

const getDisplayName = (value) =>
  toDisplayTitle(
    String(value || '')
      .replace(/\s*\(demo\)\s*$/i, '')
      .trim()
  );

const shouldHideDescription = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  return /^[A-Z]{4,}$/.test(normalized);
};

const ProductDetailOverlay = ({ isOpen, onAdd, onClose, onExited, product, canAdd = true }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [sauceCounts, setSauceCounts] = useState({});
  const [selectedExtraIds, setSelectedExtraIds] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!shouldRender || isOpen) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShouldRender(false);
      onExited?.();
    }, ANIMATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, onExited, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return undefined;

    const previousOverflow = document.body.style.overflow;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, shouldRender]);

  useEffect(() => {
    setSauceCounts({});
    setSelectedExtraIds([]);
    setQuantity(1);
    setValidationError('');
  }, [product?.id_producto, product?.id_receta, isOpen]);

  if (!shouldRender || !product) return null;

  const nombre = getDisplayName(product?.nombre_producto || product?.descripcion || 'Producto sin nombre');
  const precioBase = Number(product?.precio || 0);
  const imageSrc = resolveMenuItemImageSrc(product);
  const descripcion = product?.descripcion_producto || product?.descripcion || '';
  const descripcionVisible = shouldHideDescription(descripcion) ? '' : descripcion;
  const shellClassName = `menu-pos-detail-overlay ${isOpen ? 'is-open' : 'is-closing'}`;
  const extraOptions = getProductExtraOptions(product);
  const selectedIdSet = new Set(selectedExtraIds);
  const selectedExtras = extraOptions.filter((extra) => selectedIdSet.has(extra.id_extra));
  const extraUnitAmount = selectedExtras.reduce(
    (total, extra) => total + Number(extra?.precio_adicional || 0),
    0
  );
  const precioUnitario = calculateConfiguredUnitPrice(precioBase, selectedExtras);
  const subtotalConfigurado = calculateLineSubtotal(precioUnitario, quantity);
  const allowedSauces = getAllowedSauces(product);
  const requiredSaucesPerUnit = calculateRequiredSauces(product, 1);
  const requiresSauceSelection = product?.salsas_requiere_seleccion === true;
  const totalSelectedSauces = countSelectedSauces(sauceCounts);
  const hasSauceConfigError =
    requiresSauceSelection &&
    requiredSaucesPerUnit > 0 &&
    allowedSauces.length === 0;

  const changeSauceCount = (sauceId, delta) => {
    setValidationError('');
    setSauceCounts((current) => {
      const currentValue = Number(current?.[sauceId] || 0);
      const nextValue = Math.max(0, currentValue + delta);
      const currentSelectedTotal = countSelectedSauces(current);

      if (delta > 0 && requiredSaucesPerUnit > 0 && currentSelectedTotal >= requiredSaucesPerUnit) {
        return current;
      }

      return {
        ...current,
        [sauceId]: nextValue
      };
    });
  };

  const toggleExtra = (extraId) => {
    setValidationError('');
    setSelectedExtraIds((current) => {
      if (current.includes(extraId)) {
        return current.filter((value) => value !== extraId);
      }
      return [...current, extraId];
    });
  };

  const increaseQuantity = () => {
    setValidationError('');
    setQuantity((current) => Math.max(1, Number(current || 1) + 1));
  };

  const decreaseQuantity = () => {
    setValidationError('');
    setQuantity((current) => Math.max(1, Number(current || 1) - 1));
  };

  const handleAdd = () => {
    if (!canAdd || typeof onAdd !== 'function') return;

    if (hasSauceConfigError) {
      setValidationError('Este item requiere salsas, pero no tiene salsas configuradas.');
      return;
    }

    if (
      requiresSauceSelection &&
      requiredSaucesPerUnit > 0 &&
      totalSelectedSauces !== requiredSaucesPerUnit
    ) {
      setValidationError(`Debes seleccionar ${requiredSaucesPerUnit} salsa(s).`);
      return;
    }

    const salsasPorUnidad = allowedSauces
      .map((sauce) => ({
        id_salsa: Number(sauce?.id_salsa || 0),
        nombre: String(sauce?.nombre || 'Salsa'),
        cantidad: Number(sauceCounts?.[sauce.id_salsa] || 0)
      }))
      .filter((sauce) => sauce.id_salsa > 0 && sauce.cantidad > 0);

    onAdd(product, {
      cantidad: quantity,
      extras: selectedExtras,
      salsasPorUnidad,
      salsasRequeridasPorUnidad: requiredSaucesPerUnit
    });
    onClose();
  };

  return (
    <div className={shellClassName} aria-hidden={!isOpen}>
      <button
        type="button"
        className="menu-pos-detail-backdrop"
        aria-label="Cerrar detalle"
        onClick={onClose}
      />

      <div className="menu-pos-detail-shell">
        <section
          className="menu-pos-detail-panel shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-pos-detail-title"
        >
          <button
            type="button"
            className="btn btn-light menu-pos-detail-close"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            <FaTimes />
          </button>

          <div className="menu-pos-detail-media-wrap">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={nombre}
                className="menu-pos-detail-image"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                  const next = event.currentTarget.nextElementSibling;
                  if (next) next.classList.remove('d-none');
                }}
              />
            ) : null}

            <div className={`menu-pos-detail-placeholder ${imageSrc ? 'd-none' : ''}`}>
              <FaImage className="menu-pos-detail-placeholder-icon" />
              <span>Sin imagen disponible</span>
            </div>
          </div>

          <div className="menu-pos-detail-body">
            <div className="menu-pos-detail-copy">
              <h2 id="menu-pos-detail-title" className="menu-pos-detail-title">
                {nombre}
              </h2>
              <div className="menu-pos-detail-price">{formatMoney(precioBase)}</div>
              {descripcionVisible ? (
                <p className="menu-pos-detail-description mb-0">{descripcionVisible}</p>
              ) : null}
            </div>

            <div className="menu-pos-detail-pricing">
              <div className="menu-pos-detail-pricing-row">
                <span>Precio base</span>
                <strong>{formatMoney(precioBase)}</strong>
              </div>
              <div className="menu-pos-detail-pricing-row">
                <span>Extras por unidad</span>
                <strong>{formatMoney(extraUnitAmount)}</strong>
              </div>
              <div className="menu-pos-detail-pricing-row">
                <span>Precio unitario</span>
                <strong>{formatMoney(precioUnitario)}</strong>
              </div>
              <div className="menu-pos-detail-pricing-row is-total">
                <span>Subtotal ({quantity})</span>
                <strong>{formatMoney(subtotalConfigurado)}</strong>
              </div>
            </div>

            <ProductExtrasSelector
              extraOptions={extraOptions}
              selectedExtraIds={selectedExtraIds}
              onToggleExtra={toggleExtra}
            />

            <ProductQuantityControl
              quantity={quantity}
              onDecrease={decreaseQuantity}
              onIncrease={increaseQuantity}
            />

            {requiresSauceSelection ? (
              <section className="menu-pos-detail-section menu-pos-detail-sauces">
                <div className="menu-pos-detail-section-head mb-2">
                  <strong>Salsas</strong>
                  <span className="small text-muted">
                    Seleccionadas: {totalSelectedSauces}/{requiredSaucesPerUnit}
                  </span>
                </div>

                {requiredSaucesPerUnit > 0 ? (
                  <div className="small text-muted mb-3">
                    Debes elegir exactamente {requiredSaucesPerUnit} salsa(s). Puedes repetir una misma salsa.
                  </div>
                ) : (
                  <div className="small text-muted mb-3">
                    Este item tiene configuracion de salsas, pero no requiere seleccion para una unidad.
                  </div>
                )}

                {allowedSauces.length > 0 ? (
                  <div className="d-flex flex-column gap-2">
                    {allowedSauces.map((sauce) => {
                      const sauceId = Number(sauce?.id_salsa || 0);
                      const currentCount = Number(sauceCounts?.[sauceId] || 0);
                      const cannotIncrease =
                        requiredSaucesPerUnit > 0 &&
                        totalSelectedSauces >= requiredSaucesPerUnit;

                      return (
                        <div
                          key={sauceId}
                          className="d-flex align-items-center justify-content-between gap-3 border rounded-3 px-3 py-2 bg-white"
                        >
                          <div>
                            <div className="fw-semibold">{toDisplayTitle(sauce?.nombre || 'Salsa')}</div>
                            <div className="small text-muted">
                              Picante: {Number(sauce?.nivel_picante || 0)}
                            </div>
                          </div>

                          <div className="btn-group" role="group" aria-label={`Cantidad de ${sauce?.nombre || 'salsa'}`}>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => changeSauceCount(sauceId, -1)}
                              disabled={currentCount <= 0}
                            >
                              -
                            </button>
                            <span className="btn btn-light disabled">{currentCount}</span>
                            <button
                              type="button"
                              className="btn btn-outline-secondary"
                              onClick={() => changeSauceCount(sauceId, 1)}
                              disabled={requiredSaucesPerUnit > 0 ? cannotIncrease : false}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="alert alert-warning mb-0">
                    No hay salsas permitidas configuradas para este item.
                  </div>
                )}

                {validationError ? (
                  <div className="alert alert-danger mt-3 mb-0">{validationError}</div>
                ) : null}
              </section>
            ) : null}

            <div className="menu-pos-detail-actions">
              <button
                type="button"
                className="btn btn-outline-secondary btn-lg menu-pos-detail-action"
                onClick={onClose}
              >
                Cerrar
              </button>

              {canAdd && typeof onAdd === 'function' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg menu-pos-detail-action"
                  onClick={handleAdd}
                >
                  <FaPlus />
                  <span>Agregar</span>
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default memo(ProductDetailOverlay);
