// HeroSection: bloque principal visual del catalogo con carrusel de impacto.
// Props:
// - slides: arreglo de imagenes/titulos existentes del catalogo.
// - heroIndex: indice activo del carrusel (controlado por CatalogScreen).
// - onPrev/onNext/onSelectSlide: handlers existentes del carrusel.
const HeroSection = ({
  slides = [],
  heroIndex = 0,
  branchName = '',
  orderTypeLabel = '',
  onPrev,
  onNext,
  onSelectSlide
}) => (
  <section className="pm-hero-section" aria-label="Destacados del menu">
    <div className="pm-hero-section__viewport">
      {slides.map((slide, index) => (
        <article
          key={slide.id}
          className={`pm-hero-section__slide ${index === heroIndex ? 'is-active' : ''}`}
          aria-hidden={index !== heroIndex}
        >
          {slide.imageUrl ? (
            <img
              src={slide.imageUrl}
              alt={slide.title}
              className="pm-hero-section__image"
              loading={index === 0 ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="pm-hero-section__placeholder" />
          )}
          <div className="pm-hero-section__overlay" aria-hidden="true" />
        </article>
      ))}
    </div>

    <div className="pm-hero-section__content">
      <h2 className="pm-hero-section__title">
        <span className="pm-hero-section__title-top">{'\u00BF'}QUE SE TE</span>
        <span className="pm-hero-section__title-bottom">
          <span className="pm-hero-section__title-accent">ANTOJA</span>
          <span className="pm-hero-section__title-plain">HOY?</span>
        </span>
      </h2>
      {branchName || orderTypeLabel ? (
        <p className="pm-hero-section__context">
          <i className="bi bi-geo-alt-fill" aria-hidden="true" />
          <span>{branchName}</span>
          {orderTypeLabel ? <span className="pm-hero-section__context-sep">·</span> : null}
          {orderTypeLabel ? <span>{orderTypeLabel}</span> : null}
        </p>
      ) : null}
    </div>

    {slides.length > 1 ? (
      <>
        <button
          type="button"
          className="pm-hero-section__arrow pm-hero-section__arrow--prev"
          onClick={onPrev}
          aria-label="Imagen anterior"
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="pm-hero-section__arrow pm-hero-section__arrow--next"
          onClick={onNext}
          aria-label="Siguiente imagen"
        >
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </button>
        <div className="pm-hero-section__dots" role="tablist" aria-label="Indicadores del hero">
          {slides.map((slide, index) => (
            <button
              key={`hero-dot-${slide.id}`}
              type="button"
              role="tab"
              aria-selected={index === heroIndex}
              className={`pm-hero-section__dot ${index === heroIndex ? 'is-active' : ''}`}
              onClick={() => onSelectSlide?.(index)}
              aria-label={`Ir a imagen ${index + 1}`}
            />
          ))}
        </div>
      </>
    ) : null}
  </section>
);

export default HeroSection;
