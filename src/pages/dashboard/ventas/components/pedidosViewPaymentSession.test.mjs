// HOTFIX (sesion de caja en Pedidos): al entrar directo a /dashboard/ventas?tab=pedidos,
// useVentas solo carga el bootstrap de caja cuando activeTab==='caja' y VentasPage nunca
// pasaba selectedSessionId a PedidosView, dejando la sesion en null y bloqueando el cobro
// con el mensaje generico de scope incompleto. PedidosView.jsx es un componente React y
// Node no puede hacer `import` directo de un .jsx sin loader (ver
// VentaRegistrarPagoPedidoModalReconstruction.test.mjs: mismo proyecto, sin jsdom/Testing
// Library). Para probar resolveActivePaymentSessionId con datos reales (no solo por
// inspeccion), se extrae su codigo fuente real y se ejecuta con `new Function` -- es la
// funcion real del archivo, no una reimplementacion en el test. El cableado de
// efectos/estado se prueba leyendo el codigo fuente, mismo patron ya usado en el repo.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/pages/dashboard/ventas/components/PedidosView.jsx'), 'utf8').replace(/\r\n/g, '\n');

const extractFunctionSource = (marker) => {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `No se encontro: ${marker}`);
  const end = source.indexOf('\n};', start);
  assert.notEqual(end, -1, `No se encontro el cierre de: ${marker}`);
  return source.slice(start, end + 3);
};

const resolveActivePaymentSessionId = new Function(`
  ${extractFunctionSource('const toPositiveId = (value) => {')}
  ${extractFunctionSource('export const resolveActivePaymentSessionId = (sesionCaja, { idSucursal, idUsuario } = {}) => {').replace('export const resolveActivePaymentSessionId', 'const resolveActivePaymentSessionId')}
  return resolveActivePaymentSessionId;
`)();

describe('resolveActivePaymentSessionId — validacion de la sesion devuelta por el bootstrap', () => {
  it('Caso 2: sesion abierta, misma sucursal, responsable = usuario autenticado -> acepta id_sesion_caja', () => {
    const sessionId = resolveActivePaymentSessionId(
      {
        id_sesion_caja: 43,
        id_sucursal: 1,
        estado_codigo: 'ABIERTA',
        id_usuario_responsable: 45,
        rol_participacion: 'RESPONSABLE'
      },
      { idSucursal: 1, idUsuario: 45 }
    );
    assert.equal(sessionId, 43);
  });

  it('Caso 4: sin id_sesion_caja -> null (sesion inexistente)', () => {
    assert.equal(resolveActivePaymentSessionId(null, { idSucursal: 1, idUsuario: 45 }), null);
    assert.equal(resolveActivePaymentSessionId({}, { idSucursal: 1, idUsuario: 45 }), null);
  });

  it('sesion de otra sucursal nunca se acepta para la sucursal efectiva', () => {
    const sessionId = resolveActivePaymentSessionId(
      { id_sesion_caja: 99, id_sucursal: 2, estado_codigo: 'ABIERTA', id_usuario_responsable: 45 },
      { idSucursal: 1, idUsuario: 45 }
    );
    assert.equal(sessionId, null);
  });

  it('sesion cerrada (estado_codigo distinto de ABIERTA) se rechaza', () => {
    const sessionId = resolveActivePaymentSessionId(
      { id_sesion_caja: 43, id_sucursal: 1, estado_codigo: 'CERRADA', id_usuario_responsable: 45 },
      { idSucursal: 1, idUsuario: 45 }
    );
    assert.equal(sessionId, null);
  });

  it('sesion de otro usuario sin rol de participacion/autorizacion se rechaza', () => {
    const sessionId = resolveActivePaymentSessionId(
      { id_sesion_caja: 43, id_sucursal: 1, estado_codigo: 'ABIERTA', id_usuario_responsable: 7, rol_participacion: '' },
      { idSucursal: 1, idUsuario: 45 }
    );
    assert.equal(sessionId, null);
  });

  it('un auxiliar con rol de participacion autorizado se acepta aunque no sea el responsable', () => {
    const sessionId = resolveActivePaymentSessionId(
      { id_sesion_caja: 43, id_sucursal: 1, estado_codigo: 'ABIERTA', id_usuario_responsable: 7, rol_participacion: 'AUXILIAR' },
      { idSucursal: 1, idUsuario: 45 }
    );
    assert.equal(sessionId, 43);
  });
});

describe('PedidosView — resolucion centralizada de la sesion de pago (source regression)', () => {
  it('ya no declara ni depende de un prop selectedSessionId sin resolver', () => {
    assert.doesNotMatch(source, /selectedSessionId\s*=\s*null,/);
  });

  it('resuelve la sesion contra ventasService.getCajaBootstrap con id_sucursal de la sucursal efectiva', () => {
    const anchor = source.indexOf('const resolvePaymentSession = useCallback(async ({ force = false } = {}) => {');
    assert.notEqual(anchor, -1, 'Debe existir resolvePaymentSession.');
    const end = source.indexOf('}, [effectiveSucursalId, userId]);', anchor);
    assert.notEqual(end, -1);
    const block = source.slice(anchor, end);
    assert.match(block, /ventasService\.getCajaBootstrap\(\s*\{ id_sucursal: idSucursal \}/);
    assert.match(block, /coalesceUserKey: idUsuario/);
    assert.match(block, /resolveActivePaymentSessionId\(response\?\.data\?\.sesion_caja/);
  });

  it('aisla la solicitud con AbortController y un requestId monotonico, ademas de un scopeKey por usuario+sucursal', () => {
    const anchor = source.indexOf('const resolvePaymentSession = useCallback');
    const block = source.slice(anchor, source.indexOf('const invalidatePaymentSession = useCallback', anchor));
    assert.match(block, /new AbortController\(\)/);
    assert.match(block, /paymentSessionRequestIdRef\.current \+ 1/);
    assert.match(block, /const scopeKey = `\$\{idUsuario \|\| 'anon'\}:\$\{idSucursal \|\| 'none'\}`;/);
    assert.match(block, /paymentSessionAbortRef\.current\?\.abort\(\);/);
  });

  it('Caso 3: una respuesta de una sucursal anterior se descarta si el scope ya cambio (isCurrentRequest)', () => {
    const anchor = source.indexOf('const isCurrentRequest = () =>');
    assert.notEqual(anchor, -1);
    const block = source.slice(anchor, anchor + 700);
    assert.match(block, /paymentSessionRequestIdRef\.current === requestId/);
    assert.match(block, /paymentSessionScopeRef\.current === scopeKey/);
    assert.match(block, /if \(!isCurrentRequest\(\)\) return null;/);
  });

  it('invalida inmediatamente la sesion anterior cuando cambia effectiveSucursalId/userId', () => {
    const anchor = source.indexOf('useEffect(() => {\n    // Cambio de usuario o sucursal');
    assert.notEqual(anchor, -1, 'Debe existir el efecto que invalida al cambiar scope.');
    const block = source.slice(anchor, anchor + 400);
    assert.match(block, /setPaymentSessionId\(null\);/);
    assert.match(block, /void resolvePaymentSession\(\);/);
    assert.match(block, /\}, \[resolvePaymentSession\]\);/);
  });

  it('handleRegistrarPagoPedido arma el scope con userId, sucursalId, cashSessionId=paymentSessionId y origin PEDIDOS', () => {
    const anchor = source.indexOf('const handleRegistrarPagoPedido = useCallback(');
    const block = source.slice(anchor, source.indexOf('const closeConfirmDialog = useCallback(', anchor));
    assert.match(block, /userId,/);
    assert.match(block, /sucursalId: payload\?\.id_sucursal \|\| effectiveSucursalId,/);
    assert.match(block, /cashSessionId: payload\?\.id_sesion_caja \|\| paymentSessionId,/);
    assert.match(block, /origin: 'PEDIDOS'/);
  });

  it('el modal recibe selectedSessionId=paymentSessionId y los callbacks de revalidacion/invalidacion', () => {
    const anchor = source.indexOf('<VentaRegistrarPagoPedidoModal');
    const block = source.slice(anchor, source.indexOf('/>', anchor));
    assert.match(block, /selectedSessionId=\{paymentSessionId\}/);
    assert.match(block, /sessionLoading=\{paymentSessionLoading\}/);
    assert.match(block, /sessionError=\{paymentSessionError\}/);
    assert.match(block, /onRevalidateSession=\{revalidatePaymentSession\}/);
    assert.match(block, /onSessionInvalidated=\{invalidatePaymentSession\}/);
  });

  it('no reutiliza el hook pesado de Caja (loadCajaBootstrap/useVentas) — CajaView queda intacto', () => {
    assert.doesNotMatch(source, /loadCajaBootstrap/);
    assert.doesNotMatch(source, /from '\.\.\/hooks\/useVentas'/);
  });
});
