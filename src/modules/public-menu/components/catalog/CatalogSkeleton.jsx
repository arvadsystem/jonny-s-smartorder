import jonnysLogo from '../../../../assets/images/logo-sin-fondo.png';

const CatalogSkeleton = () => (
  <section className="pm-skeleton" aria-label="Cargando productos" role="status" aria-live="polite">
    <div className="pm-skeleton__brand-ring" aria-hidden="true">
      <img src={jonnysLogo} alt="" className="pm-skeleton__brand-logo" />
    </div>
  </section>
);

export default CatalogSkeleton;
