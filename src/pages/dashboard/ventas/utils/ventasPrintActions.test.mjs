import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildComandaIdempotencyKey,
  buildFacturaReprintIdempotencyKey,
  createComandaPrompt,
  createDetailOperationController,
  createDocumentPrintGuard,
  createEmptyPrintErrors,
  enqueueAgentPrintAction,
  prepareComandaPrintWindow,
  recoverFacturedPedidoPrintSource,
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

const createRecoveryHarness = ({ idPedido = 12, sucursalId = 2 } = {}) => {
  const controller = createDetailOperationController();
  controller.openDetail({ idPedido, sucursalId });
  const calls = { pedidos: 0, modal: 0, toast: 0, print: 0 };
  const state = { venta: pendingPedido, pedidos: [] };

  const runRecovery = ({ fetchPedidos, fetchVenta }) => {
    const operation = controller.beginOperation({ idPedido, sucursalId });
    return recoverFacturedPedidoPrintSource({
      error: { code: 'PRINT_PEDIDO_SOURCE_INVALID' },
      idPedido,
      fetchPedidos,
      fetchVenta,
      isCurrent: () => controller.isCurrent(operation),
      applyRecovery(result) {
        if (!controller.complete(operation)) return false;
        calls.pedidos += 1;
        calls.modal += 1;
        calls.toast += 1;
        state.pedidos = result.pedidos;
        state.venta = {
          ...result.venta,
          id_pedido: idPedido,
          id_factura: result.idFactura
        };
        return true;
      }
    });
  };

  return { calls, controller, runRecovery, state };
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
    assert.deepEqual(harness.calls, { pedidos: 1, modal: 1, toast: 1, print: 0 });
    assert.equal(harness.state.venta.id_factura, 41);

    const sourceType = harness.state.venta.id_factura ? 'factura' : 'pedido';
    await enqueueAgentPrintAction({
      ventasApi: {
        async enqueuePrintJob(idFactura, payload) {
          harness.calls.print += 1;
          assert.equal(idFactura, 41);
          assert.equal(payload.tipo_documento, 'comanda');
        },
        async enqueuePedidoPrintJob() { throw new Error('No debe reusar el endpoint de pedido.'); }
      },
      documentType: 'comanda',
      venta: harness.state.venta,
      sourceType,
      action: 'reprint',
      createUniqueValue: () => 'segundo-clic'
    });
    assert.deepEqual(harness.calls, { pedidos: 1, modal: 1, toast: 1, print: 1 });
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
    assert.deepEqual(harness.calls, { pedidos: 0, modal: 0, toast: 0, print: 0 });
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
    assert.deepEqual(harness.calls, { pedidos: 0, modal: 0, toast: 0, print: 0 });
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
    assert.deepEqual(harness.calls, { pedidos: 0, modal: 0, toast: 0, print: 0 });
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
    assert.deepEqual(harness.calls, { pedidos: 1, modal: 1, toast: 1, print: 0 });
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
    assert.deepEqual(harness.calls, { pedidos: 0, modal: 0, toast: 0, print: 0 });
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
