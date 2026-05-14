import { PUBLIC_MENU_ORDER_TYPE_OPTIONS } from '../../types/publicMenuTypes';

// MenuContextStrip: selector compacto de sucursal y tipo de pedido en la landing.
// Mantiene el paso contextual visible sin usar pantalla completa de sucursal.
const MenuContextStrip = ({
  branches = [],
  selectedBranchId = null,
  selectedOrderType = '',
  onSelectBranch,
  onSelectOrderType
}) => (
  <section className="pm-landing-context-strip" aria-label="Contexto de pedido">
    <div className="pm-landing-context-strip__block">
      <small>Sucursal</small>
      <div className="pm-landing-context-strip__chips">
        {branches.map((branch) => {
          const selected = Number(selectedBranchId || 0) === Number(branch?.id || 0);
          return (
            <button
              key={`landing-branch-${branch.id}`}
              type="button"
              className={`pm-landing-context-chip ${selected ? 'is-selected' : ''}`}
              onClick={() => onSelectBranch?.(branch)}
            >
              {branch?.displayName || branch?.name || 'Sucursal'}
            </button>
          );
        })}
      </div>
    </div>

    <div className="pm-landing-context-strip__block">
      <small>Tipo de pedido</small>
      <div className="pm-landing-context-strip__chips">
        {PUBLIC_MENU_ORDER_TYPE_OPTIONS.map((option) => {
          const selected = String(selectedOrderType || '') === String(option.id);
          return (
            <button
              key={`landing-order-${option.id}`}
              type="button"
              className={`pm-landing-context-chip ${selected ? 'is-selected' : ''}`}
              onClick={() => onSelectOrderType?.(option.id)}
            >
              {option.title}
            </button>
          );
        })}
      </div>
    </div>
  </section>
);

export default MenuContextStrip;
