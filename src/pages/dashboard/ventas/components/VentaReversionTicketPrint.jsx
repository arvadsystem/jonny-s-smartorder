import { formatCurrency, formatDateLabel, formatTimeLabel } from '../utils/ventasHelpers';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeWidth = (paperWidth) => (Number(paperWidth) === 58 ? 58 : 80);

export default function VentaReversionTicketPrint({
  reversion,
  venta,
  paperWidth = 80,
  preview = false
}) {
  const width = sanitizeWidth(paperWidth);
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
          <div><dt>REV:</dt><dd>{reversion?.codigo_reversion || '--'}</dd></div>
          <div><dt>VTA Ref:</dt><dd>{reversion?.codigo_venta || venta?.numero_venta || venta?.codigo_venta || '--'}</dd></div>
          <div><dt>Fecha:</dt><dd>{formatDateLabel(dateRef)}</dd></div>
          <div><dt>Hora:</dt><dd>{formatTimeLabel(dateRef)}</dd></div>
          <div><dt>Sucursal:</dt><dd>{venta?.nombre_sucursal || reversion?.id_sucursal || '--'}</dd></div>
          <div><dt>Caja origen:</dt><dd>{reversion?.id_caja_original || '--'}</dd></div>
          <div><dt>Caja actual:</dt><dd>{reversion?.id_caja_actual || '--'}</dd></div>
          <div><dt>Cajero:</dt><dd>{venta?.nombre_usuario || '--'}</dd></div>
          <div><dt>Tipo:</dt><dd>{reversion?.tipo_reversion || '--'}</dd></div>
          <div><dt>Motivo:</dt><dd>{reversion?.motivo || '--'}</dd></div>
        </dl>

        <div className="venta-reversion-ticket__divider" />

        <div className="venta-reversion-ticket__items">
          <div className="venta-reversion-ticket__items-head">
            <span>Linea</span>
            <span>Cant</span>
            <span>Total</span>
          </div>
          {lines.length ? (
            lines.map((line, idx) => (
              <div className="venta-reversion-ticket__item-row" key={`${line?.id_detalle_factura || idx}-${idx}`}>
                <span>{line?.id_detalle_factura || '-'}</span>
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

        <div className="venta-reversion-ticket__divider" />

        <dl className="venta-reversion-ticket__totals">
          <div className="is-total">
            <dt>Monto reversado</dt>
            <dd>{formatCurrency(reversion?.monto_reversado)}</dd>
          </div>
        </dl>

        <p className="venta-reversion-ticket__notice">
          Documento compensatorio interno asociado a venta original.
        </p>
      </div>
    </section>
  );
}
