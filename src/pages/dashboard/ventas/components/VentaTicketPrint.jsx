import {
  formatCurrency,
  formatDateLabel,
  formatDiscountPercent,
  formatTimeLabel,
  getLineDiscountPercent,
  roundMoney
} from '../utils/ventasHelpers';

const DEFAULT_BUSINESS_NAME = "JONNY'S WINGS";
const CONSUMIDOR_FINAL = 'Consumidor final';
const DEFAULT_FOOTER = 'Gracias por su compra';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const cleanText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
};

const sanitizeWidth = (paperWidth) => (Number(paperWidth) === 58 ? 58 : 80);
const flag = (value, fallback) => (value === undefined || value === null ? fallback : Boolean(value));

const getExtraSubtotal = (extra) => {
  const subtotal = toNumber(extra?.subtotal);
  if (subtotal > 0) return subtotal;
  return toNumber(extra?.precio_unitario ?? extra?.precio) * toNumber(extra?.cantidad);
};

const getItemExtrasSubtotal = (item) => {
  const extras = Array.isArray(item?.extras) ? item.extras : [];
  return extras.reduce((sum, extra) => sum + getExtraSubtotal(extra), 0);
};

const formatExtraTicketLabel = (extra) => {
  const name = cleanText(extra?.nombre || extra?.nombre_extra) || 'Extra';
  return `${name} x${toNumber(extra?.cantidad)} ${formatCurrency(getExtraSubtotal(extra))}`;
};

const resolveFacturaDateTime = (venta) =>
  venta?.fecha_hora_facturacion || venta?.fecha_hora_pedido || null;

const resolveTotals = (venta) => {
  const descuento = toNumber(venta?.descuento_total);
  const baseSubtotal = Array.isArray(venta?.items)
    ? venta.items.reduce((sum, item) => sum + toNumber(item?.sub_total), 0)
    : 0;
  const extrasSubtotal = Array.isArray(venta?.items)
    ? venta.items.reduce((sum, item) => sum + getItemExtrasSubtotal(item), 0)
    : 0;
  const itemsSubtotal = baseSubtotal + extrasSubtotal;
  const subtotal = itemsSubtotal || toNumber(venta?.subtotal_bruto || (toNumber(venta?.sub_total) + descuento));
  const total = toNumber(venta?.total);

  return {
    baseSubtotal,
    extrasSubtotal,
    subtotal,
    descuento,
    total
  };
};

const parseSnapshot = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const buildFacturacionView = (venta, fallbackName) => {
  const fromFacturacion = venta?.facturacion && typeof venta.facturacion === 'object'
    ? venta.facturacion
    : null;
  const fromSnapshot = parseSnapshot(venta?.facturacion_snapshot);

  const source = fromFacturacion || fromSnapshot || {};
  const emisor = source?.emisor && typeof source.emisor === 'object' ? source.emisor : {};
  const ticket = source?.ticket && typeof source.ticket === 'object' ? source.ticket : {};

  const nombreEmisor =
    cleanText(emisor?.nombre_emisor) ||
    cleanText(venta?.nombre_emisor) ||
    cleanText(fallbackName) ||
    DEFAULT_BUSINESS_NAME;

  return {
    emisor: {
      nombre_emisor: nombreEmisor,
      rtn_emisor: cleanText(emisor?.rtn_emisor) || cleanText(venta?.rtn_emisor),
      direccion_emisor: cleanText(emisor?.direccion_emisor) || cleanText(venta?.sucursal_direccion),
      telefono_emisor: cleanText(emisor?.telefono_emisor) || cleanText(venta?.sucursal_telefono),
      correo_emisor: cleanText(emisor?.correo_emisor) || cleanText(venta?.sucursal_correo),
      logo_url: cleanText(emisor?.logo_url) || cleanText(venta?.logo_url)
    },
    ticket: {
      ancho_ticket_mm: Number(ticket?.ancho_ticket_mm) === 58 || Number(venta?.ancho_ticket_mm) === 58 ? 58 : 80,
      mostrar_logo_ticket:
        ticket?.mostrar_logo_ticket !== undefined
          ? Boolean(ticket?.mostrar_logo_ticket)
          : Boolean(venta?.mostrar_logo_ticket),
      mostrar_rtn:
        ticket?.mostrar_rtn !== undefined
          ? Boolean(ticket?.mostrar_rtn)
          : true,
      mostrar_direccion:
        ticket?.mostrar_direccion !== undefined
          ? Boolean(ticket?.mostrar_direccion)
          : true,
      mostrar_telefono:
        ticket?.mostrar_telefono !== undefined
          ? Boolean(ticket?.mostrar_telefono)
          : true,
      mostrar_correo:
        ticket?.mostrar_correo !== undefined
          ? Boolean(ticket?.mostrar_correo)
          : false,
      mostrar_datos_fiscales: flag(ticket?.mostrar_datos_fiscales, true),
      mostrar_cai_ticket: flag(ticket?.mostrar_cai_ticket, true),
      mostrar_numero_fiscal_ticket: flag(ticket?.mostrar_numero_fiscal_ticket, true),
      mostrar_codigo_interno_ticket: flag(ticket?.mostrar_codigo_interno_ticket, true),
      mostrar_impuestos_ticket: flag(ticket?.mostrar_impuestos_ticket, false),
      mostrar_importe_exento: flag(ticket?.mostrar_importe_exento, false),
      mostrar_importe_gravado_15: flag(ticket?.mostrar_importe_gravado_15, false),
      mostrar_isv_15: flag(ticket?.mostrar_isv_15, false),
      mostrar_importe_gravado_18: flag(ticket?.mostrar_importe_gravado_18, false),
      mostrar_isv_18: flag(ticket?.mostrar_isv_18, false),
      mostrar_total_isv: flag(ticket?.mostrar_total_isv, false),
      mostrar_descuento_linea: flag(ticket?.mostrar_descuento_linea, true),
      mostrar_descuento_porcentaje_linea: flag(ticket?.mostrar_descuento_porcentaje_linea, true),
      mostrar_descuento_total: flag(ticket?.mostrar_descuento_total, true),
      texto_encabezado_ticket:
        cleanText(ticket?.texto_encabezado_ticket) || cleanText(venta?.texto_encabezado_ticket),
      texto_pie_ticket:
        cleanText(ticket?.texto_pie_ticket) || cleanText(venta?.texto_pie_ticket) || DEFAULT_FOOTER
    },
    fiscal: {
      cai: '0',
      numero_factura_fiscal: '0',
      modo_fiscal: 'NO_INTEGRADO'
    }
  };
};

export default function VentaTicketPrint({
  venta,
  paperWidth = 80,
  showLogo = true,
  businessName = DEFAULT_BUSINESS_NAME
}) {
  const facturacion = buildFacturacionView(venta, businessName);
  const width = sanitizeWidth(paperWidth || facturacion.ticket.ancho_ticket_mm);
  const ticketDateTime = resolveFacturaDateTime(venta);
  const items = Array.isArray(venta?.items) ? venta.items : [];
  const totals = resolveTotals(venta);
  const showFiscalBlock = facturacion.ticket.mostrar_datos_fiscales && (
    facturacion.ticket.mostrar_cai_ticket ||
    facturacion.ticket.mostrar_numero_fiscal_ticket ||
    facturacion.ticket.mostrar_codigo_interno_ticket
  );
  const showTaxes = facturacion.ticket.mostrar_impuestos_ticket;

  const efectivoEntregado = toNumber(venta?.efectivo_entregado);
  const cambio = toNumber(venta?.cambio);

  const clienteRtn = cleanText(venta?.cliente_rtn || venta?.rtn);
  const banco = cleanText(venta?.banco);
  const codigoTransaccion = cleanText(venta?.codigo_transaccion || venta?.referencia);
  const cajaLabel = cleanText(venta?.nombre_caja || venta?.codigo_caja || venta?.id_caja);
  const sesionCajaLabel = cleanText(venta?.codigo_sesion_caja || venta?.id_sesion_caja);
  const logoSource = facturacion.emisor.logo_url || null;

  return (
    <section
      className={`venta-ticket-print-root venta-ticket-print-root--${width}mm`}
      aria-hidden="true"
      data-ticket-print="true"
    >
      <div className="venta-ticket-print">
        <header className="venta-ticket-print__header">
          {showLogo && facturacion.ticket.mostrar_logo_ticket && logoSource ? (
            <img
              src={logoSource}
              alt="Logo emisor"
              className="venta-ticket-print__logo"
              loading="lazy"
            />
          ) : null}
          <h3>{facturacion.emisor.nombre_emisor}</h3>
          <p>Comprobante interno de venta</p>
          {facturacion.ticket.texto_encabezado_ticket ? <p>{facturacion.ticket.texto_encabezado_ticket}</p> : null}
        </header>

        <div className="venta-ticket-print__divider" />

        <dl className="venta-ticket-print__meta">
          {facturacion.ticket.mostrar_datos_fiscales && facturacion.ticket.mostrar_rtn ? <div><dt>RTN emisor:</dt><dd>{facturacion.emisor.rtn_emisor || '--'}</dd></div> : null}
          {facturacion.ticket.mostrar_direccion ? <div><dt>Direccion:</dt><dd>{facturacion.emisor.direccion_emisor || '--'}</dd></div> : null}
          {facturacion.ticket.mostrar_telefono ? <div><dt>Contacto:</dt><dd>{facturacion.emisor.telefono_emisor || '--'}</dd></div> : null}
          {facturacion.ticket.mostrar_correo ? <div><dt>Correo:</dt><dd>{facturacion.emisor.correo_emisor || '--'}</dd></div> : null}
        </dl>

        {showFiscalBlock ? (
          <>
            <div className="venta-ticket-print__divider" />
            <dl className="venta-ticket-print__meta">
              {facturacion.ticket.mostrar_cai_ticket ? <div><dt>CAI:</dt><dd>{facturacion.fiscal.cai}</dd></div> : null}
              {facturacion.ticket.mostrar_numero_fiscal_ticket ? <div><dt>No. fiscal:</dt><dd>{facturacion.fiscal.numero_factura_fiscal}</dd></div> : null}
              {facturacion.ticket.mostrar_codigo_interno_ticket ? <div><dt>Codigo interno:</dt><dd>{venta?.codigo_venta || venta?.numero_venta || '--'}</dd></div> : null}
            </dl>
          </>
        ) : null}

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
            <span>Neto</span>
          </div>
          {items.length ? (
            items.map((item, index) => {
              const subtotalLinea = toNumber(item?.sub_total);
              const descuentoLinea = toNumber(item?.descuento || item?.descuento_linea);
              const extras = Array.isArray(item?.extras) ? item.extras : [];
              const extrasSubtotal = getItemExtrasSubtotal(item);
              const netoLinea = roundMoney(Math.max(subtotalLinea - descuentoLinea, 0) + extrasSubtotal);
              const descuentoPorcentaje = getLineDiscountPercent(item);
              return (
                <div className="venta-ticket-print__item-row-wrap" key={`${item?.id_detalle || 'line'}-${index}`}>
                  <div className="venta-ticket-print__item-row">
                    <span>{toNumber(item?.cantidad)}</span>
                    <span>{item?.nombre_item || item?.nombre_producto || 'Item'}</span>
                    <span>{formatCurrency(item?.precio_unitario)}</span>
                    <span>{formatCurrency(netoLinea)}</span>
                  </div>
                  {descuentoPorcentaje !== null && facturacion.ticket.mostrar_descuento_linea && facturacion.ticket.mostrar_descuento_porcentaje_linea ? (
                    <div className="venta-ticket-print__item-row-note">
                      <span>Desc. {formatDiscountPercent(descuentoPorcentaje)}</span>
                    </div>
                  ) : null}
                  {extras.length > 0 ? (
                    <div className="venta-ticket-print__item-row-note">
                      <span>Extras: {extras.map(formatExtraTicketLabel).join(', ')}</span>
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
          {totals.extrasSubtotal > 0 ? (
            <>
              <div><dt>Base items</dt><dd>{formatCurrency(totals.baseSubtotal)}</dd></div>
              <div><dt>Extras</dt><dd>{formatCurrency(totals.extrasSubtotal)}</dd></div>
            </>
          ) : null}
          <div><dt>Subtotal</dt><dd>{formatCurrency(totals.subtotal)}</dd></div>
          {totals.descuento > 0 && facturacion.ticket.mostrar_descuento_total ? <div><dt>Descuento</dt><dd>-{formatCurrency(totals.descuento)}</dd></div> : null}
          {showTaxes && facturacion.ticket.mostrar_importe_exento ? <div><dt>Importe exento</dt><dd>{formatCurrency(venta?.exento)}</dd></div> : null}
          {showTaxes && facturacion.ticket.mostrar_importe_gravado_15 ? <div><dt>Importe gravado 15%</dt><dd>{formatCurrency(venta?.gravado_15)}</dd></div> : null}
          {showTaxes && facturacion.ticket.mostrar_isv_15 ? <div><dt>ISV 15%</dt><dd>{formatCurrency(venta?.isv_15)}</dd></div> : null}
          {showTaxes && facturacion.ticket.mostrar_importe_gravado_18 ? <div><dt>Importe gravado 18%</dt><dd>{formatCurrency(venta?.gravado_18)}</dd></div> : null}
          {showTaxes && facturacion.ticket.mostrar_isv_18 ? <div><dt>ISV 18%</dt><dd>{formatCurrency(venta?.isv_18)}</dd></div> : null}
          {showTaxes && facturacion.ticket.mostrar_total_isv ? <div><dt>Total ISV</dt><dd>{formatCurrency(venta?.total_isv)}</dd></div> : null}
          <div className="is-total"><dt>Total</dt><dd>{formatCurrency(totals.total)}</dd></div>
          {efectivoEntregado > 0 ? (
            <div><dt>Efectivo</dt><dd>{formatCurrency(efectivoEntregado)}</dd></div>
          ) : null}
          {cambio > 0 ? <div><dt>Cambio</dt><dd>{formatCurrency(cambio)}</dd></div> : null}
        </dl>

        <div className="venta-ticket-print__divider" />

        <p className="venta-ticket-print__thanks">{facturacion.ticket.texto_pie_ticket || DEFAULT_FOOTER}</p>
      </div>
    </section>
  );
}
