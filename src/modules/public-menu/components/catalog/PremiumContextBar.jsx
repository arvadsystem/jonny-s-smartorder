import OrderTypeBadge from './OrderTypeBadge';

// PremiumContextBar: segunda fila ligera para contexto operativo del pedido.
// Props:
// - branchName: sucursal activa.
// - orderTypeLabel: tipo de pedido activo.
// - onChangeBranch: handler actual para cambiar contexto (sin logica nueva).
const PremiumContextBar = ({
  branchName = 'Sucursal',
  orderTypeLabel = 'Pedido',
  onChangeBranch
}) => (
  <section className="pm-premium-context" aria-label="Contexto de pedido">
    <div className="pm-premium-context__left">
      <small className="pm-premium-context__label">Sucursal actual</small>
      <strong className="pm-premium-context__branch">{branchName}</strong>
    </div>

    <div className="pm-premium-context__right">
      <OrderTypeBadge orderTypeLabel={orderTypeLabel} />
      <button type="button" className="pm-premium-context__change-btn" onClick={onChangeBranch}>
        <i className="bi bi-arrow-repeat" aria-hidden="true" />
        Cambiar
      </button>
    </div>
  </section>
);

export default PremiumContextBar;
