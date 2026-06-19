// Barra sticky de sucursal y tipo de pedido para contexto rapido.
const BranchStickyBar = ({
  branchName = 'Sucursal',
  orderTypeLabel = 'Pedido',
  onChangeBranch
}) => (
  <section className="pm-branch-sticky" aria-label="Sucursal actual">
    <div className="pm-branch-sticky__left">
      <small className="pm-branch-sticky__label">Sucursal actual</small>
      <strong className="pm-branch-sticky__name">
        <i className="bi bi-geo-alt-fill" aria-hidden="true" />
        <span>{branchName}</span>
      </strong>
    </div>
    <div className="pm-branch-sticky__right">
      <span className="pm-branch-sticky__order-chip">{orderTypeLabel}</span>
      <button
        type="button"
        className="pm-branch-sticky__change"
        onClick={onChangeBranch}
      >
        <i className="bi bi-arrow-repeat" aria-hidden="true" />
        Cambiar
      </button>
    </div>
  </section>
);

export default BranchStickyBar;
