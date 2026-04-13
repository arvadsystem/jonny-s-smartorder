const SkeletonCard = ({ index }) => (
  <article className="pm-skeleton-card" aria-hidden="true" key={`pm-skeleton-${index}`}>
    <div className="pm-skeleton-card__media" />
    <div className="pm-skeleton-card__line is-title" />
    <div className="pm-skeleton-card__line" />
    <div className="pm-skeleton-card__line is-short" />
    <div className="pm-skeleton-card__button" />
  </article>
);

const CatalogSkeleton = () => (
  <section className="pm-skeleton" aria-label="Cargando productos" role="status" aria-live="polite">
    <div className="pm-skeleton__hero" />
    <div className="pm-skeleton__toolbar" />
    <div className="pm-skeleton__grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonCard key={`pm-skeleton-card-${index}`} index={index} />
      ))}
    </div>
  </section>
);

export default CatalogSkeleton;
