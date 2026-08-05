// HOTFIX (sesion de caja en Pedidos): el modal ya recibia selectedSessionId
// pero PedidosView nunca lo resolvia. Estas pruebas fijan, sobre el codigo
// fuente (mismo patron que VentaRegistrarPagoPedidoModalReconstruction.test.mjs,
// sin jsdom/Testing Library en este proyecto), que:
//  - la validacion de sesion ocurre ANTES del mensaje generico de scope
//    incompleto de financialOperationManager;
//  - se revalida una sola vez antes de cobrar si la sesion local falta;
//  - el payload siempre envia la sesion efectivamente validada;
//  - los codigos de sesion invalida limpian/refrescan sin reintentar el
//    cobro automaticamente;
//  - el boton de confirmar queda bloqueado sin sesion.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/pages/dashboard/ventas/components/VentaRegistrarPagoPedidoModal.jsx'), 'utf8').replace(/\r\n/g, '\n');

describe('SESSION_INVALIDATING_CODES', () => {
  it('contiene exactamente los 7 codigos que invalidan la sesion de caja', () => {
    const anchor = source.indexOf('const SESSION_INVALIDATING_CODES = new Set([');
    assert.notEqual(anchor, -1);
    const block = source.slice(anchor, source.indexOf(']);', anchor));
    for (const code of [
      'SESSION_NOT_FOUND',
      'SESSION_NOT_OPEN',
      'NO_ACTIVE_SESSION',
      'SESSION_SCOPE_MISMATCH',
      'SESSION_PARTICIPATION_REQUIRED',
      'SESSION_AUTHORIZATION_REQUIRED',
      'CAJA_NOT_ACTIVE'
    ]) {
      assert.match(block, new RegExp(`'${code}'`), `Falta el codigo ${code}`);
    }
  });
});

describe('handleSubmit — la sesion de caja se valida antes que cualquier otra cosa', () => {
  const anchor = source.indexOf('const handleSubmit = async () => {');
  const end = source.indexOf("if (!selectedPedido?.id_pedido) {", anchor);
  const guardBlock = source.slice(anchor, end);

  it('bloquea con mensaje especifico mientras la sesion esta cargando, antes de validar el pedido seleccionado', () => {
    assert.match(guardBlock, /if \(sessionLoading\) \{/);
    assert.match(guardBlock, /setLocalError\('Validando sesión de caja…'\);/);
  });

  it('si no hay sesion local, revalida una sola vez via onRevalidateSession antes de bloquear', () => {
    assert.match(guardBlock, /let effectiveSessionId = toPositiveId\(selectedSessionId\);/);
    assert.match(guardBlock, /if \(!effectiveSessionId\) \{/);
    assert.match(guardBlock, /const revalidated = await onRevalidateSession\?\.\(\);/);
    assert.match(guardBlock, /effectiveSessionId = toPositiveId\(revalidated\);/);
  });

  it('el mensaje de "no tienes sesion activa" es especifico, no el generico de scope incompleto', () => {
    assert.match(guardBlock, /No tienes una sesión de caja activa para esta sucursal\./);
    assert.doesNotMatch(guardBlock, /Selecciona una sucursal y una sesion de caja activa/);
  });

  it('el guard de sesion ocurre antes del guard de "selecciona un pedido pendiente"', () => {
    const sessionGuardIndex = source.indexOf('if (sessionLoading) {');
    const pedidoGuardIndex = source.indexOf('if (!selectedPedido?.id_pedido) {');
    assert.ok(sessionGuardIndex > -1 && pedidoGuardIndex > -1 && sessionGuardIndex < pedidoGuardIndex);
  });
});

describe('payload de cobro — siempre usa la sesion efectivamente validada', () => {
  it('id_sesion_caja usa effectiveSessionId (post revalidacion), no el prop crudo', () => {
    assert.match(source, /id_sesion_caja: effectiveSessionId,/);
    assert.doesNotMatch(source, /id_sesion_caja: toPositiveId\(selectedSessionId\),/);
  });
});

describe('Caso 5/6 — sesion cerrada durante el modal: sin reintento automatico', () => {
  const anchor = source.indexOf('    } catch (error) {\n      const backendSessionCode');
  const end = source.indexOf('} finally {', anchor);
  const catchBlock = source.slice(anchor, end);

  it('detecta los codigos por error.data.code o error.code', () => {
    assert.match(catchBlock, /error\?\.data\?\.code \|\| error\?\.code/);
  });

  it('ante un codigo invalidante limpia/refresca via onSessionInvalidated y NO llama a onRegistrarPago de nuevo', () => {
    assert.match(catchBlock, /if \(SESSION_INVALIDATING_CODES\.has\(backendSessionCode\)\) \{/);
    assert.match(catchBlock, /void onSessionInvalidated\?\.\(\);/);
    const sessionBranch = catchBlock.slice(
      catchBlock.indexOf('if (SESSION_INVALIDATING_CODES.has(backendSessionCode)) {'),
      catchBlock.indexOf('} else if (isStaleCuentaDivididaError(error)) {')
    );
    assert.doesNotMatch(sessionBranch, /onRegistrarPago/);
  });

  it('el mensaje de sesion invalidada pide reintentar manualmente, no promete un reintento automatico', () => {
    assert.match(catchBlock, /vuelve a presionar Confirmar pago para continuar/);
  });
});

describe('boton Confirmar pago — bloqueado sin sesion valida (Caso 4)', () => {
  it('disabled incluye sessionLoading y ausencia de sesion con error ya resuelto', () => {
    assert.match(
      source,
      /disabled=\{isSubmitting \|\| !selectedPedido \|\| sessionLoading \|\| \(!toPositiveId\(selectedSessionId\) && Boolean\(sessionError\)\)\}/
    );
  });
});

describe('CajaView no se modifico como parte de este hotfix', () => {
  it('CajaView.jsx sigue sin referenciar sessionLoading/onRevalidateSession/onSessionInvalidated', () => {
    const cajaViewSource = readFileSync(resolve('src/pages/dashboard/ventas/components/CajaView.jsx'), 'utf8');
    assert.doesNotMatch(cajaViewSource, /onRevalidateSession/);
    assert.doesNotMatch(cajaViewSource, /onSessionInvalidated/);
    assert.doesNotMatch(cajaViewSource, /sessionLoading=/);
  });
});
