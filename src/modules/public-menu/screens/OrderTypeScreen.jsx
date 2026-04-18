import { useEffect } from 'react';
import OrderTypeCard from '../components/order-type/OrderTypeCard';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS } from '../types/publicMenuTypes';

const normalizeTableInput = (value, maxLength = 40) =>
  String(value ?? '')
    .trimStart()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);

// Step 2: customer defines order type and sees payment method copy.
const OrderTypeScreen = () => {
  const { state, actions } = usePublicMenuFlow();
  const branchId = state.selectedBranch?.id;
  const selectedOption = PUBLIC_MENU_ORDER_TYPE_OPTIONS.find(
    (option) => option.id === state.orderType
  );
  const needsTable = state.orderType === 'dine-in';
  const dineInTable = String(state.dineInTable || '');

  // Prefetch del catalogo para que la transicion a /menu sea mas rapida.
  useEffect(() => {
    if (!branchId || !state.orderType) return;
    void publicMenuBootstrapService.getCatalog({
      idSucursal: branchId,
      orderType: state.orderType
    }).catch(() => {});
  }, [branchId, state.orderType]);

  return (
    <section className="pm-screen" aria-label="Tipo de pedido">
      <div className="pm-screen__intro">
        <h2 className="pm-screen__title">Como quieres pedir hoy?</h2>
        <p className="pm-screen__subtitle">
          Esto define el metodo de pago y datos que te pediremos en checkout.
        </p>
      </div>

      <div className="pm-screen__list">
        {PUBLIC_MENU_ORDER_TYPE_OPTIONS.map((option) => (
          <OrderTypeCard
            key={option.id}
            option={option}
            selected={state.orderType === option.id}
            onSelect={(nextOrderType) => actions.selectOrderType(nextOrderType)}
          />
        ))}
      </div>

      {selectedOption ? (
        <aside className="pm-info-highlight">
          <h3 className="pm-info-highlight__title">Metodo de pago para esta opcion</h3>
          <p className="pm-info-highlight__content">{selectedOption.paymentCopy}</p>
        </aside>
      ) : null}

      {needsTable ? (
        <aside className="pm-info-highlight" aria-label="Mesa para comer en restaurante">
          <h3 className="pm-info-highlight__title">Numero de mesa</h3>
          <p className="pm-info-highlight__content">
            Este dato es obligatorio para enviar pedidos de comer en restaurante.
          </p>
          <div className="pm-order-type-table">
            <input
              type="text"
              className="form-control"
              placeholder="Ejemplo: Mesa 7"
              value={dineInTable}
              onChange={(event) => actions.setDineInTable(normalizeTableInput(event.target.value))}
              maxLength={40}
              autoComplete="off"
            />
            {!dineInTable.trim() ? (
              <small className="pm-order-type-table__error">
                Ingresa tu numero de mesa para continuar.
              </small>
            ) : null}
          </div>
        </aside>
      ) : null}
    </section>
  );
};

export default OrderTypeScreen;
