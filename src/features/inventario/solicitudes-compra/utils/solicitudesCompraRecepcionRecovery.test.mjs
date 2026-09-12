import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReceptionPayload,
  parseReceivedQuantity,
  receiveWithReconciliation,
  uploadInvoiceWithReconciliation
} from './solicitudesCompraRecepcionUtils.js';
import { buildConversionPreview } from './solicitudesCompraConversionUtils.js';

const timeout = () => Object.assign(new Error('timeout'), { status: 408, code: 'REQUEST_TIMEOUT' });
const line = (cantidad) => ({ id_solicitud_detalle: 1, tipo_item: 'PRODUCTO', cantidad_aprobada: 5, cantidad_base_aprobada: 5, cantidad_recibida: cantidad });

test('parser cubre producto 0, 1, decimal y negativo', () => {
  assert.equal(parseReceivedQuantity('0', 'PRODUCTO'), 0);
  assert.equal(parseReceivedQuantity('1', 'PRODUCTO'), 1);
  assert.equal(parseReceivedQuantity('0.5', 'PRODUCTO'), null);
  assert.equal(parseReceivedQuantity('-1', 'PRODUCTO'), null);
});

test('parser cubre insumo 0, decimal y negativo', () => {
  assert.equal(parseReceivedQuantity('0', 'INSUMO'), '0');
  assert.equal(parseReceivedQuantity('0.5', 'INSUMO'), '0.5');
  assert.equal(parseReceivedQuantity('-1', 'INSUMO'), null);
});

test('payload conserva cero y diferencia respecto a aprobado', () => {
  const payload = buildReceptionPayload({ observacion: 'Faltante total', detalles: [line('0')], receptionRequestId: 'id-estable' });
  assert.equal(payload.detalles[0].cantidad_recibida, 0);
  assert.equal(payload.reception_request_id, 'id-estable');
});

test('preview representa entrada cero sin reemplazarla por aprobada', () => {
  const preview = buildConversionPreview({ quantity: '0', factor: '1000', presentationLabel: 'kg', baseUnit: 'g' });
  assert.equal(preview.valid, true); assert.equal(preview.quantity, '0'); assert.equal(preview.baseQuantity, '0');
});

test('UUID de recepcion se conserva tras timeout y retry', async () => {
  const payload = { reception_request_id: 'uuid-1' };
  const result = await receiveWithReconciliation({ idSolicitud: 1, payload, receive: async () => { throw timeout(); }, reconcile: async () => { throw Object.assign(new Error(), { status: 404 }); } });
  assert.equal(result.confirmed, false); assert.equal(result.receptionRequestId, 'uuid-1');
});

test('reconciliacion exitosa convierte timeout en exito', async () => {
  const result = await receiveWithReconciliation({ idSolicitud: 1, payload: { reception_request_id: 'uuid-2' }, receive: async () => { throw timeout(); }, reconcile: async () => ({ confirmed: true }) });
  assert.equal(result.confirmed, true); assert.equal(result.reconciled, true);
});

test('evidencia conserva upload UUID durante reconciliacion', async () => {
  let observed;
  const result = await uploadInvoiceWithReconciliation({ idSolicitud: 1, factura: {}, uploadRequestId: 'upload-1', uploadRequest: async () => { throw timeout(); }, reconcile: async (_id, uuid) => { observed = uuid; return { confirmed: true, evidencia: { id_evidencia: 3 } }; } });
  assert.equal(observed, 'upload-1'); assert.equal(result.confirmed, true);
});

test('evidencia reconciliada se cuenta una sola vez', async () => {
  let uploads = 0;
  const result = await uploadInvoiceWithReconciliation({ idSolicitud: 1, factura: {}, uploadRequestId: 'upload-2', uploadRequest: async () => { uploads += 1; throw timeout(); }, reconcile: async () => ({ confirmed: true }) });
  assert.equal(uploads, 1); assert.equal(result.confirmed, true);
});

test('error real no timeout se propaga', async () => {
  await assert.rejects(() => receiveWithReconciliation({ idSolicitud: 1, payload: {}, receive: async () => { throw Object.assign(new Error('conflict'), { status: 409 }); }, reconcile: async () => ({}) }), /conflict/);
});
