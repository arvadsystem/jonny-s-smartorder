const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

const toSafeText = (value, fallback = '--') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

export const COMANDA_COCINA_PRINT_CSS = `
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, sans-serif; }
  .comanda-cocina-print-root { width: 72mm; margin: 0 auto; }
  .comanda-cocina-print { width: 100%; font-size: 12px; line-height: 1.35; }
  .comanda-cocina-print__header { text-align: center; margin-bottom: 10px; }
  .comanda-cocina-print__header h1 { margin: 0 0 4px; font-size: 18px; letter-spacing: 0.08em; }
  .comanda-cocina-print__header strong { display: block; font-size: 15px; margin-bottom: 4px; }
  .comanda-cocina-print__divider { border-top: 1px dashed #111; margin: 8px 0; }
  .comanda-cocina-print__meta { display: grid; gap: 4px; }
  .comanda-cocina-print__meta-row { display: flex; justify-content: space-between; gap: 8px; }
  .comanda-cocina-print__meta-row span:first-child { font-weight: 700; }
  .comanda-cocina-print__items { display: grid; gap: 10px; }
  .comanda-cocina-print__item { border-bottom: 1px dashed #ccc; padding-bottom: 8px; }
  .comanda-cocina-print__item-head { display: flex; gap: 8px; align-items: baseline; }
  .comanda-cocina-print__qty { font-size: 18px; font-weight: 700; min-width: 30px; }
  .comanda-cocina-print__name { font-size: 16px; font-weight: 700; }
  .comanda-cocina-print__tags,
  .comanda-cocina-print__notes { margin-top: 4px; padding-left: 38px; display: grid; gap: 3px; }
  .comanda-cocina-print__tag { font-size: 12px; }
  .comanda-cocina-print__note { font-size: 12px; font-weight: 700; text-transform: uppercase; }
`;

export default function ComandaCocina80mm({ comanda }) {
  const items = Array.isArray(comanda?.items) ? comanda.items : [];
  const when = comanda?.fecha_hora_pedido || comanda?.fecha_hora_facturacion || null;

  return (
    <section className="comanda-cocina-print-root">
      <article className="comanda-cocina-print">
        <header className="comanda-cocina-print__header">
          <h1>COMANDA COCINA</h1>
          <strong>{toSafeText(comanda?.numero_pedido || comanda?.numero_venta)}</strong>
          <span>{formatDateTime(when)}</span>
        </header>

        <div className="comanda-cocina-print__divider" />

        <div className="comanda-cocina-print__meta">
          <div className="comanda-cocina-print__meta-row">
            <span>Sucursal</span>
            <span>{toSafeText(comanda?.nombre_sucursal)}</span>
          </div>
          <div className="comanda-cocina-print__meta-row">
            <span>Cajero</span>
            <span>{toSafeText(comanda?.nombre_usuario)}</span>
          </div>
          <div className="comanda-cocina-print__meta-row">
            <span>Modalidad</span>
            <span>{toSafeText(comanda?.modalidad || comanda?.canal)}</span>
          </div>
          <div className="comanda-cocina-print__meta-row">
            <span>Cliente</span>
            <span>{toSafeText(comanda?.cliente_nombre || comanda?.contacto?.nombre_contacto)}</span>
          </div>
        </div>

        <div className="comanda-cocina-print__divider" />

        <div className="comanda-cocina-print__items">
          {items.map((item, index) => (
            <section className="comanda-cocina-print__item" key={`${item?.id_detalle || index}-${index}`}>
              <div className="comanda-cocina-print__item-head">
                <span className="comanda-cocina-print__qty">{Number(item?.cantidad || 0) || 1}x</span>
                <span className="comanda-cocina-print__name">{toSafeText(item?.nombre_item, 'Item')}</span>
              </div>

              {Array.isArray(item?.extras) && item.extras.length > 0 ? (
                <div className="comanda-cocina-print__tags">
                  {item.extras.map((extra, extraIndex) => (
                    <span className="comanda-cocina-print__tag" key={`${extra?.id_extra || extraIndex}-${extraIndex}`}>
                      Extra: {toSafeText(extra?.nombre, 'Extra')} x{Number(extra?.cantidad || 0) || 1}
                    </span>
                  ))}
                </div>
              ) : null}

              {Array.isArray(item?.complementos) && item.complementos.length > 0 ? (
                <div className="comanda-cocina-print__tags">
                  {item.complementos.map((complemento, complementoIndex) => (
                    <span className="comanda-cocina-print__tag" key={`${complemento?.id_complemento || complementoIndex}-${complementoIndex}`}>
                      Complemento: {toSafeText(complemento?.nombre, 'Complemento')}
                    </span>
                  ))}
                </div>
              ) : null}

              {item?.observacion ? (
                <div className="comanda-cocina-print__notes">
                  <span className="comanda-cocina-print__note">Nota: {toSafeText(item.observacion)}</span>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
