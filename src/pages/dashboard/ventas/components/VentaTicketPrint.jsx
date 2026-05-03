import logoJonnys from '../../../../assets/images/logo-jonnys.png';
import { formatCurrency, formatDateLabel, formatTimeLabel, roundMoney } from '../utils/ventasHelpers';

const DEFAULT_BUSINESS_NAME = "JONNY'S WINGS";
const CONSUMIDOR_FINAL = 'Consumidor final';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
};

const sanitizeWidth = (paperWidth) => (Number(paperWidth) === 58 ? 58 : 80);

const resolveFacturaDateTime = (venta) =>
  venta?.fecha_hora_facturacion || venta?.fecha_hora_pedido || null;

const resolveFiscalRange = (venta) => {
  const desde = cleanText(venta?.numero_desde);
  const hasta = cleanText(venta?.numero_hasta);
  if (desde && hasta) return `${desde} - ${hasta}`;
  if (desde || hasta) return `${desde || '--'} - ${hasta || '--'}`;
  return '000-000 / --';
};

const resolveBusinessName = (venta, fallbackName) =>
  cleanText(venta?.nombre_emisor) || cleanText(fallbackName) || DEFAULT_BUSINESS_NAME;

const resolveTotals = (venta) => {
  const subtotal = toNumber(venta?.sub_total);
  const descuento = toNumber(venta?.descuento_total);
  const exento = toNumber(venta?.exento);
  const gravado15 = toNumber(venta?.gravado_15 || subtotal);
  const isv15 = toNumber(venta?.isv_15 || venta?.isv);
  const gravado18 = toNumber(venta?.gravado_18);
  const isv18 = toNumber(venta?.isv_18);
  const totalIsv = toNumber(venta?.total_isv || (isv15 + isv18));
  const total = toNumber(venta?.total);

  return {
    subtotal,
    descuento,
    exento,
    gravado15,
    isv15,
    gravado18,
    isv18,
    totalIsv,
    total
  };
};

export default function VentaTicketPrint({
  venta,
  paperWidth = 80,
  showLogo = true,
  businessName = DEFAULT_BUSINESS_NAME
}) {
  const width = sanitizeWidth(paperWidth);
  const ticketDateTime = resolveFacturaDateTime(venta);
  const items = Array.isArray(venta?.items) ? venta.items : [];
  const totals = resolveTotals(venta);

  const efectivoEntregado = toNumber(venta?.efectivo_entregado);
  const cambio = toNumber(venta?.cambio);

  const nombreEmisor = resolveBusinessName(venta, businessName);
  const rtnEmisor = cleanText(venta?.rtn_emisor);
  const sucursalDireccion = cleanText(venta?.sucursal_direccion);
  const sucursalTelefono = cleanText(venta?.sucursal_telefono);
  const sucursalCorreo = cleanText(venta?.sucursal_correo);

  const cai = cleanText(venta?.cai) || '--';
  const rangoAutorizado = resolveFiscalRange(venta);
  const fechaLimiteEmision = venta?.fecha_limite_emision ? formatDateLabel(venta.fecha_limite_emision) : '--';

  const clienteRtn = cleanText(venta?.cliente_rtn || venta?.rtn);
  const banco = cleanText(venta?.banco);
  const codigoTransaccion = cleanText(venta?.codigo_transaccion || venta?.referencia);
  const cajaLabel = cleanText(venta?.nombre_caja || venta?.codigo_caja || venta?.id_caja);
  const sesionCajaLabel = cleanText(venta?.codigo_sesion_caja || venta?.id_sesion_caja);

  return (
    <section
      className={`venta-ticket-print-root venta-ticket-print-root--${width}mm`}
      aria-hidden="true"
      data-ticket-print="true"
    >
      <div className="venta-ticket-print">
        <header className="venta-ticket-print__header">
          {showLogo ? (
            <img
              src={logoJonnys}
              alt="Logo Jonnys"
              className="venta-ticket-print__logo"
              loading="lazy"
            />
          ) : null}
          <h3>{nombreEmisor}</h3>
          <p>Comprobante interno de venta</p>
        </header>

        <div className="venta-ticket-print__divider" />

        <dl className="venta-ticket-print__meta">
          <div><dt>RTN emisor:</dt><dd>{rtnEmisor || '--'}</dd></div>
          <div><dt>Direccion:</dt><dd>{sucursalDireccion || '--'}</dd></div>
          <div><dt>Contacto:</dt><dd>{sucursalTelefono || '--'}</dd></div>
          <div><dt>Correo:</dt><dd>{sucursalCorreo || '--'}</dd></div>
        </dl>

        <div className="venta-ticket-print__divider" />

        <dl className="venta-ticket-print__meta">
          <div><dt>CAI:</dt><dd>{cai}</dd></div>
          <div><dt>Rango autorizado:</dt><dd>{rangoAutorizado}</dd></div>
          <div><dt>Fecha limite emision:</dt><dd>{fechaLimiteEmision}</dd></div>
          <div><dt>No. fiscal:</dt><dd>{cleanText(venta?.numero_factura_fiscal) || '--'}</dd></div>
          <div><dt>Codigo interno:</dt><dd>{venta?.codigo_venta || venta?.numero_venta || '--'}</dd></div>
        </dl>

        <div className="venta-ticket-print__divider" />

        <dl className="venta-ticket-print__meta">
          <div><dt>Fecha:</dt><dd>{formatDateLabel(ticketDateTime)}</dd></div>
          <div><dt>Hora:</dt><dd>{formatTimeLabel(ticketDateTime)}</dd></div>
          <div><dt>Sucursal:</dt><dd>{venta?.nombre_sucursal || '--'}</dd></div>
          <div><dt>Caja:</dt><dd>{cajaLabel || '--'}</dd></div>
          <div><dt>Sesion:</dt><dd>{sesionCajaLabel || '--'}</dd></div>
          <div><dt>Cajero:</dt><dd>{venta?.nombre_usuario || '--'}</dd></div>
          <div><dt>Cliente:</dt><dd>{venta?.cliente_nombre || CONSUMIDOR_FINAL}</dd></div>
          <div><dt>RTN cliente:</dt><dd>{clienteRtn || '--'}</dd></div>
          <div><dt>Pago:</dt><dd>{venta?.metodo_pago || '--'}</dd></div>
          {banco ? <div><dt>Banco:</dt><dd>{banco}</dd></div> : null}
          {codigoTransaccion ? <div><dt>Transaccion:</dt><dd>{codigoTransaccion}</dd></div> : null}
        </dl>

        <div className="venta-ticket-print__divider" />

        <div className="venta-ticket-print__items">
          <div className="venta-ticket-print__items-head">
            <span>Cant</span>
            <span>Descripcion</span>
            <span>P.Unit</span>
            <span>Subt</span>
          </div>
          {items.length ? (
            items.map((item, index) => {
              const subtotalLinea = toNumber(item?.sub_total);
              const descuentoLinea = toNumber(item?.descuento || item?.descuento_linea);
              const netoLinea = roundMoney(Math.max(subtotalLinea - descuentoLinea, 0));
              return (
                <div className="venta-ticket-print__item-row-wrap" key={`${item?.id_detalle || 'line'}-${index}`}>
                  <div className="venta-ticket-print__item-row">
                    <span>{toNumber(item?.cantidad)}</span>
                    <span>{item?.nombre_item || item?.nombre_producto || 'Item'}</span>
                    <span>{formatCurrency(item?.precio_unitario)}</span>
                    <span>{formatCurrency(subtotalLinea)}</span>
                  </div>
                  {descuentoLinea > 0 ? (
                    <div className="venta-ticket-print__item-row-note">
                      <span>Descuento linea: {formatCurrency(descuentoLinea)}</span>
                      <span>Neto linea: {formatCurrency(netoLinea)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="venta-ticket-print__item-row">
              <span>-</span>
              <span>Sin items</span>
              <span>-</span>
              <span>-</span>
            </div>
          )}
        </div>

        <div className="venta-ticket-print__divider" />

        <dl className="venta-ticket-print__totals">
          <div><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotal)}</dd></div>
          <div><dt>Descuento</dt><dd>{formatCurrency(totals.descuento)}</dd></div>
          <div><dt>Importe exento</dt><dd>{formatCurrency(totals.exento)}</dd></div>
          <div><dt>Importe gravado 15%</dt><dd>{formatCurrency(totals.gravado15)}</dd></div>
          <div><dt>ISV 15%</dt><dd>{formatCurrency(totals.isv15)}</dd></div>
          <div><dt>Importe gravado 18%</dt><dd>{formatCurrency(totals.gravado18)}</dd></div>
          <div><dt>ISV 18%</dt><dd>{formatCurrency(totals.isv18)}</dd></div>
          <div><dt>Total ISV</dt><dd>{formatCurrency(totals.totalIsv)}</dd></div>
          <div className="is-total"><dt>Total</dt><dd>{formatCurrency(totals.total)}</dd></div>
          {efectivoEntregado > 0 ? (
            <div><dt>Efectivo</dt><dd>{formatCurrency(efectivoEntregado)}</dd></div>
          ) : null}
          {cambio > 0 ? <div><dt>Cambio</dt><dd>{formatCurrency(cambio)}</dd></div> : null}
        </dl>

        <div className="venta-ticket-print__divider" />

        <p className="venta-ticket-print__thanks">Gracias por su compra.</p>
      </div>
    </section>
  );
}
