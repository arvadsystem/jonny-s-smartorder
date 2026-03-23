import OrderTypeCard from '../components/order-type/OrderTypeCard';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS } from '../types/publicMenuTypes';

// Step 2: customer defines order type and sees payment method copy.
const OrderTypeScreen = () => {
  const { state, actions } = usePublicMenuFlow();
  const selectedOption = PUBLIC_MENU_ORDER_TYPE_OPTIONS.find(
    (option) => option.id === state.orderType
  );

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
    </section>
  );
};

export default OrderTypeScreen;

