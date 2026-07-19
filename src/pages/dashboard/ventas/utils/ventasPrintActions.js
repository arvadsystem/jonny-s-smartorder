const DOCUMENT_TYPES = new Set(['factura', 'comanda']);
const COMANDA_SOURCE_TYPES = new Set(['factura', 'pedido']);
const COMANDA_ACTIONS = new Set(['initial', 'reprint']);
const COMANDA_ORIGINS = new Set(['post-sale', 'pending-order', 'detail']);

const toPositiveId = (value) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveUniqueValue = (createUniqueValue) => {
  if (typeof createUniqueValue === 'function') {
    const provided = String(createUniqueValue() || '').trim();
    if (provided) return provided;
  }
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return String(Date.now());
};

export const createClosedComandaPrompt = () => ({
  open: false,
  venta: null,
  loading: false,
  error: '',
  sourceType: 'factura',
  action: 'initial',
  origin: 'post-sale'
});

export const createComandaPrompt = ({
  venta,
  sourceType,
  action,
  origin,
  open = true
}) => {
  if (!COMANDA_SOURCE_TYPES.has(sourceType)) {
    throw new Error('Origen de comanda invalido.');
  }
  if (!COMANDA_ACTIONS.has(action)) {
    throw new Error('Accion de comanda invalida.');
  }
  if (!COMANDA_ORIGINS.has(origin)) {
    throw new Error('Punto de inicio de comanda invalido.');
  }

  const sourceId = sourceType === 'pedido'
    ? toPositiveId(venta?.id_pedido)
    : toPositiveId(venta?.id_factura);
  if (!sourceId) {
    throw new Error('La comanda no tiene un origen valido para imprimir.');
  }

  return {
    open,
    venta,
    loading: false,
    error: '',
    sourceType,
    action,
    origin
  };
};

export const buildComandaIdempotencyKey = ({
  sourceType,
  action,
  idFactura,
  idPedido,
  createUniqueValue
}) => {
  if (!COMANDA_SOURCE_TYPES.has(sourceType) || !COMANDA_ACTIONS.has(action)) {
    throw new Error('Contexto de comanda invalido.');
  }

  const sourceId = sourceType === 'pedido'
    ? toPositiveId(idPedido)
    : toPositiveId(idFactura);
  if (!sourceId) throw new Error('Origen de comanda invalido.');

  if (action === 'initial') {
    return sourceType === 'pedido'
      ? `comanda:pedido:${sourceId}:inicial`
      : `comanda:${sourceId}:inicial`;
  }

  const uniqueValue = resolveUniqueValue(createUniqueValue);
  return sourceType === 'pedido'
    ? `comanda:pedido-reprint:${sourceId}:${uniqueValue}`
    : `comanda-reprint:${sourceId}:${uniqueValue}`;
};

export const buildFacturaReprintIdempotencyKey = ({ idFactura, createUniqueValue }) => {
  const normalizedId = toPositiveId(idFactura);
  if (!normalizedId) throw new Error('Factura invalida para reimpresion.');
  return `factura-reprint:${normalizedId}:${resolveUniqueValue(createUniqueValue)}`;
};

export const enqueueAgentPrintAction = async ({
  ventasApi,
  documentType,
  venta,
  sourceType = 'factura',
  action = 'reprint',
  createUniqueValue
}) => {
  if (!ventasApi || !DOCUMENT_TYPES.has(documentType)) {
    throw new Error('Accion de impresion invalida.');
  }

  const idFactura = toPositiveId(venta?.id_factura);
  const idPedido = toPositiveId(venta?.id_pedido);

  if (documentType === 'factura') {
    if (!idFactura || action !== 'reprint') {
      throw new Error('Factura invalida para reimpresion.');
    }
    const idempotencyKey = buildFacturaReprintIdempotencyKey({
      idFactura,
      createUniqueValue
    });
    const response = await ventasApi.enqueuePrintJob(
      idFactura,
      { tipo_documento: 'factura', es_reimpresion: true },
      idempotencyKey
    );
    return { response, idempotencyKey, documentType, sourceType: 'factura', action };
  }

  const idempotencyKey = buildComandaIdempotencyKey({
    sourceType,
    action,
    idFactura,
    idPedido,
    createUniqueValue
  });
  const payload = {
    tipo_documento: 'comanda',
    es_reimpresion: action === 'reprint'
  };
  const response = sourceType === 'pedido'
    ? await ventasApi.enqueuePedidoPrintJob(idPedido, payload, idempotencyKey)
    : await ventasApi.enqueuePrintJob(idFactura, payload, idempotencyKey);

  return { response, idempotencyKey, documentType, sourceType, action };
};

export const createDocumentPrintGuard = () => {
  const activeDocuments = new Set();
  return {
    isActive(documentType) {
      return activeDocuments.has(documentType);
    },
    async run(documentType, action) {
      if (!DOCUMENT_TYPES.has(documentType)) {
        throw new Error('Tipo de documento invalido.');
      }
      if (activeDocuments.has(documentType)) {
        return { skipped: true, value: undefined };
      }
      activeDocuments.add(documentType);
      try {
        return { skipped: false, value: await action() };
      } finally {
        activeDocuments.delete(documentType);
      }
    }
  };
};

export const getSafePrintErrorContext = (documentType, error) => ({
  documentType: DOCUMENT_TYPES.has(documentType) ? documentType : 'unknown',
  code: String(error?.code || error?.data?.code || '').trim() || null,
  status: Number(error?.status || error?.data?.status || 0) || null
});
