// HOTFIX (ronda 3): reconstruccion dinamica del modal despues de un pago
// dividido. VentaRegistrarPagoPedidoModal.jsx es un componente React sin
// jsdom/Testing Library disponibles en este proyecto (ver package.json:
// solo node --test contra .mjs planos) -- esta prueba lee el codigo
// fuente y confirma, de forma ejecutable (no solo por inspeccion), que
// los elementos criticos de la reconstruccion esten (o NO esten)
// presentes. Complementa (no sustituye) las pruebas de funciones puras
// en utils/splitPaymentModalHelpers.test.mjs. Mismo patron ya usado en
// el backend: routers/ventas/__tests__/splitPaymentOrphanBalanceHotfix.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/pages/dashboard/ventas/components/VentaRegistrarPagoPedidoModal.jsx'), 'utf8');

describe('Ronda 3 -- causa raiz: nunca fusionar un selectedPedido viejo con uno nuevo', () => {
  it('18) el patron de fusion parcial {...current, ...detailed} ya NO existe en ningun lado del archivo', () => {
    assert.doesNotMatch(source, /\{\s*\.\.\.current,\s*\.\.\.detailed\s*\}/);
  });

  it('selectPedido reemplaza selectedPedido por completo (setSelectedPedido(detailed)), nunca lo fusiona', () => {
    const anchor = source.indexOf('const selectPedido = async (pedido) => {');
    assert.ok(anchor > -1);
    const block = source.slice(anchor, source.indexOf('const toggleSplitDraft = async (enabled) => {', anchor));
    assert.match(block, /setSelectedPedido\(detailed\);/);
  });

  it('toggleSplitDraft tambien reemplaza por completo tras cargar items (nunca fusiona)', () => {
    const anchor = source.indexOf('const toggleSplitDraft = async (enabled) => {');
    assert.ok(anchor > -1);
    const block = source.slice(anchor, source.indexOf('const addSplitDraftDivision = () => {', anchor));
    assert.match(block, /setSelectedPedido\(detailed\);/);
  });
});

describe('Ronda 3 -- secuencia de peticiones (evita aplicar una respuesta de red fuera de orden)', () => {
  it('existe una secuencia monotonica (pedidoStateSeqRef) con begin/isLatest', () => {
    assert.match(source, /const pedidoStateSeqRef = useRef\(0\);/);
    assert.match(source, /const beginPedidoStateUpdate = \(\) => \{/);
    assert.match(source, /const isLatestPedidoStateUpdate = \(token\) => token === pedidoStateSeqRef\.current;/);
  });

  it('selectPedido, toggleSplitDraft y refreshSelectedPedidoAfterPayment capturan un token antes de su fetch asincrono', () => {
    const selectPedidoBlock = source.slice(
      source.indexOf('const selectPedido = async (pedido) => {'),
      source.indexOf('const toggleSplitDraft = async (enabled) => {')
    );
    assert.match(selectPedidoBlock, /const token = beginPedidoStateUpdate\(\);/);
    assert.match(selectPedidoBlock, /if \(!isLatestPedidoStateUpdate\(token\)\) return;/);

    const toggleBlock = source.slice(
      source.indexOf('const toggleSplitDraft = async (enabled) => {'),
      source.indexOf('const addSplitDraftDivision = () => {')
    );
    assert.match(toggleBlock, /const token = beginPedidoStateUpdate\(\);/);
    assert.match(toggleBlock, /if \(!isLatestPedidoStateUpdate\(token\)\) return;/);

    const refreshBlock = source.slice(
      source.indexOf('const refreshSelectedPedidoAfterPayment = async (pedidoId) => {'),
      source.indexOf('const buildSplitDraftPayload = () => {')
    );
    assert.match(refreshBlock, /const token = beginPedidoStateUpdate\(\);/);
    assert.match(refreshBlock, /if \(!isLatestPedidoStateUpdate\(token\)\) return/);
  });
});

describe('Ronda 3 -- refresco SIEMPRE tras un pago, nunca por una heuristica local', () => {
  it('shouldExpectMoreSplitPayments (heuristica de ronda 1/2) ya no existe como decisor', () => {
    assert.doesNotMatch(source, /shouldExpectMoreSplitPayments/);
  });

  it('handleSubmit llama refreshSelectedPedidoAfterPayment de forma incondicional tras onRegistrarPago (no detras de un if)', () => {
    const submitStart = source.indexOf('const handleSubmit = async () => {');
    assert.ok(submitStart > -1);
    const registrarAnchor = source.indexOf('const response = await onRegistrarPago(', submitStart);
    assert.ok(registrarAnchor > -1);
    const catchAnchor = source.indexOf('} catch (error) {', registrarAnchor);
    assert.ok(catchAnchor > -1);
    const afterRegistrar = source.slice(registrarAnchor, catchAnchor);
    const refreshAnchor = afterRegistrar.indexOf('const refreshed = await refreshSelectedPedidoAfterPayment(selectedPedido.id_pedido);');
    assert.ok(refreshAnchor > -1, 'refreshSelectedPedidoAfterPayment debe llamarse justo despues del pago, sin condicion previa');
    // no debe haber ningun "if (" entre el pago y la llamada de refresco
    // (aparte del try interno que envuelve el refresco mismo).
    const between = afterRegistrar.slice(0, refreshAnchor);
    assert.doesNotMatch(between, /if \(/);
  });

  it('3/4) la siguiente division PENDIENTE se selecciona desde la respuesta fresca (find estado PENDIENTE), nunca por un indice fijo', () => {
    const refreshBlock = source.slice(
      source.indexOf('const refreshSelectedPedidoAfterPayment = async (pedidoId) => {'),
      source.indexOf('const buildSplitDraftPayload = () => {')
    );
    assert.match(refreshBlock, /\.find\(\(division\) => division\.estado === 'PENDIENTE'\)/);
    assert.match(refreshBlock, /setSelectedDivisionId\(nextPendingDivision \? String\(nextPendingDivision\.id_cuenta_division\) : ''\);/);
  });

  it('5) el cierre del modal se decide con shouldCloseModalAfterPayment y deja visible el mensaje final antes de llamar onClose', () => {
    const submitStart = source.indexOf('const handleSubmit = async () => {');
    const submitEnd = source.indexOf('\n  return (', submitStart);
    const block = source.slice(submitStart, submitEnd);
    assert.match(block, /const closed = shouldCloseModalAfterPayment\(\{/);
    assert.match(block, /if \(closed\) \{/);
    assert.match(block, /setLocalNotice\(buildPaymentCompletionMessage\(\{ montoTotal: montoTotalFinal \}\)\);/);
    assert.match(block, /closeAfterCompletionTimerRef\.current = window\.setTimeout\(\(\) => \{/);
    assert.match(block, /onClose\(\);/);
  });

  it('CajaView no cierra el modal antes de que este muestre el mensaje final contextual', () => {
    const cajaSource = readFileSync(resolve('src/pages/dashboard/ventas/components/CajaView.jsx'), 'utf8');
    const handlerStart = cajaSource.indexOf('const handleRegistrarPagoPedido = async (idPedido, payload) => {');
    const handlerEnd = cajaSource.indexOf('\n  const ', handlerStart + 10);
    const handlerBlock = cajaSource.slice(handlerStart, handlerEnd);
    assert.doesNotMatch(handlerBlock, /setRegistrarPagoOpen\(false\);/);
  });
});

describe('Ronda 3 -- borrador local se limpia por completo tras cada reconstruccion', () => {
  it('7) refreshSelectedPedidoAfterPayment siempre reconstruye splitDraftDivisions desde el estado fresco (resolveSplitDraftAutoActivationState), nunca reutiliza el borrador previo', () => {
    const refreshBlock = source.slice(
      source.indexOf('const refreshSelectedPedidoAfterPayment = async (pedidoId) => {'),
      source.indexOf('const buildSplitDraftPayload = () => {')
    );
    assert.match(refreshBlock, /const autoState = resolveSplitDraftAutoActivationState\(detailed, nextPendingDivision\);/);
    assert.match(refreshBlock, /setSplitDraftDivisions\(autoState\.divisions\);/);
    assert.match(refreshBlock, /setPendingAutoAssignConfirm\(false\);/);
  });

  it('18) una respuesta detallada incompleta no reutiliza el pedido anterior y limpia la seleccion', () => {
    const loadStart = source.indexOf('const loadPedidoItems = async (pedido, { force = false } = {}) => {');
    const selectStart = source.indexOf('const selectPedido = async (pedido) => {', loadStart);
    const loadBlock = source.slice(loadStart, selectStart);
    assert.doesNotMatch(loadBlock, /return detailed \|\| pedido;/);
    assert.match(loadBlock, /if \(!detailed\) \{/);
    assert.match(loadBlock, /return null;/);

    const refreshBlock = source.slice(
      source.indexOf('const refreshSelectedPedidoAfterPayment = async (pedidoId) => {'),
      source.indexOf('const buildSplitDraftPayload = () => {')
    );
    assert.match(refreshBlock, /if \(!detailed\) \{[\s\S]*setSelectedPedido\(null\);/);
    assert.match(refreshBlock, /setSplitDraftDivisions\(buildInitialSplitDivisions\(\)\);/);
  });
});

describe('Ronda 3 -- 8/16) itemIds obsoletos nunca se envian; el pedido cambiado provoca refresh sin envio', () => {
  it('handleSubmit valida el borrador contra splitDraftItems ANTES de construir el payload, y si hay obsoletos, refresca y NO llama onRegistrarPago', () => {
    const submitStart = source.indexOf('const handleSubmit = async () => {');
    const buildPayloadAnchor = source.indexOf('const splitDraftPayload = hasSplitDraft ? buildSplitDraftPayload() : null;', submitStart);
    assert.ok(buildPayloadAnchor > -1);
    const preSubmitBlock = source.slice(submitStart, buildPayloadAnchor);
    assert.match(preSubmitBlock, /const staleIds = resolveStaleDraftItemIds\(\{/);
    assert.match(preSubmitBlock, /if \(staleIds\.length > 0\) \{/);
    assert.match(preSubmitBlock, /await refreshSelectedPedidoAfterPayment\(selectedPedido\.id_pedido\)\.catch\(\(\) => null\);/);
    assert.match(preSubmitBlock, /El pedido cambió mientras lo estabas cobrando\./);
  });
});

describe('Ronda 3 -- 17) error de linea inexistente/duplicada provoca reconstruccion segura, nunca se muestra crudo', () => {
  it('el catch de handleSubmit distingue isStaleCuentaDivididaError y refresca en vez de mostrar el error tecnico', () => {
    const submitStart = source.indexOf('const handleSubmit = async () => {');
    const submitEnd = source.indexOf('return (', submitStart);
    const block = source.slice(submitStart, submitEnd);
    assert.match(block, /if \(isStaleCuentaDivididaError\(error\)\) \{/);
    assert.match(block, /await refreshSelectedPedidoAfterPayment\(selectedPedido\.id_pedido\)\.catch\(\(\) => null\);/);
    assert.match(block, /El pedido cambió mientras lo estabas cobrando\./);
  });
});

describe('Ronda 3 -- 1/9/10) PAGADAS y PENDIENTES en secciones separadas; una division pagada nunca es clickeable como activa', () => {
  it('la seccion PAGADAS solo tiene un boton "Ver detalle" (togglePaidDivisionDetail), nunca setSelectedDivisionId', () => {
    const paidSectionAnchor = source.indexOf("divisionGroups.paid.length > 0 ? (");
    assert.ok(paidSectionAnchor > -1);
    const pendingSectionAnchor = source.indexOf('Pendientes ({divisionGroups.pending.length})');
    assert.ok(pendingSectionAnchor > paidSectionAnchor);
    const paidBlock = source.slice(paidSectionAnchor, pendingSectionAnchor);
    assert.match(paidBlock, /onClick=\{\(\) => togglePaidDivisionDetail\(division\.id_cuenta_division\)\}/);
    assert.doesNotMatch(paidBlock, /setSelectedDivisionId/);
  });

  it('la seccion PENDIENTES itera exclusivamente sobre divisionGroups.pending (nunca cuentaDivisiones sin filtrar)', () => {
    const pendingSectionAnchor = source.indexOf('Pendientes ({divisionGroups.pending.length})');
    assert.ok(pendingSectionAnchor > -1);
    const block = source.slice(pendingSectionAnchor, pendingSectionAnchor + 1400);
    assert.match(block, /\{divisionGroups\.pending\.map\(\(division\) => \{/);
  });

  it('divisionGroups se calcula con classifyDivisiones sobre cuentaDivisiones', () => {
    assert.match(source, /const divisionGroups = hasCuentaDividida \? classifyDivisiones\(cuentaDivisiones\) : \{ paid: \[\], pending: \[\], cancelled: \[\] \};/);
  });
});

describe('Ronda 3 -- 19/20) una sola linea sobrante se asigna sola; varias requieren confirmacion explicita', () => {
  it('buildAutoActivatedSplitDraftDivisions usa resolveSingleLeftoverAutoAssignment y asigna itemIds solo cuando hay una sola linea', () => {
    const anchor = source.indexOf('const buildAutoActivatedSplitDraftDivisions = (detailed) => {');
    assert.ok(anchor > -1);
    const block = source.slice(anchor, anchor + 500);
    assert.match(block, /resolveSingleLeftoverAutoAssignment\(resolveUnassignedItemsForPedido\(detailed\)\)/);
    assert.match(block, /itemIds: \[single\.id_detalle_pedido\]/);
  });

  it('20) la confirmacion explicita (pendingAutoAssignConfirm) sigue existiendo para repartir varias lineas', () => {
    assert.match(source, /const \[pendingAutoAssignConfirm, setPendingAutoAssignConfirm\] = useState\(false\);/);
    assert.match(source, /setPendingAutoAssignConfirm\(true\);/);
  });
});

describe('Ronda 3 -- resumen financiero y barra de progreso siempre visibles (seccion 5.1)', () => {
  it('la barra de progreso es informativa y coexiste con los 3 valores numericos (nunca los sustituye)', () => {
    const anchor = source.indexOf('financialSummary ? (');
    assert.ok(anchor > -1);
    const block = source.slice(anchor, anchor + 1400);
    assert.match(block, /formatCurrency\(financialSummary\.montoTotal\)/);
    assert.match(block, /formatCurrency\(financialSummary\.montoPagado\)/);
    assert.match(block, /formatCurrency\(financialSummary\.montoPendiente\)/);
    assert.match(block, /className="progress-bar bg-success"/);
  });
});
