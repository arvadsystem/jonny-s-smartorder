import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildComandaIdempotencyKey,
  buildFacturaReprintIdempotencyKey,
  commitRecoveredFacturaToLiveBoard,
  createComandaPrompt,
  createDetailOperationController,
  createDocumentPrintGuard,
  createEmptyPrintErrors,
  createPedidosStateCoordinator,
  enqueueAgentPrintAction,
  prepareComandaPrintWindow,
  reconcilePedidoDetailPrintSource,
  reconcileRecoveredFacturaDetail,
  recoverFacturedPedidoPrintSource,
  resolveRecoveredFacturaAgainstCurrentBoard,
  setDocumentPrintError
} from './ventasPrintActions.js';

const paidVenta = {
  id_factura: 41,
  id_pedido: 12,
  id_sucursal: 2,
  numero_venta: 'VTA-00041',
  items: [{ id_detalle: 1, cantidad: 1, nombre_item: 'Alitas' }]
};

const pendingPedido = {
  id_factura: null,
  id_pedido: 12,
  id_sucursal: 2,
  numero_pedido: 'PED-00012',
  items: [{ id_detalle: 1, cantidad: 1, nombre_item: 'Alitas' }]
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const assertNoRecoveryUiOrPrintSideEffects = (calls) => {
  assert.equal(calls.modalUpdates.length, 0);
  assert.equal(calls.toastCalls.length, 0);
  assert.equal(calls.printCalls.length, 0);
};

const createRecoveryHarness = ({
  idPedido = 12,
  sucursalId = 2,
  initialPedidos = [{ ...pendingPedido }]
} = {}) => {
  const controller = createDetailOperationController();
  controller.openDetail({ idPedido, sucursalId });
  const calls = {
    getByIdCalls: [],
    modalUpdates: [],
    boardUpdates: [],
    toastCalls: [],
    printCalls: []
  };
  const state = { venta: pendingPedido, pedidos: initialPedidos };
  const coordinator = createPedidosStateCoordinator({
    initialPedidos,
    commitState(nextPedidos) {
      state.pedidos = nextPedidos;
      calls.boardUpdates.push(nextPedidos);
    }
  });

  const runRecovery = async ({ fetchPedidos, fetchVenta, beforeFinalCommit }) => {
    const operation = controller.beginOperation({ idPedido, sucursalId });
    const trackedFetchVenta = async (idFactura) => {
      calls.getByIdCalls.push(idFactura);
      return fetchVenta(idFactura);
    };
    const recovery = await recoverFacturedPedidoPrintSource({
      error: { code: 'PRINT_PEDIDO_SOURCE_INVALID' },
      idPedido,
      fetchPedidos,
      fetchVenta: trackedFetchVenta,
      isCurrent: () => controller.isCurrent(operation)
    });

    if (recovery.stale || !recovery.recovered) return recovery;
    const reconciliation = await reconcileRecoveredFacturaDetail({
      getCurrentPedidos: () => coordinator.getCurrent(),
      idPedido,
      recoveredIdFactura: recovery.idFactura,
      recoveredVenta: recovery.venta,
      fetchVenta: trackedFetchVenta,
      isCurrent: () => controller.isCurrent(operation)
    });

    if (reconciliation.status === 'stale') {
      return { ...recovery, stale: true, reconciliation };
    }
    if (reconciliation.status === 'changed') {
      controller.complete(operation);
      return { ...recovery, recovered: false, reconciliation };
    }
    if (!['apply-recovered', 'same', 'conflict'].includes(reconciliation.status)) {
      controller.complete(operation);
      return { ...recovery, recovered: false, reconciliation };
    }
    if (typeof beforeFinalCommit === 'function') {
      beforeFinalCommit({ coordinator, reconciliation, state, calls });
    }
    if (!controller.isCurrent(operation)) {
      return { ...recovery, stale: true, reconciliation };
    }

    const allowedLiveStatuses = reconciliation.status === 'apply-recovered'
      ? ['apply-recovered', 'same']
      : ['same'];
    const liveResolution = commitRecoveredFacturaToLiveBoard({
      coordinator,
      idPedido,
      effectiveIdFactura: reconciliation.effectiveIdFactura,
      allowedStatuses: allowedLiveStatuses
    });
    if (!allowedLiveStatuses.includes(liveResolution.status)) {
      controller.complete(operation);
      return { ...recovery, recovered: false, reconciliation, liveResolution };
    }
    if (!controller.complete(operation)) {
      return { ...recovery, stale: true, reconciliation, liveResolution };
    }
    state.venta = {
      ...reconciliation.venta,
      id_pedido: idPedido,
      id_factura: reconciliation.effectiveIdFactura
    };
    calls.modalUpdates.push(state.venta);
    calls.toastCalls.push({ title: 'PEDIDO ACTUALIZADO', variant: 'warning' });
    return { ...recovery, reconciliation, liveResolution };
  };

  const secondClick = async ({ fetchVenta } = {}) => {
    if (!state.venta) return null;
    const operation = controller.beginOperation({ idPedido, sucursalId });
    const liveSource = await reconcilePedidoDetailPrintSource({
      coordinator,
      idPedido,
      modalIdFactura: state.venta.id_factura,
      fetchVenta: async (idFactura) => {
        calls.getByIdCalls.push(idFactura);
        return fetchVenta?.(idFactura);
      },
      isCurrent: () => controller.isCurrent(operation)
    });
    if (liveSource.status === 'stale') return liveSource;
    if (liveSource.status === 'refresh') {
      if (!controller.complete(operation)) return { status: 'stale' };
      state.venta = {
        ...liveSource.venta,
        id_pedido: idPedido,
        id_factura: liveSource.effectiveIdFactura
      };
      calls.modalUpdates.push(state.venta);
      calls.toastCalls.push({ title: 'PEDIDO ACTUALIZADO', variant: 'warning' });
      return liveSource;
    }
    if (liveSource.status !== 'ready') {
      controller.complete(operation);
      return liveSource;
    }

    const sourceType = liveSource.effectiveIdFactura ? 'factura' : 'pedido';
    const result = await enqueueAgentPrintAction({
      ventasApi: {
        async enqueuePrintJob(idFactura, payload, idempotencyKey) {
          calls.printCalls.push({ idFactura, payload, idempotencyKey });
          return { job: { id_trabajo: 77 } };
        },
        async enqueuePedidoPrintJob(idPedidoValue, payload, idempotencyKey) {
          calls.printCalls.push({ idPedido: idPedidoValue, payload, idempotencyKey });
          return { job: { id_trabajo: 78 } };
        }
      },
      documentType: 'comanda',
      venta: { ...state.venta, id_factura: liveSource.effectiveIdFactura },
      sourceType,
      action: 'reprint',
      createUniqueValue: () => 'segundo-clic'
    });
    controller.complete(operation);
    return { status: 'printed', result };
  };

  return { calls, controller, coordinator, runRecovery, secondClick, state };
};

const findElement = (node, predicate) => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElement(child, predicate);
      if (match) return match;
    }
    return null;
  }
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  return findElement(React.Children.toArray(node.props.children), predicate);
};

describe('acciones independientes de impresion en ventas', () => {
  let viteServer;
  let VentaDetalleModal;
  let VentaDetallePrintActions;
  let VentaDetallePrintErrors;

  before(async () => {
    viteServer = await createServer({
      appType: 'custom',
      configFile: false,
      esbuild: { jsxInject: "import React from 'react'" },
      logLevel: 'silent',
      root: process.cwd(),
      server: { middlewareMode: true }
    });
    const module = await viteServer.ssrLoadModule('/src/pages/dashboard/ventas/components/VentaDetalleModal.jsx');
    VentaDetalleModal = module.default;
    VentaDetallePrintActions = module.VentaDetallePrintActions;
    VentaDetallePrintErrors = module.VentaDetallePrintErrors;
  });

  after(async () => {
    await viteServer?.close();
  });

  it('serializa commits y el segundo observa el resultado exacto del primero', () => {
    const initialPedidos = [{ id_pedido: 12, id_factura: null }];
    const applied = [];
    const coordinator = createPedidosStateCoordinator({
      initialPedidos,
      commitState(nextPedidos) { applied.push(nextPedidos); }
    });
    const afterFirst = coordinator.commit((currentPedidos) => [
      ...currentPedidos,
      { id_pedido: 99, id_factura: null }
    ]);
    let observedBySecond = null;
    const afterSecond = coordinator.commit((currentPedidos) => {
      observedBySecond = currentPedidos;
      return currentPedidos.map((pedido) => (
        pedido.id_pedido === 12 ? { ...pedido, estado: 'EN_PREPARACION' } : pedido
      ));
    });

    assert.equal(observedBySecond, afterFirst);
    assert.equal(applied.length, 2);
    assert.equal(applied[0], afterFirst);
    assert.equal(applied[1], afterSecond);
    assert.deepEqual(afterSecond, [
      { id_pedido: 12, id_factura: null, estado: 'EN_PREPARACION' },
      { id_pedido: 99, id_factura: null }
    ]);
  });

  it('conserva dos commits consecutivos en el mismo tick sin perder actualizaciones', () => {
    const coordinator = createPedidosStateCoordinator({
      initialPedidos: [{ id_pedido: 12 }]
    });
    coordinator.commit((currentPedidos) => [...currentPedidos, { id_pedido: 99 }]);
    coordinator.commit((currentPedidos) => [...currentPedidos, { id_pedido: 100 }]);
    assert.deepEqual(coordinator.getCurrent(), [
      { id_pedido: 12 },
      { id_pedido: 99 },
      { id_pedido: 100 }
    ]);
  });

  it('PedidosView no usa un updater de React para setPedidos', async () => {
    const source = await readFile(
      new URL('../components/PedidosView.jsx', import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(source, /setPedidos\s*\(\s*\(/);
  });

  it('renderiza factura y comanda pagada como acciones separadas y respeta permisos', () => {
    const html = renderToStaticMarkup(React.createElement(VentaDetalleModal, {
      open: true,
      venta: paidVenta,
      loading: false,
      canPrint: true,
      canExport: false,
      onClose() {},
      onPrintFactura() {},
      onPrintComanda() {}
    }));
    assert.match(html, /aria-label="Imprimir factura"/);
    assert.match(html, /aria-label="Imprimir comanda"/);

    const withoutPermission = renderToStaticMarkup(React.createElement(VentaDetalleModal, {
      open: true,
      venta: paidVenta,
      loading: false,
      canPrint: false,
      canExport: false,
      onClose() {}
    }));
    assert.doesNotMatch(withoutPermission, /aria-label="Imprimir factura"/);
    assert.doesNotMatch(withoutPermission, /aria-label="Imprimir comanda"/);
  });

  it('renderiza reimpresion de comanda pendiente sin exigir factura', () => {
    const html = renderToStaticMarkup(React.createElement(VentaDetalleModal, {
      open: true,
      venta: pendingPedido,
      loading: false,
      canPrint: true,
      canExport: false,
      printSourceType: 'pedido',
      onClose() {},
      onPrintComanda() {}
    }));
    assert.match(html, /aria-label="Reimprimir comanda"/);
    assert.doesNotMatch(html, /aria-label="Imprimir factura"/);
  });

  it('cada boton invoca solamente su manejador y el ancho fiscal no dispara comanda', async () => {
    const calls = { factura: 0, comanda: 0, width: null };
    const tree = VentaDetallePrintActions({
      canPrintFactura: true,
      canPrintComanda: true,
      pendingComanda: false,
      ticketWidthMm: 80,
      facturaLoading: false,
      comandaLoading: false,
      onTicketWidthChange(event) { calls.width = Number(event.target.value); },
      onPrintFactura() { calls.factura += 1; },
      onPrintComanda() { calls.comanda += 1; }
    });
    const facturaButton = findElement(tree, (element) => element.props['aria-label'] === 'Imprimir factura');
    const comandaButton = findElement(tree, (element) => element.props['aria-label'] === 'Imprimir comanda');
    const widthSelect = findElement(tree, (element) => element.props['aria-label'] === 'Ancho de ticket');

    await facturaButton.props.onClick();
    assert.deepEqual(calls, { factura: 1, comanda: 0, width: null });
    widthSelect.props.onChange({ target: { value: '58' } });
    assert.deepEqual(calls, { factura: 1, comanda: 0, width: 58 });
    await comandaButton.props.onClick();
    assert.deepEqual(calls, { factura: 1, comanda: 1, width: 58 });
  });

  it('bloquea el doble clic solo para el mismo documento', async () => {
    const guard = createDocumentPrintGuard();
    let releaseFactura;
    let facturaCalls = 0;
    let comandaCalls = 0;
    const facturaPending = guard.run('factura', async () => {
      facturaCalls += 1;
      await new Promise((resolve) => { releaseFactura = resolve; });
    });
    const duplicated = await guard.run('factura', async () => { facturaCalls += 1; });
    const independent = await guard.run('comanda', async () => { comandaCalls += 1; });

    assert.equal(duplicated.skipped, true);
    assert.equal(independent.skipped, false);
    assert.equal(facturaCalls, 1);
    assert.equal(comandaCalls, 1);
    releaseFactura();
    await facturaPending;
  });

  it('deshabilita visualmente solo la accion que esta imprimiendo', () => {
    const tree = VentaDetallePrintActions({
      canPrintFactura: true,
      canPrintComanda: true,
      pendingComanda: false,
      ticketWidthMm: 80,
      facturaLoading: true,
      comandaLoading: false,
      onTicketWidthChange() {},
      onPrintFactura() {},
      onPrintComanda() {}
    });
    const facturaButton = findElement(tree, (element) => element.props['aria-label'] === 'Imprimir factura');
    const comandaButton = findElement(tree, (element) => element.props['aria-label'] === 'Imprimir comanda');
    assert.equal(facturaButton.props.disabled, true);
    assert.equal(comandaButton.props.disabled, false);
  });

  it('encola factura y comanda pagada como trabajos distintos y exactos', async () => {
    const calls = [];
    const ventasApi = {
      async enqueuePrintJob(...args) {
        calls.push({ method: 'factura', args });
        return { job: { id_trabajo: calls.length } };
      },
      async enqueuePedidoPrintJob(...args) {
        calls.push({ method: 'pedido', args });
        return { job: { id_trabajo: calls.length } };
      }
    };

    await enqueueAgentPrintAction({
      ventasApi,
      documentType: 'factura',
      venta: { ...paidVenta, ticketWidthMm: 58 },
      action: 'reprint',
      createUniqueValue: () => 'uuid-factura'
    });
    await enqueueAgentPrintAction({
      ventasApi,
      documentType: 'comanda',
      venta: { ...paidVenta, ticketWidthMm: 58 },
      sourceType: 'factura',
      action: 'reprint',
      createUniqueValue: () => 'uuid-comanda'
    });

    assert.deepEqual(calls, [
      {
        method: 'factura',
        args: [
          41,
          { tipo_documento: 'factura', es_reimpresion: true, motivo: 'REIMPRESION_MANUAL' },
          'reprint:uuid-factura'
        ]
      },
      {
        method: 'factura',
        args: [41, { tipo_documento: 'comanda', es_reimpresion: true }, 'comanda-reprint:41:uuid-comanda']
      }
    ]);
    assert.notEqual(calls[0].args[2], calls[1].args[2]);
    assert.equal('ticketWidthMm' in calls[1].args[1], false);
  });

  it('encola reimpresion pendiente por id_pedido y nunca reutiliza la clave inicial', async () => {
    const calls = [];
    const ventasApi = {
      async enqueuePrintJob(...args) { calls.push({ method: 'factura', args }); },
      async enqueuePedidoPrintJob(...args) { calls.push({ method: 'pedido', args }); return { job: { id_trabajo: 9 } }; }
    };
    const result = await enqueueAgentPrintAction({
      ventasApi,
      documentType: 'comanda',
      venta: pendingPedido,
      sourceType: 'pedido',
      action: 'reprint',
      createUniqueValue: () => 'uuid-pedido'
    });

    assert.deepEqual(calls, [{
      method: 'pedido',
      args: [12, { tipo_documento: 'comanda', es_reimpresion: true }, 'comanda:pedido-reprint:12:uuid-pedido']
    }]);
    assert.equal(result.idempotencyKey.startsWith('comanda:pedido-reprint:12:'), true);
    assert.notEqual(result.idempotencyKey, 'comanda:pedido:12:inicial');
  });

  it('modela por separado fuente, accion y origen en los cuatro casos requeridos', () => {
    const cases = [
      createComandaPrompt({ venta: paidVenta, sourceType: 'factura', action: 'initial', origin: 'post-sale' }),
      createComandaPrompt({ venta: pendingPedido, sourceType: 'pedido', action: 'initial', origin: 'pending-order' }),
      createComandaPrompt({ venta: paidVenta, sourceType: 'factura', action: 'reprint', origin: 'detail' }),
      createComandaPrompt({ venta: pendingPedido, sourceType: 'pedido', action: 'reprint', origin: 'detail' })
    ];
    assert.deepEqual(cases.map(({ sourceType, action, origin }) => ({ sourceType, action, origin })), [
      { sourceType: 'factura', action: 'initial', origin: 'post-sale' },
      { sourceType: 'pedido', action: 'initial', origin: 'pending-order' },
      { sourceType: 'factura', action: 'reprint', origin: 'detail' },
      { sourceType: 'pedido', action: 'reprint', origin: 'detail' }
    ]);
    assert.equal(buildComandaIdempotencyKey({ sourceType: 'factura', action: 'initial', idFactura: 41 }), 'comanda:41:inicial');
    assert.equal(buildComandaIdempotencyKey({ sourceType: 'pedido', action: 'initial', idPedido: 12 }), 'comanda:pedido:12:inicial');
  });

  it('restaura las claves y el payload historicos de reimpresion de factura', async () => {
    assert.equal(
      buildFacturaReprintIdempotencyKey({ idFactura: 41, createUniqueValue: () => 'uuid-prueba' }),
      'reprint:uuid-prueba'
    );
    assert.equal(
      buildFacturaReprintIdempotencyKey({
        idFactura: 41,
        createUniqueValue: () => null,
        now: () => 1700000000000
      }),
      'reprint:41:1700000000000'
    );
    assert.equal(
      buildComandaIdempotencyKey({
        sourceType: 'factura',
        action: 'reprint',
        idFactura: 41,
        createUniqueValue: () => 'uuid-prueba'
      }),
      'comanda-reprint:41:uuid-prueba'
    );
    assert.equal(
      buildComandaIdempotencyKey({
        sourceType: 'pedido',
        action: 'reprint',
        idPedido: 12,
        createUniqueValue: () => 'uuid-prueba'
      }),
      'comanda:pedido-reprint:12:uuid-prueba'
    );

    const calls = [];
    await enqueueAgentPrintAction({
      ventasApi: {
        async enqueuePrintJob(...args) { calls.push(args); }
      },
      documentType: 'factura',
      venta: paidVenta,
      action: 'reprint',
      createUniqueValue: () => 'uuid-prueba'
    });
    assert.deepEqual(calls, [[
      41,
      { tipo_documento: 'factura', es_reimpresion: true, motivo: 'REIMPRESION_MANUAL' },
      'reprint:uuid-prueba'
    ]]);
  });

  it('en modo agente encola una sola comanda pagada sin abrir navegador ni invocar impresion local', async () => {
    const calls = { open: 0, enqueue: 0, browser: 0, qz: 0, pdf: 0 };
    const printWindow = prepareComandaPrintWindow({
      agentPrintMode: true,
      sourceType: 'factura',
      openWindow() { calls.open += 1; return {}; }
    });
    assert.equal(printWindow, null);

    await enqueueAgentPrintAction({
      ventasApi: {
        async enqueuePrintJob(idFactura, payload) {
          calls.enqueue += 1;
          assert.equal(idFactura, 41);
          assert.deepEqual(payload, { tipo_documento: 'comanda', es_reimpresion: true });
          return { job: { id_trabajo: 77 } };
        },
        async enqueuePedidoPrintJob() { throw new Error('No debe usar id_pedido.'); }
      },
      documentType: 'comanda',
      venta: paidVenta,
      sourceType: 'factura',
      action: 'reprint',
      createUniqueValue: () => 'uuid-prueba'
    });

    assert.deepEqual(calls, { open: 0, enqueue: 1, browser: 0, qz: 0, pdf: 0 });
  });

  it('recupera un pedido recien facturado sin reintento automatico y el segundo clic usa id_factura', async () => {
    const harness = createRecoveryHarness();
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) { assert.equal(idFactura, 41); return paidVenta; }
    });

    assert.equal(recovery.recovered, true);
    assert.equal(recovery.idFactura, 41);
    assert.equal(recovery.reconciliation.status, 'apply-recovered');
    assert.equal('nextPedidos' in recovery.reconciliation, false);
    assert.deepEqual(harness.calls.getByIdCalls, [41]);
    assert.equal(harness.calls.boardUpdates.length, 1);
    assert.equal(harness.calls.modalUpdates.length, 1);
    assert.equal(harness.calls.toastCalls.length, 1);
    assert.equal(harness.calls.printCalls.length, 0);
    assert.equal(harness.state.venta.id_factura, 41);

    await harness.secondClick();
    assert.equal(harness.calls.printCalls.length, 1);
    assert.equal(harness.calls.printCalls[0].idFactura, 41);
    assert.equal(harness.calls.printCalls[0].payload.tipo_documento, 'comanda');
  });

  it('aplica la factura al tablero vivo si polling ocurre despues de reconciliar', async () => {
    const pedido99 = { id_pedido: 99, id_factura: null };
    const harness = createRecoveryHarness({
      initialPedidos: [{ ...pendingPedido, estado: 'PENDIENTE' }, pedido99]
    });
    const pedido100 = { id_pedido: 100, id_factura: null };
    const recovery = await harness.runRecovery({
      async fetchPedidos() {
        return [{ id_pedido: 12, id_factura: 41, estado: 'PENDIENTE' }];
      },
      async fetchVenta() { return paidVenta; },
      beforeFinalCommit({ coordinator }) {
        coordinator.commit([
          { id_pedido: 12, id_factura: null, estado: 'EN_PREPARACION' },
          pedido99,
          pedido100
        ]);
      }
    });

    assert.equal(recovery.reconciliation.status, 'apply-recovered');
    assert.equal(recovery.liveResolution.status, 'apply-recovered');
    assert.deepEqual(harness.state.pedidos, [
      { id_pedido: 12, id_factura: 41, estado: 'EN_PREPARACION' },
      pedido99,
      pedido100
    ]);
    assert.equal(harness.state.pedidos[1], pedido99);
    assert.equal(harness.state.pedidos[2], pedido100);
    assert.equal(harness.calls.boardUpdates.length, 2);
  });

  it('no reinserta el pedido si Realtime lo elimina antes del commit final', async () => {
    const pedido99 = { id_pedido: 99, id_factura: null };
    const harness = createRecoveryHarness({
      initialPedidos: [{ ...pendingPedido }, pedido99]
    });
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta() { return paidVenta; },
      beforeFinalCommit({ coordinator }) {
        coordinator.commit([pedido99]);
      }
    });

    assert.equal(recovery.recovered, false);
    assert.equal(recovery.liveResolution.status, 'missing');
    assert.deepEqual(harness.state.pedidos, [pedido99]);
    assert.equal(harness.calls.boardUpdates.length, 2);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
    await harness.secondClick();
    assert.equal(harness.calls.printCalls.length, 0);
  });

  it('falla cerrado si 58 cambia a 77 despues de completar la reconciliacion', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58, estado: 'EN_PREPARACION' }]
    });
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        return idFactura === 58
          ? { ...paidVenta, id_factura: 58, numero_venta: 'VTA-00058' }
          : paidVenta;
      },
      beforeFinalCommit({ coordinator, reconciliation }) {
        assert.equal(reconciliation.status, 'conflict');
        assert.equal(reconciliation.effectiveIdFactura, 58);
        coordinator.commit([
          { id_pedido: 12, id_factura: 77, estado: 'EN_PREPARACION' }
        ]);
      }
    });

    assert.equal(recovery.recovered, false);
    assert.equal(recovery.reconciliation.status, 'conflict');
    assert.equal('nextPedidos' in recovery.reconciliation, false);
    assert.equal(recovery.liveResolution.status, 'conflict');
    assert.deepEqual(harness.calls.getByIdCalls, [41, 58]);
    assert.equal(harness.state.pedidos[0].id_factura, 77);
    assert.equal(harness.calls.boardUpdates.length, 2);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
    await harness.secondClick();
    assert.equal(harness.calls.printCalls.length, 0);
  });

  it('no reaplica una factura si un conflicto queda sin factura antes del commit final', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58 }]
    });
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        return idFactura === 58 ? { ...paidVenta, id_factura: 58 } : paidVenta;
      },
      beforeFinalCommit({ coordinator }) {
        coordinator.commit([{ id_pedido: 12, id_factura: null }]);
      }
    });

    assert.equal(recovery.recovered, false);
    assert.equal(recovery.liveResolution.status, 'apply-recovered');
    assert.equal(harness.state.pedidos[0].id_factura, null);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('preserva LISTO_PARA_ENTREGA aunque la lista de recuperacion contenga PENDIENTE', async () => {
    const currentPedidos = [{ id_pedido: 12, id_factura: null, estado: 'LISTO_PARA_ENTREGA' }];
    const result = resolveRecoveredFacturaAgainstCurrentBoard({
      currentPedidos,
      idPedido: 12,
      recoveredIdFactura: 41
    });
    assert.equal(result.status, 'apply-recovered');
    assert.equal(result.effectiveIdFactura, 41);
    assert.deepEqual(result.nextPedidos, [
      { id_pedido: 12, id_factura: 41, estado: 'LISTO_PARA_ENTREGA' }
    ]);
  });

  it('no reinserta un pedido eliminado del tablero', () => {
    const currentPedidos = [{ id_pedido: 99 }];
    const result = resolveRecoveredFacturaAgainstCurrentBoard({
      currentPedidos,
      idPedido: 12,
      recoveredIdFactura: 41
    });
    assert.equal(result.status, 'missing');
    assert.equal(result.nextPedidos, currentPedidos);
  });

  it('rechaza datos invalidos sin crear un tablero alterno', () => {
    const currentPedidos = [{ id_pedido: 12, id_factura: null }];
    const result = resolveRecoveredFacturaAgainstCurrentBoard({
      currentPedidos,
      idPedido: 12,
      recoveredIdFactura: null
    });
    assert.equal(result.status, 'invalid');
    assert.equal(result.effectiveIdFactura, null);
    assert.equal(result.nextPedidos, currentPedidos);
  });

  it('no sobrescribe una factura mas reciente', () => {
    const currentPedidos = [{ id_pedido: 12, id_factura: 58, estado: 'PENDIENTE' }];
    const result = resolveRecoveredFacturaAgainstCurrentBoard({
      currentPedidos,
      idPedido: 12,
      recoveredIdFactura: 41
    });
    assert.equal(result.status, 'conflict');
    assert.equal(result.effectiveIdFactura, 58);
    assert.equal(result.nextPedidos, currentPedidos);
  });

  it('conserva la referencia del tablero cuando la factura ya coincide', () => {
    const currentPedidos = [{ id_pedido: 12, id_factura: 41, estado: 'EN_PREPARACION' }];
    const result = resolveRecoveredFacturaAgainstCurrentBoard({
      currentPedidos,
      idPedido: 12,
      recoveredIdFactura: 41
    });
    assert.equal(result.status, 'same');
    assert.equal(result.effectiveIdFactura, 41);
    assert.equal(result.nextPedidos, currentPedidos);
  });

  it('mantiene tablero, modal y segundo clic en la factura coincidente 41', async () => {
    const initialPedidos = [{ id_pedido: 12, id_factura: 41, estado: 'EN_PREPARACION' }];
    const harness = createRecoveryHarness({ initialPedidos });
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta() { return paidVenta; }
    });

    assert.equal(recovery.reconciliation.status, 'same');
    assert.equal(harness.state.pedidos, initialPedidos);
    assert.equal(harness.calls.boardUpdates.length, 1);
    assert.equal(harness.calls.modalUpdates[0].id_factura, 41);
    await harness.secondClick();
    assert.equal(harness.calls.printCalls[0].idFactura, 41);
  });

  it('reconcilia el conflicto 41 contra 58 y el segundo clic usa la factura efectiva 58', async () => {
    const initialPedidos = [{ id_pedido: 12, id_factura: 58, estado: 'EN_PREPARACION' }];
    const harness = createRecoveryHarness({ initialPedidos });
    const venta58 = { ...paidVenta, id_factura: 58, numero_venta: 'VTA-00058' };
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        if (idFactura === 41) return paidVenta;
        if (idFactura === 58) return venta58;
        throw new Error('Factura inesperada.');
      }
    });

    assert.equal(recovery.reconciliation.status, 'conflict');
    assert.deepEqual(harness.calls.getByIdCalls, [41, 58]);
    assert.equal(harness.state.pedidos, initialPedidos);
    assert.equal(harness.state.pedidos[0].id_factura, 58);
    assert.equal(harness.calls.boardUpdates.length, 1);
    const modalVenta = harness.calls.modalUpdates[0];
    assert.equal(modalVenta.id_factura, 58);

    await harness.secondClick();
    const printCall = harness.calls.printCalls[0];
    assert.equal(printCall.idFactura, 58);
    assert.notEqual(printCall.idFactura, 41);
  });

  it('revalida el segundo clic tardio y reemplaza 58 por 77 sin imprimir automaticamente', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58, estado: 'EN_PREPARACION' }]
    });
    await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        return idFactura === 58 ? { ...paidVenta, id_factura: 58 } : paidVenta;
      }
    });
    harness.coordinator.commit([
      { id_pedido: 12, id_factura: 77, estado: 'EN_PREPARACION' }
    ]);

    const refresh = await harness.secondClick({
      async fetchVenta(idFactura) {
        assert.equal(idFactura, 77);
        return { ...paidVenta, id_factura: 77, numero_venta: 'VTA-00077' };
      }
    });

    assert.equal(refresh.status, 'refresh');
    assert.deepEqual(harness.calls.getByIdCalls, [41, 58, 77]);
    assert.equal(harness.state.pedidos[0].id_factura, 77);
    assert.equal(harness.state.venta.id_factura, 77);
    assert.equal(harness.calls.modalUpdates.at(-1).id_factura, 77);
    assert.equal(harness.calls.printCalls.length, 0);

    const manualRetry = await harness.secondClick();
    assert.equal(manualRetry.status, 'printed');
    assert.equal(harness.calls.printCalls.length, 1);
    assert.equal(harness.calls.printCalls[0].idFactura, 77);
    assert.notEqual(harness.calls.printCalls[0].idFactura, 58);
  });

  it('falla cerrado si la factura cambia otra vez mientras el segundo clic carga 77', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58 }]
    });
    await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        return idFactura === 58 ? { ...paidVenta, id_factura: 58 } : paidVenta;
      }
    });
    harness.coordinator.commit([{ id_pedido: 12, id_factura: 77 }]);
    const factura77 = createDeferred();
    const factura77Started = createDeferred();
    const secondClickPromise = harness.secondClick({
      fetchVenta(idFactura) {
        assert.equal(idFactura, 77);
        factura77Started.resolve();
        return factura77.promise;
      }
    });

    await factura77Started.promise;
    harness.coordinator.commit([{ id_pedido: 12, id_factura: 88 }]);
    factura77.resolve({ ...paidVenta, id_factura: 77 });
    const result = await secondClickPromise;

    assert.equal(result.status, 'changed');
    assert.equal(harness.state.pedidos[0].id_factura, 88);
    assert.equal(harness.state.venta.id_factura, 58);
    assert.equal(harness.calls.printCalls.length, 0);
  });

  it('falla cerrado si el pedido desaparece despues de abrir el modal recuperado', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58 }]
    });
    await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        return idFactura === 58 ? { ...paidVenta, id_factura: 58 } : paidVenta;
      }
    });
    harness.coordinator.commit([{ id_pedido: 99, id_factura: null }]);

    const result = await harness.secondClick();
    assert.equal(result.status, 'missing');
    assert.equal(harness.calls.printCalls.length, 0);
    assert.equal(harness.state.pedidos.some((pedido) => pedido.id_pedido === 12), false);
  });

  it('falla cerrado si el pedido vuelve a quedar sin factura antes del segundo clic', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58 }]
    });
    await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta(idFactura) {
        return idFactura === 58 ? { ...paidVenta, id_factura: 58 } : paidVenta;
      }
    });
    harness.coordinator.commit([{ id_pedido: 12, id_factura: null }]);

    const result = await harness.secondClick();
    assert.equal(result.status, 'changed');
    assert.equal(harness.calls.printCalls.length, 0);
    assert.equal(harness.state.pedidos[0].id_factura, null);
  });

  it('falla cerrado si el pedido recuperado ya no existe en el tablero', async () => {
    const currentPedidos = [{ id_pedido: 99, id_factura: null }];
    const harness = createRecoveryHarness({ initialPedidos: currentPedidos });
    const recovery = await harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      async fetchVenta() { return paidVenta; }
    });

    assert.equal(recovery.recovered, false);
    assert.equal(recovery.reconciliation.status, 'missing');
    assert.equal(harness.state.pedidos, currentPedidos);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
    await harness.secondClick();
    assert.equal(harness.calls.printCalls.length, 0);
  });

  it('falla cerrado si la factura cambia de 58 a 77 durante getById', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58, estado: 'EN_PREPARACION' }]
    });
    const venta58Deferred = createDeferred();
    const venta58Started = createDeferred();
    const recoveryPromise = harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      fetchVenta(idFactura) {
        if (idFactura === 41) return paidVenta;
        venta58Started.resolve();
        return venta58Deferred.promise;
      }
    });

    await venta58Started.promise;
    harness.coordinator.commit([
      { id_pedido: 12, id_factura: 77, estado: 'EN_PREPARACION' }
    ]);
    venta58Deferred.resolve({ ...paidVenta, id_factura: 58 });
    const recovery = await recoveryPromise;

    assert.equal(recovery.recovered, false);
    assert.equal(recovery.reconciliation.status, 'changed');
    assert.deepEqual(harness.calls.getByIdCalls, [41, 58]);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
    await harness.secondClick();
    assert.equal(harness.calls.printCalls.length, 0);
  });

  it('ignora getById del conflicto si el detalle se cierra mientras espera', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58 }]
    });
    const venta58Deferred = createDeferred();
    const venta58Started = createDeferred();
    const recoveryPromise = harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      fetchVenta(idFactura) {
        if (idFactura === 41) return paidVenta;
        venta58Started.resolve();
        return venta58Deferred.promise;
      }
    });

    await venta58Started.promise;
    harness.controller.closeDetail();
    harness.state.venta = null;
    venta58Deferred.resolve({ ...paidVenta, id_factura: 58 });
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assert.equal(harness.controller.getState().open, false);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('ignora getById del conflicto si cambia la sucursal mientras espera', async () => {
    const harness = createRecoveryHarness({
      sucursalId: 1,
      initialPedidos: [{ id_pedido: 12, id_factura: 58, id_sucursal: 1 }]
    });
    const venta58Deferred = createDeferred();
    const venta58Started = createDeferred();
    const recoveryPromise = harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_sucursal: 1, id_factura: 41 }]; },
      fetchVenta(idFactura) {
        if (idFactura === 41) return paidVenta;
        venta58Started.resolve();
        return venta58Deferred.promise;
      }
    });

    await venta58Started.promise;
    harness.controller.changeSucursal(2);
    harness.state.venta = null;
    venta58Deferred.resolve({ ...paidVenta, id_factura: 58, id_sucursal: 1 });
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('mantiene el pedido B si se abre mientras el conflicto del pedido A espera', async () => {
    const harness = createRecoveryHarness({
      initialPedidos: [{ id_pedido: 12, id_factura: 58 }]
    });
    const venta58Deferred = createDeferred();
    const venta58Started = createDeferred();
    const recoveryPromise = harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      fetchVenta(idFactura) {
        if (idFactura === 41) return paidVenta;
        venta58Started.resolve();
        return venta58Deferred.promise;
      }
    });

    await venta58Started.promise;
    harness.controller.openDetail({ idPedido: 99, sucursalId: 2 });
    harness.state.venta = { id_pedido: 99, id_factura: null };
    venta58Deferred.resolve({ ...paidVenta, id_factura: 58 });
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assert.equal(harness.state.venta.id_pedido, 99);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('ignora la recuperacion si el modal se cierra antes de resolver pedidos', async () => {
    const harness = createRecoveryHarness();
    const pedidosDeferred = createDeferred();
    const recoveryPromise = harness.runRecovery({
      fetchPedidos: () => pedidosDeferred.promise,
      async fetchVenta() { throw new Error('No debe cargar factura.'); }
    });

    harness.controller.closeDetail();
    pedidosDeferred.resolve([{ ...pendingPedido, id_factura: 41 }]);
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assert.equal(harness.controller.getState().open, false);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('mantiene el pedido B cuando termina tarde la recuperacion del pedido A', async () => {
    const harness = createRecoveryHarness();
    const pedidosDeferred = createDeferred();
    const recoveryPromise = harness.runRecovery({
      fetchPedidos: () => pedidosDeferred.promise,
      async fetchVenta() { throw new Error('No debe cargar factura.'); }
    });

    harness.controller.openDetail({ idPedido: 99, sucursalId: 2 });
    harness.state.venta = { id_pedido: 99, id_factura: null };
    pedidosDeferred.resolve([{ ...pendingPedido, id_factura: 41 }]);
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assert.equal(harness.state.venta.id_pedido, 99);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('descarta resultados de la sucursal anterior y mantiene cerrado el detalle', async () => {
    const harness = createRecoveryHarness({ sucursalId: 1 });
    const pedidosDeferred = createDeferred();
    const recoveryPromise = harness.runRecovery({
      fetchPedidos: () => pedidosDeferred.promise,
      async fetchVenta() { throw new Error('No debe cargar factura.'); }
    });

    harness.controller.changeSucursal(2);
    pedidosDeferred.resolve([{ ...pendingPedido, id_sucursal: 1, id_factura: 41 }]);
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assert.deepEqual(
      harness.controller.getState(),
      { mounted: true, version: 3, open: false, idPedido: null, sucursalId: 2 }
    );
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('solo permite aplicar la ultima de dos recuperaciones consecutivas', async () => {
    const harness = createRecoveryHarness();
    const first = createDeferred();
    const second = createDeferred();
    const firstPromise = harness.runRecovery({
      fetchPedidos: () => first.promise,
      async fetchVenta() { throw new Error('R1 no debe cargar factura.'); }
    });
    const secondPromise = harness.runRecovery({
      fetchPedidos: () => second.promise,
      async fetchVenta() { return paidVenta; }
    });

    second.resolve([{ ...pendingPedido, id_factura: 41 }]);
    const secondResult = await secondPromise;
    first.resolve([{ ...pendingPedido, id_factura: 41 }]);
    const firstResult = await firstPromise;

    assert.equal(secondResult.recovered, true);
    assert.equal(firstResult.stale, true);
    assert.equal(harness.calls.boardUpdates.length, 1);
    assert.equal(harness.calls.modalUpdates.length, 1);
    assert.equal(harness.calls.toastCalls.length, 1);
    assert.equal(harness.calls.printCalls.length, 0);
  });

  it('impide que una carga getById atrasada reemplace otro pedido', async () => {
    const controller = createDetailOperationController();
    const detailDeferred = createDeferred();
    const state = { venta: { id_pedido: 12 } };
    const operationA = controller.openDetail({ idPedido: 12, sucursalId: 2 });
    const loadA = detailDeferred.promise.then((venta) => {
      if (!controller.complete(operationA)) return false;
      state.venta = venta;
      return true;
    });

    controller.openDetail({ idPedido: 99, sucursalId: 2 });
    state.venta = { id_pedido: 99 };
    detailDeferred.resolve({ id_pedido: 12, id_factura: 41 });

    assert.equal(await loadA, false);
    assert.equal(state.venta.id_pedido, 99);
  });

  it('ignora la recuperacion al desmontar el componente', async () => {
    const harness = createRecoveryHarness();
    const ventaDeferred = createDeferred();
    const ventaStarted = createDeferred();
    const recoveryPromise = harness.runRecovery({
      async fetchPedidos() { return [{ ...pendingPedido, id_factura: 41 }]; },
      fetchVenta() {
        ventaStarted.resolve();
        return ventaDeferred.promise;
      }
    });

    await ventaStarted.promise;
    harness.controller.unmount();
    ventaDeferred.resolve(paidVenta);
    const recovery = await recoveryPromise;

    assert.equal(recovery.stale, true);
    assertNoRecoveryUiOrPrintSideEffects(harness.calls);
  });

  it('mantiene fallo cerrado cuando el pedido actualizado no tiene factura', async () => {
    let fetchVentaCalls = 0;
    const recovery = await recoverFacturedPedidoPrintSource({
      error: { code: 'PRINT_PEDIDO_SOURCE_INVALID' },
      idPedido: 12,
      async fetchPedidos() { return [pendingPedido]; },
      async fetchVenta() { fetchVentaCalls += 1; }
    });
    assert.equal(recovery.handled, true);
    assert.equal(recovery.recovered, false);
    assert.equal(fetchVentaCalls, 0);
    assert.equal(recovery.idFactura, undefined);
  });

  it('mantiene errores independientes de factura y comanda durante fallos y reintentos', () => {
    let errors = createEmptyPrintErrors();
    errors = setDocumentPrintError(errors, 'factura', 'Fallo factura');
    errors = setDocumentPrintError(errors, 'comanda', '');
    assert.deepEqual(errors, { factura: 'Fallo factura', comanda: '' });

    errors = setDocumentPrintError(errors, 'comanda', 'Fallo comanda');
    assert.deepEqual(errors, { factura: 'Fallo factura', comanda: 'Fallo comanda' });
    const html = renderToStaticMarkup(React.createElement(VentaDetallePrintErrors, { errors }));
    assert.match(html, /aria-label="Error de factura"/);
    assert.match(html, /aria-label="Error de comanda"/);

    errors = setDocumentPrintError(errors, 'factura', '');
    assert.deepEqual(errors, { factura: '', comanda: 'Fallo comanda' });
  });
});
