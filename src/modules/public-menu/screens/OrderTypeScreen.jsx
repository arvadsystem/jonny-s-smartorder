import { useEffect } from 'react';
import OrderTypeCard from '../components/order-type/OrderTypeCard';
import { usePublicMenuFlow } from '../hooks/usePublicMenuFlow';
import { publicMenuBootstrapService } from '../services/publicMenuBootstrapService';
import { PUBLIC_MENU_ORDER_TYPE_OPTIONS } from '../types/publicMenuTypes';

const formatCompactText = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

const buildTransferInfoMessage = ({ account, whatsapp }) => {
  const accountText = formatCompactText(account);
  const whatsappText = formatCompactText(whatsapp);

  return `Debes enviar el comprobante de pago de la cuenta ${
    accountText || 'de la sucursal'
  } al numero de WhatsApp ${whatsappText || 'de la sucursal'}.`;
};

const PICKUP_PAYMENT_OPTIONS = Object.freeze([
  { id: 'caja', label: 'Pago en caja' },
  { id: 'transferencia', label: 'Transferencia' }
]);

// Step 2: customer defines order type and sees payment method copy.
const OrderTypeScreen = () => {
  const { state, actions } = usePublicMenuFlow();
  const branchId = state.selectedBranch?.id;
  const selectedOption = PUBLIC_MENU_ORDER_TYPE_OPTIONS.find(
    (option) => option.id === state.orderType
  );
  const needsPickupPaymentMethod = state.orderType === 'pickup';
  const pickupPaymentMethod = String(state.pickupPaymentMethod || '').trim().toLowerCase();
  const transferAccount = formatCompactText(state.selectedBranch?.transferAccount || '');
  const transferWhatsapp = formatCompactText(state.selectedBranch?.whatsapp || '');
  const transferInfoMessage = buildTransferInfoMessage({
    account: transferAccount,
    whatsapp: transferWhatsapp
  });

  // Prefetch del catalogo para que la transicion a /menu sea mas rapida.
  useEffect(() => {
    if (!branchId || !state.orderType) return;
    void publicMenuBootstrapService.getCatalog({
      idSucursal: branchId,
      orderType: state.orderType
    }).catch(() => {});
  }, [branchId, state.orderType]);

  const handleSelectPickupPaymentMethod = (methodId) => {
    const nextMethod = String(methodId || '').trim().toLowerCase();
    actions.setPickupPaymentMethod(nextMethod);

    // Mostrar instruccion exacta en el mismo clic cuando el cliente elige transferencia.
    if (nextMethod === 'transferencia') {
      actions.pushToast({
        type: 'info',
        durationMs: 7000,
        message: transferInfoMessage
      });
    }
  };

  return (
    <section className="pm-screen pm-order-type-screen" aria-label="Tipo de pedido">
      <div className="pm-screen__intro">
        <span className="pm-screen__eyebrow">Paso 2 de 3</span>
        <h2 className="pm-screen__title">Como quieres pedir hoy?</h2>
        <p className="pm-screen__subtitle">
          Esto define el metodo de pago y los datos que te pediremos para confirmar tu pedido.
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

      {needsPickupPaymentMethod ? (
        <aside className="pm-info-highlight" aria-label="Metodo de pago para retiro en local">
          <h3 className="pm-info-highlight__title">Como deseas pagar tu retiro</h3>
          <p className="pm-info-highlight__content">
            Elige un metodo de pago para confirmar pedidos de retiro en local.
          </p>

          <div className="pm-order-type-payment" role="radiogroup" aria-label="Metodo de pago">
            {PICKUP_PAYMENT_OPTIONS.map((option) => {
              const selected = pickupPaymentMethod === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`pm-order-type-payment__option ${selected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectPickupPaymentMethod(option.id)}
                  aria-pressed={selected}
                >
                  <span className="pm-order-type-payment__dot" aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          {!pickupPaymentMethod ? (
            <small className="pm-order-type-table__error">
              Selecciona un metodo de pago para continuar.
            </small>
          ) : null}

          {pickupPaymentMethod === 'transferencia' ? (
            <small className="pm-order-type-payment__hint">{transferInfoMessage}</small>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
};

export default OrderTypeScreen;
