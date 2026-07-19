import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizePrintMode } from '../src/services/printModeService.js';
import { assertBrowserQzAllowed } from '../src/services/printModeGuard.js';
import { buildComandaIdempotencyKey } from '../src/pages/dashboard/ventas/utils/ventasPrintActions.js';

assert.equal(normalizePrintMode('agent'), 'agent');
assert.equal(normalizePrintMode('DIRECT'), 'direct');
assert.equal(normalizePrintMode('unknown'), 'direct');
assert.equal(assertBrowserQzAllowed('direct'), true);
assert.throws(() => assertBrowserQzAllowed('agent'), (error) => error.code === 'QZ_DISABLED_IN_AGENT_MODE');
const page = fs.readFileSync(new URL('../src/pages/dashboard/ventas/VentasPage.jsx', import.meta.url), 'utf8');
const ventasService = fs.readFileSync(new URL('../src/services/ventasService.js', import.meta.url), 'utf8');
const detalleModal = fs.readFileSync(new URL('../src/pages/dashboard/ventas/components/VentaDetalleModal.jsx', import.meta.url), 'utf8');
const detection = fs.readFileSync(new URL('../src/services/printerDeviceDetectionService.js', import.meta.url), 'utf8');
const qzService = fs.readFileSync(new URL('../src/services/qzPrintService.js', import.meta.url), 'utf8');
assert.doesNotMatch(page, /comandaPrompt\.mode|mode:\s*'(?:post-sale|pending-order|reprint)'/);
assert.match(page, /sourceType:\s*'factura'[\s\S]*action:\s*'initial'[\s\S]*origin:\s*'post-sale'/);
assert.match(page, /sourceType:\s*'pedido'[\s\S]*action:\s*'initial'[\s\S]*origin:\s*'pending-order'/);
assert.match(page, /action:\s*'reprint'[\s\S]*origin:\s*'detail'/);
assert.match(page, /enqueueAgentPrintAction/);
assert.match(detalleModal, /Imprimir factura/);
assert.match(detalleModal, /Imprimir comanda/);
assert.match(detalleModal, /Reimprimir comanda/);
assert.equal(buildComandaIdempotencyKey({ sourceType: 'factura', action: 'initial', idFactura: 7 }), 'comanda:7:inicial');
assert.equal(buildComandaIdempotencyKey({ sourceType: 'pedido', action: 'initial', idPedido: 19 }), 'comanda:pedido:19:inicial');
assert.equal(
  buildComandaIdempotencyKey({ sourceType: 'factura', action: 'reprint', idFactura: 7, createUniqueValue: () => 'qa' }),
  'comanda-reprint:7:qa'
);
assert.equal(
  buildComandaIdempotencyKey({ sourceType: 'pedido', action: 'reprint', idPedido: 19, createUniqueValue: () => 'qa' }),
  'comanda:pedido-reprint:19:qa'
);
assert.match(page, /`factura:\$\{idFactura\}:inicial`/);
assert.match(page, /isPendingOrderComanda\s*\? await ventasService\.getPedidoComanda\(venta\.id_pedido\)/);
assert.doesNotMatch(page, /La comanda del pedido pendiente se enviara al agente despues de confirmar la venta/);
const paidPendingOrderStart = page.indexOf('const handleSuccessfulPendingOrderPaymentPrint');
const paidPendingOrderEnd = page.indexOf('const closeComandaPrompt', paidPendingOrderStart);
assert.ok(paidPendingOrderStart >= 0 && paidPendingOrderEnd > paidPendingOrderStart);
const paidPendingOrderFlow = page.slice(paidPendingOrderStart, paidPendingOrderEnd);
assert.match(paidPendingOrderFlow, /printFacturaAfterSuccessfulPayment/);
assert.doesNotMatch(paidPendingOrderFlow, /enqueuePedidoPrintJob|COMANDA/);
assert.match(ventasService, /enqueuePedidoPrintJob:[\s\S]*`\/ventas\/pedidos\/\$\{idPedido\}\/print-jobs`[\s\S]*'POST'[\s\S]*withIdempotencyKey\(\{\}, idempotencyKey\)/);
assert.match(detection, /if \(isAgentPrintMode\(\)\)[\s\S]*status: 'AGENT_MODE'/);
assert.match(qzService, /ensureQzLibrary[\s\S]*assertQzDirectMode\(\)/);
assert.match(qzService, /QZ_DISABLED_IN_AGENT_MODE/);
console.log('qa:print-mode OK');
