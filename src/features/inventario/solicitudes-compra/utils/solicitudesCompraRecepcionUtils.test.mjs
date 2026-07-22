import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_INVOICE_SIZE,
  buildReceptionPayload,
  compareDecimalQuantities,
  createReceptionDraft,
  detectImageMimeFromBytes,
  getReceptionDifferences,
  getReceptionObservationError,
  mapReceptionError,
  normalizeReceptionObservation,
  parseReceivedQuantity,
  updateReceptionDraftLine,
  validateInvoiceBytes,
  validateInvoiceMetadata,
  validateReceptionDraft
} from './solicitudesCompraRecepcionUtils.js';

const detail = (overrides = {}) => ({
  id_solicitud_detalle: 15,
  tipo_item: 'PRODUCTO',
  nombre: 'Hamburguesa',
  categoria: 'Comida',
  presentacion_snapshot: 'Unidad',
  cantidad_aprobada: 3,
  cantidad_base_aprobada: 3,
  proveedor: { id_proveedor: 8, nombre_proveedor: 'Proveedor' },
  cantidad_recibida: null,
  ...overrides
});

const invoice = (type = 'image/jpeg', size = 100) => ({ name: 'factura.jpg', type, size });
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0x01]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

test('borrador conserva id_solicitud_detalle y prioriza cantidad recibida', () => {
  const [existing] = createReceptionDraft([detail({ cantidad_recibida: 2 })]);
  const [initial] = createReceptionDraft([detail()]);
  assert.equal(existing.id_solicitud_detalle, 15);
  assert.equal(existing.cantidad_recibida, '2');
  assert.equal(initial.cantidad_recibida, '3');
  assert.equal('id_item' in existing, false);
});

test('actualizacion usa exclusivamente el id real del detalle', () => {
  const lines = createReceptionDraft([detail(), detail({ id_solicitud_detalle: 16, nombre: 'Papas' })]);
  const updated = updateReceptionDraftLine(lines, 16, '4');
  assert.equal(updated[0].cantidad_recibida, '3');
  assert.equal(updated[1].cantidad_recibida, '4');
});

test('producto acepta entero positivo y rechaza decimal, cero y negativos', () => {
  assert.equal(parseReceivedQuantity('3', 'PRODUCTO'), 3);
  assert.equal(parseReceivedQuantity('3.5', 'PRODUCTO'), null);
  assert.equal(parseReceivedQuantity('0', 'PRODUCTO'), null);
  assert.equal(parseReceivedQuantity('-1', 'PRODUCTO'), null);
});

test('insumo acepta cuatro decimales y rechaza cinco, cero y negativos', () => {
  assert.equal(parseReceivedQuantity('2.1234', 'INSUMO'), 2.1234);
  assert.equal(parseReceivedQuantity('2.12345', 'INSUMO'), null);
  assert.equal(parseReceivedQuantity('0', 'INSUMO'), null);
  assert.equal(parseReceivedQuantity('-0.5', 'INSUMO'), null);
});

test('comparacion decimal normaliza escala exacta de cuatro decimales', () => {
  assert.equal(compareDecimalQuantities('2', '2.0'), 0);
  assert.equal(compareDecimalQuantities('2.0000', '2'), 0);
  assert.equal(compareDecimalQuantities('1.9999', '2'), -1);
  assert.equal(compareDecimalQuantities('2.0001', '2'), 1);
});

test('diferencias identifican cantidades menores y mayores', () => {
  const lines = createReceptionDraft([
    detail({ cantidad_recibida: 2 }),
    detail({ id_solicitud_detalle: 16, cantidad_aprobada: 2, cantidad_base_aprobada: 2, cantidad_recibida: 3 })
  ]);
  assert.deepEqual(getReceptionDifferences(lines).map((line) => line.id_solicitud_detalle), [15, 16]);
});

test('diferencia exige observacion y sin diferencia permite null', () => {
  assert.match(getReceptionObservationError('   ', true), /Explica/);
  assert.equal(getReceptionObservationError('', false), '');
  assert.equal(normalizeReceptionObservation('  recibido   con daño  '), 'recibido con daño');
  assert.equal(normalizeReceptionObservation('   '), null);
});

test('observacion respeta maximo de mil caracteres', () => {
  assert.equal(getReceptionObservationError('a'.repeat(1000), false), '');
  assert.match(getReceptionObservationError('a'.repeat(1001), false), /1,000/);
});

test('integridad bloquea falta de cantidad aprobada, base o proveedor', () => {
  const missingApproved = validateReceptionDraft(createReceptionDraft([detail({ cantidad_aprobada: null })]));
  const missingBase = validateReceptionDraft(createReceptionDraft([detail({ cantidad_base_aprobada: null })]));
  const missingProvider = validateReceptionDraft(createReceptionDraft([detail({ proveedor: null })]));
  assert.equal(missingApproved.valid, false);
  assert.equal(missingBase.valid, false);
  assert.equal(missingProvider.valid, false);
});

test('integridad bloquea IDs faltantes y duplicados sin fabricarlos', () => {
  const missing = createReceptionDraft([detail({ id_solicitud_detalle: null })]);
  const duplicate = createReceptionDraft([detail(), detail({ nombre: 'Otra línea' })]);
  assert.equal(missing[0].id_solicitud_detalle, null);
  assert.equal(validateReceptionDraft(missing).valid, false);
  assert.equal(validateReceptionDraft(duplicate).valid, false);
});

test('metadatos aceptan imagenes permitidas y rechazan PDF, SVG, vacios y exceso', () => {
  assert.equal(validateInvoiceMetadata(invoice('image/jpeg')).valid, true);
  assert.equal(validateInvoiceMetadata(invoice('image/png')).valid, true);
  assert.equal(validateInvoiceMetadata(invoice('image/webp')).valid, true);
  assert.equal(validateInvoiceMetadata(invoice('application/pdf')).valid, false);
  assert.equal(validateInvoiceMetadata(invoice('image/svg+xml')).valid, false);
  assert.equal(validateInvoiceMetadata(invoice('image/jpeg', 0)).valid, false);
  assert.equal(validateInvoiceMetadata(invoice('image/jpeg', MAX_INVOICE_SIZE)).valid, true);
  assert.equal(validateInvoiceMetadata(invoice('image/jpeg', MAX_INVOICE_SIZE + 1)).valid, false);
});

test('firmas binarias detectan JPEG, PNG y WEBP', () => {
  assert.equal(detectImageMimeFromBytes(jpeg), 'image/jpeg');
  assert.equal(detectImageMimeFromBytes(png), 'image/png');
  assert.equal(detectImageMimeFromBytes(webp), 'image/webp');
});

test('firma invalida o MIME falso quedan rechazados', () => {
  assert.equal(validateInvoiceBytes(invoice('image/jpeg'), Uint8Array.from([1, 2, 3])).valid, false);
  assert.equal(validateInvoiceBytes(invoice('image/png'), jpeg).valid, false);
  assert.equal(validateInvoiceBytes(invoice('image/jpeg'), png).valid, false);
  assert.equal(validateInvoiceBytes(invoice('image/webp'), Uint8Array.from([0x52, 0x49, 0x46, 0x46])).valid, false);
});

test('payload contiene solo contrato autorizado y omite metadatos visuales', () => {
  const detalles = createReceptionDraft([detail()]);
  const payload = buildReceptionPayload({
    observacion: '  Todo   completo ',
    detalles,
    factura: { nombre_original: 'factura.jpg', mime_type: 'image/jpeg', data_url: 'data:image/jpeg;base64,/9j/' }
  });
  assert.deepEqual(Object.keys(payload).sort(), ['detalles', 'factura', 'observacion_recepcion']);
  assert.deepEqual(Object.keys(payload.factura).sort(), ['data_url', 'mime_type', 'nombre_original']);
  assert.deepEqual(Object.keys(payload.detalles[0]).sort(), ['cantidad_recibida', 'id_solicitud_detalle']);
  assert.equal(payload.observacion_recepcion, 'Todo completo');
  assert.equal('cantidad_base_recibida' in payload.detalles[0], false);
  assert.equal('proveedor' in payload.detalles[0], false);
  assert.equal('stock_actual' in payload.detalles[0], false);
});

test('payload sin diferencias permite observacion nula', () => {
  const payload = buildReceptionPayload({
    observacion: '',
    detalles: createReceptionDraft([detail()]),
    factura: { nombre_original: 'factura.jpg', mime_type: 'image/jpeg', data_url: 'data:image/jpeg;base64,/9j/' }
  });
  assert.equal(payload.observacion_recepcion, null);
});

test('payload con diferencia rechaza observacion vacia', () => {
  assert.throws(() => buildReceptionPayload({
    observacion: '  ',
    detalles: createReceptionDraft([detail({ cantidad_recibida: 2 })]),
    factura: { nombre_original: 'factura.jpg', mime_type: 'image/jpeg', data_url: 'data:image/jpeg;base64,/9j/' }
  }), /diferencias/);
});

test('errores de archivo y concurrencia se mapean sin filtrar datos sensibles', () => {
  assert.match(mapReceptionError({ status: 413 }), /6 MB/);
  assert.match(mapReceptionError({ status: 415 }), /JPEG, PNG o WEBP/);
  assert.match(mapReceptionError({ status: 502 }), /guardar o consultar/);
  assert.equal(mapReceptionError({ status: 400, message: 'La cantidad no es válida.' }), 'La cantidad no es válida.');
  assert.doesNotMatch(mapReceptionError({ status: 400, message: 'SQL error bucket privado token abc' }), /SQL|bucket|token/i);
});
