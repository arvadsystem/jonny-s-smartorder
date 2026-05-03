const EmptyProductImagePlaceholder = ({ label = 'JONNY’S' }) => (
  <div className="pm-menu-image-placeholder" aria-label="Producto sin imagen disponible">
    <span className="pm-menu-image-placeholder__mark">{label.slice(0, 1)}</span>
    <span className="pm-menu-image-placeholder__line" />
  </div>
);

export default EmptyProductImagePlaceholder;
