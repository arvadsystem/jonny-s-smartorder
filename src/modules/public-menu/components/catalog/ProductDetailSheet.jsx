const currencyFormatter = new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
  maximumFractionDigits: 0
});

// Bottom sheet de detalle real para HU-133.
// Aun no integra carrito: solo muestra informacion y estado de disponibilidad.
const ProductDetailSheet = ({ open, item, loading, error, onClose, onRetry, onAdd }) => {
  if (!open) return null;

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
            Detalle del item
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

        {loading ? (
          <p className="pm-detail-sheet__state">Cargando detalle...</p>
        ) : null}

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
              />
            ) : null}

            <p className="pm-detail-sheet__category">{item.categoria.nombre}</p>
            <h3 className="pm-detail-sheet__name">{item.nombre}</h3>
            <p className="pm-detail-sheet__description">{item.descripcion}</p>

            <div className="pm-detail-sheet__price-wrap">
              <span className="pm-detail-sheet__price-label">Precio final</span>
              <strong className="pm-detail-sheet__price-value">
                {item.precio.final === null || item.precio.final === undefined
                  ? 'Precio pendiente'
                  : currencyFormatter.format(item.precio.final)}
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

            <button
              type="button"
              className="btn btn-dark pm-detail-sheet__cta"
              disabled={!item.disponibilidad.available}
              aria-disabled={!item.disponibilidad.available}
              onClick={() => onAdd?.(item)}
            >
              {item.disponibilidad.available
                ? 'Agregar al carrito'
                : 'No disponible para agregar'}
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default ProductDetailSheet;
