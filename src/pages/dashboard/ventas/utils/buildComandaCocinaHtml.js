const TICKET_WIDTH_MM = 80;
const CONTENT_WIDTH_MM = 76;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const toSafeText = (value, fallback = 'N/D') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const toSafeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const formatDateTime = (value) => {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return toSafeText(value, 'N/D');
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

const normalizeDetailList = (items, mapItem) => (
  Array.isArray(items) ? items : []
).map(mapItem).filter(Boolean);

const getSnapshotSalsas = (item) => {
  const componentes = item?.origen_snapshot?.componentes;
  if (Array.isArray(componentes)) return componentes;
  if (Array.isArray(componentes?.seleccion)) return componentes.seleccion;

  const complementos = item?.origen_snapshot?.complementos;
  if (Array.isArray(complementos)) return complementos;
  if (Array.isArray(complementos?.seleccion)) return complementos.seleccion;

  return [];
};

const resolveItemComplementos = (item) => {
  const directComplementos = normalizeDetailList(item?.complementos, (complemento, complementoIndex) => ({
    key: `${complemento?.id_complemento || complementoIndex}-${complementoIndex}`,
    nombre: toSafeText(complemento?.nombre, 'Salsa')
  }));
  if (directComplementos.length > 0) return directComplementos;

  const snapshotComponentes = normalizeDetailList(getSnapshotSalsas(item), (componente, componenteIndex) => ({
    key: `${componente?.id_complemento || componenteIndex}-${componenteIndex}`,
    nombre: toSafeText(componente?.nombre, 'Salsa')
  }));
  return snapshotComponentes;
};

const renderTags = (title, items = [], valueBuilder) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `
    <div class="comanda-cocina-print__tags">
      ${items.map((item) => `
        <div class="comanda-cocina-print__tag">
          <span class="comanda-cocina-print__tag-title">${escapeHtml(title)}:</span>
          <span>${valueBuilder(item)}</span>
        </div>
      `).join('')}
    </div>
  `;
};

const renderTagSummary = (title, items = [], valueBuilder) => {
  if (!Array.isArray(items) || items.length === 0) return '';
  return `
    <div class="comanda-cocina-print__tags">
      <div class="comanda-cocina-print__tag">
        <span class="comanda-cocina-print__tag-title">${escapeHtml(title)}:</span>
        <span>${escapeHtml(items.map(valueBuilder).join(', '))}</span>
      </div>
    </div>
  `;
};

const normalizeComandaItems = (comanda) => normalizeDetailList(comanda?.items, (item, index) => {
  const cantidad = Math.max(1, toSafeNumber(item?.cantidad, 1));
  const nombreItem = toSafeText(item?.nombre_item || item?.nombre_producto, 'Item');
  const isStandaloneExtra = Boolean(item?.es_linea_extra_independiente || item?.origen_snapshot?.es_linea_extra_independiente);
  const extras = isStandaloneExtra
    ? []
    : normalizeDetailList(item?.extras, (extra, extraIndex) => ({
    key: `${extra?.id_extra || extraIndex}-${extraIndex}`,
    nombre: toSafeText(extra?.nombre || extra?.nombre_extra, 'Extra'),
    cantidad: Math.max(1, toSafeNumber(extra?.cantidad, 1))
  }));
  const complementos = resolveItemComplementos(item);
  const observacion = String(item?.observacion || item?.nota_cocina || item?.nota || '').trim();

  return {
    key: `${item?.id_detalle || index}-${index}`,
    cantidad,
    nombreItem,
    extras,
    complementos,
    observacion
  };
});

export const validateComandaForPrint = (comanda) => {
  const items = normalizeComandaItems(comanda);
  if (items.length === 0) {
    return {
      ok: false,
      message: 'La comanda no tiene productos para imprimir.',
      items: []
    };
  }

  return {
    ok: true,
    message: '',
    items
  };
};

export const buildComandaCocinaHtml = (comanda) => {
  const validation = validateComandaForPrint(comanda);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const items = validation.items;
  const fecha = formatDateTime(comanda?.fecha_hora_pedido || comanda?.fecha_hora_facturacion);
  const numeroPedido = toSafeText(comanda?.numero_pedido || comanda?.numero_venta || comanda?.codigo_venta);
  const sucursal = toSafeText(comanda?.nombre_sucursal, 'No registrada');
  const cajero = toSafeText(comanda?.nombre_usuario, 'No registrado');
  const modalidad = toSafeText(comanda?.modalidad || comanda?.canal, 'No registrada');
  const mesa = toSafeText(
    comanda?.mesa_nombre ||
    comanda?.nombre_mesa ||
    comanda?.mesa ||
    comanda?.delivery?.mesa ||
    comanda?.contexto?.mesa,
    'N/D'
  );
  const cliente = toSafeText(comanda?.cliente_nombre || comanda?.contacto?.nombre_contacto, 'N/D');
  const telefonoCliente = toSafeText(comanda?.contacto?.telefono_contacto, '');
  const notaGeneral = String(
    comanda?.observaciones ||
    comanda?.observacion ||
    comanda?.nota_cocina ||
    comanda?.contexto?.observacion_contexto ||
    ''
  ).trim();

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Comanda cocina</title>
    <style>
      @page { size: ${TICKET_WIDTH_MM}mm auto; margin: 2mm; }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111;
        font-family: Arial, sans-serif;
      }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .comanda-cocina-print-root {
        width: ${CONTENT_WIDTH_MM}mm;
        margin: 0 auto;
      }
      .comanda-cocina-print {
        width: 100%;
        font-size: 13px;
        line-height: 1.4;
        font-weight: 500;
      }
      .comanda-cocina-print__header {
        text-align: center;
        margin-bottom: 8px;
      }
      .comanda-cocina-print__header h1 {
        margin: 0 0 5px;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.06em;
      }
      .comanda-cocina-print__header strong {
        display: block;
        font-size: 17px;
        margin-bottom: 5px;
      }
      .comanda-cocina-print__header span {
        display: block;
        font-size: 14px;
      }
      .comanda-cocina-print__divider {
        border-top: 1px dashed #111;
        margin: 9px 0;
      }
      .comanda-cocina-print__meta {
        display: grid;
        gap: 5px;
      }
      .comanda-cocina-print__meta-row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: flex-start;
      }
      .comanda-cocina-print__meta-row span:first-child {
        font-weight: 700;
        min-width: 24mm;
      }
      .comanda-cocina-print__meta-row span:last-child {
        text-align: right;
      }
      .comanda-cocina-print__items {
        display: grid;
        gap: 8px;
      }
      .comanda-cocina-print__item {
        border-bottom: 1px dashed #ccc;
        padding-bottom: 7px;
      }
      .comanda-cocina-print__item-head {
        display: flex;
        gap: 8px;
        align-items: baseline;
      }
      .comanda-cocina-print__qty {
        font-size: 22px;
        line-height: 1;
        font-weight: 800;
        min-width: 14mm;
      }
      .comanda-cocina-print__name {
        font-size: 19px;
        line-height: 1.15;
        font-weight: 800;
        text-transform: uppercase;
      }
      .comanda-cocina-print__tags,
      .comanda-cocina-print__notes {
        margin-top: 5px;
        padding-left: 14mm;
        display: grid;
        gap: 4px;
      }
      .comanda-cocina-print__tag,
      .comanda-cocina-print__note {
        font-size: 13px;
        line-height: 1.35;
      }
      .comanda-cocina-print__tag-title,
      .comanda-cocina-print__note-title {
        font-weight: 700;
      }
      .comanda-cocina-print__general-note {
        margin-top: 10px;
        font-size: 14px;
        line-height: 1.35;
        font-weight: 700;
        text-transform: uppercase;
      }
    </style>
  </head>
  <body>
    <section class="comanda-cocina-print-root">
      <article class="comanda-cocina-print">
        <header class="comanda-cocina-print__header">
          <h1>COMANDA COCINA</h1>
          <strong>${escapeHtml(numeroPedido)}</strong>
          <span>${escapeHtml(fecha)}</span>
        </header>

        <div class="comanda-cocina-print__divider"></div>

        <div class="comanda-cocina-print__meta">
          <div class="comanda-cocina-print__meta-row">
            <span>Sucursal</span>
            <span>${escapeHtml(sucursal)}</span>
          </div>
          <div class="comanda-cocina-print__meta-row">
            <span>Cajero</span>
            <span>${escapeHtml(cajero)}</span>
          </div>
          <div class="comanda-cocina-print__meta-row">
            <span>Modalidad</span>
            <span>${escapeHtml(modalidad)}</span>
          </div>
          <div class="comanda-cocina-print__meta-row">
            <span>Mesa</span>
            <span>${escapeHtml(mesa)}</span>
          </div>
          <div class="comanda-cocina-print__meta-row">
            <span>Cliente</span>
            <span>${escapeHtml(cliente)}</span>
          </div>
          ${telefonoCliente ? `
          <div class="comanda-cocina-print__meta-row">
            <span>Telefono</span>
            <span>${escapeHtml(telefonoCliente)}</span>
          </div>` : ''}
        </div>

        <div class="comanda-cocina-print__divider"></div>

        <div class="comanda-cocina-print__items">
          ${items.map((item) => `
            <section class="comanda-cocina-print__item">
              <div class="comanda-cocina-print__item-head">
                <span class="comanda-cocina-print__qty">${escapeHtml(item.cantidad)}x</span>
                <span class="comanda-cocina-print__name">${escapeHtml(item.nombreItem)}</span>
              </div>
              ${renderTags('Extra', item.extras, (extra) => `${escapeHtml(extra.nombre)} x${escapeHtml(extra.cantidad)}`)}
              ${renderTagSummary(item.complementos.length === 1 ? 'Salsa' : 'Salsas', item.complementos, (complemento) => complemento.nombre)}
              ${item.observacion ? `
                <div class="comanda-cocina-print__notes">
                  <div class="comanda-cocina-print__note">
                    <span class="comanda-cocina-print__note-title">Nota:</span>
                    <span>${escapeHtml(item.observacion)}</span>
                  </div>
                </div>
              ` : ''}
            </section>
          `).join('')}
        </div>

        ${notaGeneral ? `
          <div class="comanda-cocina-print__divider"></div>
          <div class="comanda-cocina-print__general-note">
            Nota cocina: ${escapeHtml(notaGeneral)}
          </div>
        ` : ''}
      </article>
    </section>
  </body>
</html>
  `.trim();
};

export default buildComandaCocinaHtml;
