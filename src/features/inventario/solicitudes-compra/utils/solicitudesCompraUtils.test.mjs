import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLICITUD_ESTADOS, buildSolicitudPayload, getDraftLineKey, getEstadoInfo,
  mapSolicitudError, normalizeObservation, parseRequestedQuantity, upsertDraftLine
} from './solicitudesCompraUtils.js';

test('producto acepta entero positivo', () => assert.equal(parseRequestedQuantity('3', 'producto'), 3));
for (const value of ['1.5', '0', '-1', 'abc', '']) test(`producto rechaza ${value || 'vacio'}`, () => assert.equal(parseRequestedQuantity(value, 'producto'), null));
test('insumo acepta hasta cuatro decimales', () => assert.equal(parseRequestedQuantity('1.2345', 'insumo'), 1.2345));
for (const value of ['1.23456', '0', '-2', '.5']) test(`insumo rechaza ${value}`, () => assert.equal(parseRequestedQuantity(value, 'insumo'), null));
test('llave visual distingue unidad base de presentacion', () => {
  assert.equal(getDraftLineKey({ tipo_item: 'insumo', id_item: 2 }), 'insumo:2:base');
  assert.equal(getDraftLineKey({ tipo_item: 'insumo', id_item: 2, id_presentacion_insumo: 4 }), 'insumo:2:4');
});
test('duplicado de misma presentacion se combina', () => {
  const line = { tipo_item: 'insumo', id_item: 2, id_presentacion_insumo: 4, cantidad: 2 };
  const result = upsertDraftLine([line], { ...line, cantidad: 3 });
  assert.equal(result.lines.length, 1); assert.equal(result.lines[0].cantidad, 5); assert.equal(result.merged, true);
});
test('dos presentaciones diferentes generan dos lineas', () => {
  const first = { tipo_item: 'insumo', id_item: 2, id_presentacion_insumo: 4, cantidad: 2 };
  const result = upsertDraftLine([first], { ...first, id_presentacion_insumo: 5 });
  assert.equal(result.lines.length, 2); assert.equal(result.merged, false);
});
test('unidad base y presentacion del mismo insumo son lineas distintas', () => {
  const first = { tipo_item: 'insumo', id_item: 2, cantidad: 2 };
  assert.equal(upsertDraftLine([first], { ...first, id_presentacion_insumo: 5 }).lines.length, 2);
});
test('observacion normaliza espacios', () => assert.equal(normalizeObservation('  falta   pollo\n mañana  '), 'falta pollo mañana'));
test('observacion vacia se vuelve null', () => assert.equal(normalizeObservation('   '), null));
test('payload de presentacion incluye id_presentacion_insumo', () => {
  const payload = buildSolicitudPayload({ idAlmacen: '4', observacion: '', detalles: [{ tipo_item: 'insumo', id_item: 8, id_presentacion_insumo: 3, cantidad: '2' }] });
  assert.equal(payload.detalles[0].id_presentacion_insumo, 3);
});
test('payload de unidad base omite presentacion', () => {
  const payload = buildSolicitudPayload({ idAlmacen: 4, detalles: [{ tipo_item: 'insumo', id_item: 8, cantidad: 2 }] });
  assert.equal(Object.hasOwn(payload.detalles[0], 'id_presentacion_insumo'), false);
});
test('payload solo contiene contrato autorizado', () => {
  const payload = buildSolicitudPayload({ idAlmacen: 4, observacion: ' ok ', detalles: [{ tipo_item: 'producto', id_item: 1, cantidad: 3, factor_conversion_snapshot: 9, cantidad_base_solicitada: 27, precio: 50, proveedor: 2 }] });
  assert.deepEqual(payload, { id_almacen: 4, observacion: 'ok', detalles: [{ tipo_item: 'producto', id_item: 1, cantidad: 3 }] });
  assert.doesNotMatch(JSON.stringify(payload), /id_sucursal|id_usuario|proveedor|precio|costo|impuesto|total|factor_conversion|cantidad_base/);
});
for (const state of ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'RECIBIDA', 'CANCELADA']) test(`estado ${state} tiene copy nuevo`, () => assert.ok(getEstadoInfo(state).label && getEstadoInfo(state).message));
test('utils no contiene estados legacy', () => assert.equal(JSON.stringify(SOLICITUD_ESTADOS).includes('EN_COMPRA') || JSON.stringify(SOLICITUD_ESTADOS).includes('ABASTECIDA'), false));
for (const [status, expected] of [[403, 'No tienes permiso'], [404, 'ya no está disponible'], [409, 'cambió'], [500, 'No fue posible']]) test(`error ${status} se mapea`, () => assert.match(mapSolicitudError({ status }), new RegExp(expected)));
test('validacion especifica del backend se conserva', () => assert.equal(mapSolicitudError({ status: 400, message: 'La cantidad es inválida.' }), 'La cantidad es inválida.'));
