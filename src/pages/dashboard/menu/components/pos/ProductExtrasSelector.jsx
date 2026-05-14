import { memo } from 'react';
import { FaCheck } from 'react-icons/fa';
import { formatMoney } from '../../utils/menuPosOrderUtils';

const ProductExtrasSelector = ({
  extraOptions = [],
  selectedExtraIds = [],
  onToggleExtra
}) => {
  if (!Array.isArray(extraOptions) || extraOptions.length === 0) return null;

  const selectedCount = selectedExtraIds.length;

  return (
    <section className="menu-pos-detail-section">
      <div className="menu-pos-detail-section-head">
        <strong>Extras</strong>
        <span className="small text-muted">
          {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="menu-pos-detail-extras-list">
        {extraOptions.map((extra) => {
          const isSelected = selectedExtraIds.includes(extra.id_extra);

          return (
            <button
              key={extra.id_extra}
              type="button"
              className={`menu-pos-detail-extra-option ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onToggleExtra(extra.id_extra)}
              aria-pressed={isSelected}
            >
              <div className="menu-pos-detail-extra-copy">
                <span className="menu-pos-detail-extra-name">{extra.nombre}</span>
                <span className="menu-pos-detail-extra-price">
                  +{formatMoney(extra.precio_adicional)}
                </span>
              </div>

              <span className={`menu-pos-detail-extra-check ${isSelected ? 'is-selected' : ''}`}>
                <FaCheck />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default memo(ProductExtrasSelector);

