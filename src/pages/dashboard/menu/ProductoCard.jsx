import { memo, useEffect, useRef, useState } from 'react';
import { FaImage, FaPlus } from 'react-icons/fa';
import { resolveMenuItemImageSrc } from './menuImage';

const ProductoCard = ({ producto, onAgregar, onOpenDetail }) => {
  const nombre = producto?.nombre_producto || producto?.descripcion || 'Producto sin nombre';
  const precio = Number(producto?.precio || 0);
  const imageSrc = resolveMenuItemImageSrc(producto);
  const descripcion = producto?.descripcion_producto || producto?.descripcion || '';
  const feedbackTimeoutRef = useRef(null);
  const [isAddFeedbackOn, setIsAddFeedbackOn] = useState(false);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const triggerAddFeedback = () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setIsAddFeedbackOn(true);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setIsAddFeedbackOn(false);
      feedbackTimeoutRef.current = null;
    }, 220);
  };

  const handleAgregar = (event) => {
    event.stopPropagation();
    triggerAddFeedback();
    onAgregar(producto);
  };

  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDetail(producto);
    }
  };

  return (
    <div
      className="card h-100 shadow-sm menu-pos-product-card"
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetail(producto)}
      onKeyDown={handleKeyDown}
    >
      <div className="menu-pos-product-media">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={nombre}
            className="menu-pos-product-image"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const next = e.currentTarget.nextElementSibling;
              if (next) next.classList.remove('d-none');
            }}
          />
        ) : null}
        <div className={`menu-pos-product-placeholder ${imageSrc ? 'd-none' : ''}`}>
          <FaImage className="fs-4" />
          <span>Sin imagen</span>
        </div>
      </div>

      <div className="card-body d-flex flex-column menu-pos-product-body">
        <div className="menu-pos-product-copy">
          <h6 className="card-title mb-0 menu-pos-product-name">{nombre}</h6>
          {descripcion ? <div className="text-muted small">{descripcion}</div> : null}
        </div>

        <div className="menu-pos-product-footer">
          <div className="menu-pos-product-price">L. {precio.toFixed(2)}</div>

          <button
            type="button"
            className={`btn btn-primary btn-sm menu-pos-add-btn ${isAddFeedbackOn ? 'is-feedback' : ''}`}
            onPointerDown={triggerAddFeedback}
            onClick={handleAgregar}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Agregar ${nombre}`}
          >
            <FaPlus />
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(ProductoCard);
