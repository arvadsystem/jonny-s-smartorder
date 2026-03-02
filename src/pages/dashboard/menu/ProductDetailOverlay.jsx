import { memo, useEffect, useState } from 'react';
import { FaImage, FaPlus, FaTimes } from 'react-icons/fa';
import { resolveMenuItemImageSrc } from './menuImage';

const ANIMATION_MS = 260;

const ProductDetailOverlay = ({ isOpen, onAdd, onClose, onExited, product }) => {
  const [shouldRender, setShouldRender] = useState(isOpen);

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

  if (!shouldRender || !product) return null;

  const nombre = product?.nombre_producto || product?.descripcion || 'Producto sin nombre';
  const precio = Number(product?.precio || 0);
  const imageSrc = resolveMenuItemImageSrc(product);
  const descripcion = product?.descripcion_producto || product?.descripcion || '';
  const shellClassName = `menu-pos-detail-overlay ${isOpen ? 'is-open' : 'is-closing'}`;

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
              <div className="menu-pos-detail-price">L. {precio.toFixed(2)}</div>
              {descripcion ? (
                <p className="menu-pos-detail-description mb-0">{descripcion}</p>
              ) : null}
            </div>

            <div className="menu-pos-detail-actions">
              <button
                type="button"
                className="btn btn-outline-secondary btn-lg menu-pos-detail-action"
                onClick={onClose}
              >
                Cerrar
              </button>

              {typeof onAdd === 'function' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-lg menu-pos-detail-action"
                  onClick={() => onAdd(product)}
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
