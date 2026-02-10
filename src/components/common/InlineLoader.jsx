const InlineLoader = ({ text = "Cargando..." }) => (
  <div className="text-muted d-flex align-items-center gap-2">
    <span className="spinner-border spinner-border-sm" />
    <span>{text}</span>
  </div>
);

export default InlineLoader;
