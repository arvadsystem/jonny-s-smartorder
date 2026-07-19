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
    return provided || null;
  }
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return null;
};

const resolveFallbackTimestamp = (now) => String(
  typeof now === 'function' ? now() : Date.now()
);

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

  const uniqueValue = resolveUniqueValue(createUniqueValue) || resolveFallbackTimestamp();
  return sourceType === 'pedido'
    ? `comanda:pedido-reprint:${sourceId}:${uniqueValue}`
    : `comanda-reprint:${sourceId}:${uniqueValue}`;
};

export const buildFacturaReprintIdempotencyKey = ({ idFactura, createUniqueValue, now }) => {
  const normalizedId = toPositiveId(idFactura);
  if (!normalizedId) throw new Error('Factura invalida para reimpresion.');
  const uuid = resolveUniqueValue(createUniqueValue);
  return uuid
    ? `reprint:${uuid}`
    : `reprint:${normalizedId}:${resolveFallbackTimestamp(now)}`;
};

export const prepareComandaPrintWindow = ({ agentPrintMode, sourceType, openWindow }) => {
  if (agentPrintMode || sourceType === 'pedido') return null;
  return typeof openWindow === 'function' ? openWindow('Preparando comanda') : null;
};

export const getPrintErrorCode = (error) =>
  String(error?.code || error?.data?.code || '').trim();

export const resolveRecoveredFacturaAgainstCurrentBoard = ({
  currentPedidos,
  idPedido,
  recoveredIdFactura
}) => {
  const normalizedIdPedido = toPositiveId(idPedido);
  const normalizedRecoveredId = toPositiveId(recoveredIdFactura);
  if (!Array.isArray(currentPedidos) || !normalizedIdPedido || !normalizedRecoveredId) {
    return {
      status: 'invalid',
      effectiveIdFactura: null,
      nextPedidos: currentPedidos
    };
  }

  const currentPedido = currentPedidos.find(
    (pedido) => toPositiveId(pedido?.id_pedido) === normalizedIdPedido
  );
  if (!currentPedido) {
    return {
      status: 'missing',
      effectiveIdFactura: null,
      nextPedidos: currentPedidos
    };
  }

  const currentIdFactura = toPositiveId(currentPedido?.id_factura);
  if (currentIdFactura === normalizedRecoveredId) {
    return {
      status: 'same',
      effectiveIdFactura: currentIdFactura,
      nextPedidos: currentPedidos
    };
  }
  if (currentIdFactura) {
    return {
      status: 'conflict',
      effectiveIdFactura: currentIdFactura,
      nextPedidos: currentPedidos
    };
  }

  const nextPedidos = currentPedidos.map((pedido) => {
    if (toPositiveId(pedido?.id_pedido) !== normalizedIdPedido) return pedido;
    return { ...pedido, id_factura: normalizedRecoveredId };
  });

  return {
    status: 'apply-recovered',
    effectiveIdFactura: normalizedRecoveredId,
    nextPedidos
  };
};

export const mergeRecoveredFacturaIntoPedidos = (currentPedidos, { idPedido, idFactura }) =>
  resolveRecoveredFacturaAgainstCurrentBoard({
    currentPedidos,
    idPedido,
    recoveredIdFactura: idFactura
  }).nextPedidos;

export const reconcileRecoveredFacturaDetail = async ({
  getCurrentPedidos,
  idPedido,
  recoveredIdFactura,
  recoveredVenta,
  fetchVenta,
  isCurrent = () => true
}) => {
  if (!isCurrent()) return { status: 'stale' };
  const initial = resolveRecoveredFacturaAgainstCurrentBoard({
    currentPedidos: getCurrentPedidos?.(),
    idPedido,
    recoveredIdFactura
  });

  if (initial.status !== 'conflict') {
    return { ...initial, venta: recoveredVenta };
  }
  if (typeof fetchVenta !== 'function') return { status: 'invalid' };

  const effectiveVenta = await fetchVenta(initial.effectiveIdFactura);
  if (!isCurrent()) return { status: 'stale' };

  const verified = resolveRecoveredFacturaAgainstCurrentBoard({
    currentPedidos: getCurrentPedidos?.(),
    idPedido,
    recoveredIdFactura: initial.effectiveIdFactura
  });
  if (verified.status !== 'same') {
    return {
      status: 'changed',
      effectiveIdFactura: verified.effectiveIdFactura,
      nextPedidos: verified.nextPedidos
    };
  }

  return { ...verified, status: 'conflict', venta: effectiveVenta };
};

export const createDetailOperationController = () => {
  let mounted = true;
  let version = 0;
  let context = { open: false, idPedido: null, sucursalId: null };

  const createSnapshot = () => ({ version, ...context });
  const normalizeSucursalId = (value) => toPositiveId(value);
  const isSnapshotCurrent = (snapshot) => Boolean(
    mounted
    && snapshot
    && snapshot.version === version
    && context.open
    && snapshot.open
    && snapshot.idPedido === context.idPedido
    && snapshot.sucursalId === context.sucursalId
  );

  return {
    mount() {
      mounted = true;
      version += 1;
    },
    openDetail({ idPedido, sucursalId }) {
      version += 1;
      context = {
        open: true,
        idPedido: toPositiveId(idPedido),
        sucursalId: normalizeSucursalId(sucursalId)
      };
      return createSnapshot();
    },
    beginOperation({ idPedido, sucursalId }) {
      version += 1;
      return {
        version,
        open: true,
        idPedido: toPositiveId(idPedido),
        sucursalId: normalizeSucursalId(sucursalId)
      };
    },
    closeDetail() {
      version += 1;
      context = { ...context, open: false, idPedido: null };
    },
    changeSucursal(sucursalId) {
      version += 1;
      context = {
        open: false,
        idPedido: null,
        sucursalId: normalizeSucursalId(sucursalId)
      };
    },
    isCurrent(snapshot) {
      return isSnapshotCurrent(snapshot);
    },
    complete(snapshot) {
      if (!isSnapshotCurrent(snapshot)) return false;
      version += 1;
      return true;
    },
    unmount() {
      mounted = false;
      version += 1;
      context = { ...context, open: false, idPedido: null };
    },
    getState() {
      return { mounted, version, ...context };
    }
  };
};

export const recoverFacturedPedidoPrintSource = async ({
  error,
  idPedido,
  fetchPedidos,
  fetchVenta,
  isCurrent = () => true,
  applyRecovery
}) => {
  if (getPrintErrorCode(error) !== 'PRINT_PEDIDO_SOURCE_INVALID') {
    return { handled: false };
  }

  const normalizedIdPedido = toPositiveId(idPedido);
  if (!normalizedIdPedido || typeof fetchPedidos !== 'function' || typeof fetchVenta !== 'function') {
    return { handled: true, recovered: false, pedidos: [] };
  }

  if (!isCurrent()) return { handled: true, stale: true };

  const pedidosPayload = await fetchPedidos();
  if (!isCurrent()) return { handled: true, stale: true };
  const pedidos = Array.isArray(pedidosPayload) ? pedidosPayload : [];
  const pedido = pedidos.find((item) => toPositiveId(item?.id_pedido) === normalizedIdPedido) || null;
  const idFactura = toPositiveId(pedido?.id_factura);
  if (!idFactura) {
    return { handled: true, recovered: false, pedidos, pedido };
  }

  const venta = await fetchVenta(idFactura);
  if (!isCurrent()) return { handled: true, stale: true };
  const recovery = { handled: true, recovered: true, pedidos, pedido, idFactura, venta };
  if (typeof applyRecovery === 'function' && applyRecovery(recovery) === false) {
    return { handled: true, stale: true };
  }
  return recovery;
};

export const createEmptyPrintErrors = () => ({ factura: '', comanda: '' });

export const setDocumentPrintError = (current, documentType, message) => {
  if (!DOCUMENT_TYPES.has(documentType)) return { ...current };
  return {
    ...createEmptyPrintErrors(),
    ...(current || {}),
    [documentType]: String(message || '')
  };
};

export const enqueueAgentPrintAction = async ({
  ventasApi,
  documentType,
  venta,
  sourceType = 'factura',
  action = 'reprint',
  createUniqueValue,
  now,
  motivo
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
      createUniqueValue,
      now
    });
    const sanitizedMotivo = String(motivo || 'REIMPRESION_MANUAL').slice(0, 120);
    const response = await ventasApi.enqueuePrintJob(
      idFactura,
      {
        tipo_documento: 'factura',
        es_reimpresion: true,
        motivo: sanitizedMotivo
      },
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
