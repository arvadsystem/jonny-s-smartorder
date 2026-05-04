// Hero principal del catalogo con carrusel y CTA de conversion.
const CatalogHero = ({
  slides = [],
  heroIndex = 0,
  onPrev,
  onNext,
  onSelectSlide,
  onPrimaryAction
}) => (
  <section className="pm-delivery-hero" aria-label="Lo mas pedido hoy">
    <div className="pm-delivery-hero__viewport">
      {slides.map((slide, index) => (
        <article
          key={slide.id}
          className={`pm-delivery-hero__slide ${index === heroIndex ? 'is-active' : ''}`}
          aria-hidden={index !== heroIndex}
        >
          {slide.imageUrl ? (
            <img
              src={slide.imageUrl}
              alt={slide.title}
              className="pm-delivery-hero__image"
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="pm-delivery-hero__placeholder" />
          )}
          <div className="pm-delivery-hero__overlay" aria-hidden="true" />
        </article>
      ))}
    </div>

    <div className="pm-delivery-hero__copy">
      <span className="pm-delivery-hero__eyebrow">Entrega rapida</span>
      <h2 className="pm-delivery-hero__title">Lo mas pedido hoy</h2>
      <p className="pm-delivery-hero__subtitle">
        {slides[heroIndex]?.subtitle || 'Recibe tu pedido en 20-30 min'}
      </p>
      <button
        type="button"
        className="pm-delivery-hero__cta"
        onClick={onPrimaryAction}
      >
        Ordenar ahora
      </button>
      <div className="pm-delivery-hero__stats" aria-hidden="true">
        <span>Entrega 20-30 min</span>
        <span>Pago seguro</span>
        <span>Top del dia</span>
      </div>
    </div>

    {slides.length > 1 ? (
      <>
        <button
          type="button"
          className="pm-delivery-hero__arrow pm-delivery-hero__arrow--prev"
          onClick={onPrev}
          aria-label="Imagen anterior"
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pm-delivery-hero__arrow pm-delivery-hero__arrow--next"
          onClick={onNext}
          aria-label="Siguiente imagen"
        >
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
        <div className="pm-delivery-hero__dots" role="tablist" aria-label="Indicadores">
          {slides.map((slide, index) => (
            <button
              key={`hero-dot-${slide.id}`}
              type="button"
              role="tab"
              aria-selected={index === heroIndex}
              className={`pm-delivery-hero__dot ${index === heroIndex ? 'is-active' : ''}`}
              onClick={() => onSelectSlide?.(index)}
              aria-label={`Ir a imagen ${index + 1}`}
            />
          ))}
        </div>
      </>
    ) : null}
  </section>
);

export default CatalogHero;
