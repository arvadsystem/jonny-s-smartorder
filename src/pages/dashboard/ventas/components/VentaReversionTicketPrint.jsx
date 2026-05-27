import { formatCurrency, formatDateLabel, formatTimeLabel } from '../utils/ventasHelpers';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeWidth = (paperWidth) => (Number(paperWidth) === 58 ? 58 : 80);
const flag = (value, fallback) => (value === undefined || value === null ? fallback : Boolean(value));

const resolveReversionFlags = (venta) => {
  const ticket = venta?.facturacion?.ticket && typeof venta.facturacion.ticket === 'object'
    ? venta.facturacion.ticket
    : {};
  return {
    imprimir_comprobante_reversion: flag(ticket.imprimir_comprobante_reversion, true),
    mostrar_venta_original_reversion: flag(ticket.mostrar_venta_original_reversion, true),
    mostrar_codigo_reversion: flag(ticket.mostrar_codigo_reversion, true),
    mostrar_usuario_reversion: flag(ticket.mostrar_usuario_reversion, true),
    mostrar_caja_sesion_reversion: flag(ticket.mostrar_caja_sesion_reversion, true),
    mostrar_motivo_reversion: flag(ticket.mostrar_motivo_reversion, true),
    mostrar_detalle_reversion: flag(ticket.mostrar_detalle_reversion, true),
    mostrar_total_reversion: flag(ticket.mostrar_total_reversion, true)
  };
};

export default function VentaReversionTicketPrint({
  reversion,
  venta,
  paperWidth = 80,
  preview = false
}) {
  const width = sanitizeWidth(paperWidth);
  const flags = resolveReversionFlags(venta);
  if (!flags.imprimir_comprobante_reversion) return null;
  const lines = Array.isArray(reversion?.lineas) ? reversion.lineas : [];
  const dateRef =
    reversion?.creada_en ||
    reversion?.fecha_operacion ||
    venta?.fecha_hora_facturacion ||
    venta?.fecha_operacion ||
    null;

  return (
    <section
      className={`venta-reversion-ticket-root venta-reversion-ticket-root--${width}mm${preview ? ' is-preview' : ''}`}
      aria-hidden={preview ? 'false' : 'true'}
      data-ticket-reversion-print="true"
    >
      <div className="venta-reversion-ticket">
        <header className="venta-reversion-ticket__header">
          <h3>COMPROBANTE DE REVERSIÓN</h3>
          <p>NO ES FACTURA</p>
        </header>

        <dl className="venta-reversion-ticket__meta">
          {flags.mostrar_codigo_reversion ? <div><dt>REV:</dt><dd>{reversion?.codigo_reversion || '--'}</dd></div> : null}
          {flags.mostrar_venta_original_reversion ? <div><dt>VTA Ref:</dt><dd>{reversion?.codigo_venta || venta?.numero_venta || venta?.codigo_venta || '--'}</dd></div> : null}
          <div><dt>Fecha:</dt><dd>{formatDateLabel(dateRef)}</dd></div>
          <div><dt>Hora:</dt><dd>{formatTimeLabel(dateRef)}</dd></div>
          <div><dt>Sucursal:</dt><dd>{venta?.nombre_sucursal || reversion?.id_sucursal || '--'}</dd></div>
          {flags.mostrar_caja_sesion_reversion ? <div><dt>Caja origen:</dt><dd>{reversion?.id_caja_original || venta?.nombre_caja || venta?.codigo_caja || '--'}</dd></div> : null}
          {flags.mostrar_caja_sesion_reversion ? <div><dt>Caja actual:</dt><dd>{reversion?.id_caja_actual || venta?.id_sesion_caja || '--'}</dd></div> : null}
          {flags.mostrar_usuario_reversion ? <div><dt>Cajero:</dt><dd>{reversion?.usuario || venta?.nombre_usuario || '--'}</dd></div> : null}
          <div><dt>Tipo:</dt><dd>{reversion?.tipo_reversion || '--'}</dd></div>
          {flags.mostrar_motivo_reversion ? <div><dt>Motivo:</dt><dd>{reversion?.motivo || '--'}</dd></div> : null}
        </dl>

        {flags.mostrar_detalle_reversion ? (
          <>
            <div className="venta-reversion-ticket__divider" />

            <div className="venta-reversion-ticket__items">
              <div className="venta-reversion-ticket__items-head">
                <span>Producto</span>
                <span>Cant</span>
                <span>Total</span>
              </div>
              {lines.length ? (
                lines.map((line, idx) => (
                  <div className="venta-reversion-ticket__item-row" key={`${line?.id_detalle_factura || idx}-${idx}`}>
                    <span>{line?.nombre_item || line?.id_detalle_factura || '-'}</span>
                    <span>{toNumber(line?.cantidad_revertida)}</span>
                    <span>{formatCurrency(line?.total_revertido)}</span>
                  </div>
                ))
              ) : (
                <div className="venta-reversion-ticket__item-row">
                  <span>-</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              )}
            </div>
          </>
        ) : null}

        {flags.mostrar_total_reversion ? (
          <>
            <div className="venta-reversion-ticket__divider" />

            <dl className="venta-reversion-ticket__totals">
              <div className="is-total">
                <dt>Monto reversado</dt>
                <dd>{formatCurrency(reversion?.monto_reversado)}</dd>
              </div>
            </dl>
          </>
        ) : null}

        <p className="venta-reversion-ticket__notice">
          Documento compensatorio interno asociado a venta original.
        </p>
      </div>
    </section>
  );
}
