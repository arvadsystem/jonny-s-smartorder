const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const parsePositiveIntegerId = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '' || (typeof normalized === 'string' && !/^\d+$/.test(normalized))) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const resolveAuthenticatedUserIdentity = (user) => {
  if (!user || typeof user !== 'object' || Array.isArray(user)) {
    return { id: null, status: 'missing', fields: [] };
  }

  const fields = ['id_usuario', 'id'].filter((field) => hasOwn(user, field) && user[field] != null);
  const values = fields.map((field) => ({ field, id: parsePositiveIntegerId(user[field]) }));
  const invalidFields = values.filter((entry) => entry.id === null).map((entry) => entry.field);
  if (invalidFields.length > 0) {
    return { id: null, status: 'invalid', fields: invalidFields };
  }

  const distinctIds = [...new Set(values.map((entry) => entry.id))];
  if (distinctIds.length > 1) {
    return { id: null, status: 'conflict', fields, values: distinctIds };
  }

  return distinctIds.length === 1
    ? { id: distinctIds[0], status: 'valid', fields }
    : { id: null, status: 'missing', fields: [] };
};

export const resolveAuthenticatedUserId = (user) => resolveAuthenticatedUserIdentity(user).id;

export const buildPedidoPendienteOperationContext = ({
  userId,
  sucursalId,
  cashSessionId,
  origin = 'SMARTORDER_POS'
} = {}) => ({
  userId: parsePositiveIntegerId(userId),
  sucursalId: parsePositiveIntegerId(sucursalId),
  cashSessionId: parsePositiveIntegerId(cashSessionId),
  origin: String(origin || '').trim().toUpperCase()
});

export const resolvePedidoPendienteContextState = ({
  userId,
  sucursalId,
  cashSessionId,
  loading = false,
  userIdentityStatus = 'valid'
} = {}) => {
  if (loading) {
    return {
      ready: false,
      loading: true,
      code: 'PEDIDO_PENDIENTE_CONTEXT_LOADING',
      message: 'Validando caja y usuario...'
    };
  }

  if (userIdentityStatus === 'conflict') {
    return {
      ready: false,
      loading: false,
      code: 'PEDIDO_PENDIENTE_USUARIO_CONFLICTO',
      message: 'La sesión autenticada contiene identificadores de usuario diferentes. Vuelve a iniciar sesión.'
    };
  }

  if (userIdentityStatus === 'invalid') {
    return {
      ready: false,
      loading: false,
      code: 'PEDIDO_PENDIENTE_USUARIO_INVALIDO',
      message: 'El identificador del usuario autenticado no es válido. Vuelve a iniciar sesión.'
    };
  }

  const context = buildPedidoPendienteOperationContext({ userId, sucursalId, cashSessionId });
  const missing = [];
  if (!context.userId) missing.push('usuario autenticado');
  if (!context.sucursalId) missing.push('sucursal');
  if (!context.cashSessionId) missing.push('sesión de caja activa');

  if (missing.length > 0) {
    return {
      ready: false,
      loading: false,
      code: missing.length === 1 && missing[0] === 'sesión de caja activa'
        ? 'PEDIDO_PENDIENTE_SESION_CAJA_INACTIVA'
        : 'PEDIDO_PENDIENTE_CONTEXT_INCOMPLETO',
      message: `No se puede crear el pedido: falta ${missing.join(', ')}.`,
      missing
    };
  }

  return { ready: true, loading: false, code: '', message: '', context };
};

export const createPedidoPendienteContextError = (state) => {
  const error = new Error(state?.message || 'No se puede crear el pedido con el contexto actual.');
  error.code = state?.code || 'PEDIDO_PENDIENTE_CONTEXT_INCOMPLETO';
  error.missing = Array.isArray(state?.missing) ? state.missing : [];
  return error;
};

export const prepareAndSubmitPedidoPendiente = async ({
  payload,
  operationId = null,
  localContext = null,
  revalidateContext,
  prepareOperation,
  submitOperation,
  onPrepared
}) => {
  const localState = resolvePedidoPendienteContextState({
    userId: localContext?.userId,
    sucursalId: localContext?.sucursalId,
    cashSessionId: localContext?.cashSessionId
  });
  const operationScope = localState.ready ? localState.context : await revalidateContext(payload);
  const operationState = resolvePedidoPendienteContextState({
    userId: operationScope?.userId,
    sucursalId: operationScope?.sucursalId,
    cashSessionId: operationScope?.cashSessionId
  });
  if (!operationState.ready) throw createPedidoPendienteContextError(operationState);
  const refreshedPayload = {
    ...payload,
    id_sucursal: operationState.context.sucursalId,
    id_sesion_caja: operationState.context.cashSessionId
  };
  const operation = prepareOperation(refreshedPayload, { operationId, operationScope: operationState.context });
  onPrepared?.(operation, operationState.context);
  const response = await submitOperation(refreshedPayload, {
    operationId: operation.operationId,
    operationScope: operationState.context
  });
  return { operation, operationScope: operationState.context, payload: refreshedPayload, response };
};
