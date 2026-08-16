import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOLICITUD_ESTADOS, addDecimalQuantities, buildSolicitudPayload, buildVisualEquivalence,
  getDraftLineKey, getEstadoInfo, mapSolicitudError, normalizeObservation,
  parseRequestedQuantity, upsertDraftLine
} from './solicitudesCompraUtils.js';

test('producto acepta entero positivo', () => assert.equal(parseRequestedQuantity('3', 'producto'), 3));
for (const value of ['1.5', '0', '-1', 'abc', '']) test(`producto rechaza ${value || 'vacio'}`, () => assert.equal(parseRequestedQuantity(value, 'producto'), null));
test('insumo acepta hasta seis decimales como texto canonico', () => assert.equal(parseRequestedQuantity('1.123456', 'insumo'), '1.123456'));
for (const value of ['1.1234567', '0', '-2', '.5', '1e-6']) test(`insumo rechaza ${value}`, () => assert.equal(parseRequestedQuantity(value, 'insumo'), null));
test('llave visual distingue unidad base de presentacion', () => {
  assert.equal(getDraftLineKey({ tipo_item: 'insumo', id_item: 2 }), 'insumo:2:base');
  assert.equal(getDraftLineKey({ tipo_item: 'insumo', id_item: 2, id_presentacion_insumo: 4 }), 'insumo:2:4');
});
test('suma decimal exacta 0.1 + 0.2', () => assert.equal(addDecimalQuantities('0.1', '0.2'), '0.3'));
test('suma decimal exacta conserva seis decimales', () => assert.equal(addDecimalQuantities('1.123456', '2.000001'), '3.123457'));
test('suma decimal minima conserva precision', () => assert.equal(addDecimalQuantities('0.000001', '0.000002'), '0.000003'));
test('duplicado de misma presentacion se combina', () => {
  const line = { tipo_item: 'insumo', id_item: 2, id_presentacion_insumo: 4, cantidad: 2 };
  const result = upsertDraftLine([line], { ...line, cantidad: 3 });
  assert.equal(result.lines.length, 1); assert.equal(result.lines[0].cantidad, '5'); assert.equal(result.merged, true);
});
test('dos productos enteros se combinan y el resultado sigue valido', () => {
  const line = { tipo_item: 'producto', id_item: 9, cantidad: '2' };
  const result = upsertDraftLine([line], { ...line, cantidad: '3' });
  assert.equal(result.lines[0].cantidad, '5');
  assert.equal(parseRequestedQuantity(result.lines[0].cantidad, 'producto'), 5);
});
test('resultado decimal combinado sigue valido para insumo', () => {
  const line = { tipo_item: 'insumo', id_item: 2, cantidad: '1.123456' };
  const result = upsertDraftLine([line], { ...line, cantidad: '0.000001' });
  assert.equal(parseRequestedQuantity(result.lines[0].cantidad, 'insumo'), '1.123457');
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
const visualLine = {
  tipo_item: 'insumo', id_item: 2, id_presentacion_insumo: 4, cantidad: '2',
  presentacion: 'Fardos', nombre_presentacion_visual: 'Fardos',
  factor_conversion_visual: '200', unidad_base_visual: 'Unidades'
};
test('equivalencia inicial usa la cantidad actual', () => assert.equal(buildVisualEquivalence(visualLine), '2 Fardos ≈ 400 Unidades'));
test('editar cantidad recalcula la equivalencia', () => assert.equal(buildVisualEquivalence({ ...visualLine, cantidad: '3' }), '3 Fardos ≈ 600 Unidades'));
test('combinar lineas recalcula cinco fardos y mil unidades', () => {
  const result = upsertDraftLine([visualLine], { ...visualLine, cantidad: '3' });
  assert.equal(buildVisualEquivalence(result.lines[0]), '5 Fardos ≈ 1,000 Unidades');
});
test('unidad base no genera conversion', () => assert.equal(buildVisualEquivalence({ ...visualLine, id_presentacion_insumo: undefined }), null));
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
  const payload = buildSolicitudPayload({ idAlmacen: 4, observacion: ' ok ', detalles: [{
    tipo_item: 'producto', id_item: 1, cantidad: 3, factor_conversion_snapshot: 9,
    cantidad_base_solicitada: 27, factor_conversion_visual: '200',
    unidad_base_visual: 'Unidades', nombre_presentacion_visual: 'Fardos',
    equivalencia: 'congelada', precio: 50, proveedor: 2
  }] });
  assert.deepEqual(payload, { id_almacen: 4, observacion: 'ok', detalles: [{ tipo_item: 'producto', id_item: 1, cantidad: 3 }] });
  assert.doesNotMatch(JSON.stringify(payload), /id_sucursal|id_usuario|proveedor|precio|costo|impuesto|total|factor_conversion|cantidad_base|unidad_base_visual|nombre_presentacion_visual|equivalencia/);
});
for (const state of ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'RECIBIDA', 'CANCELADA']) test(`estado ${state} tiene copy nuevo`, () => assert.ok(getEstadoInfo(state).label && getEstadoInfo(state).message));
test('utils no contiene estados legacy', () => assert.equal(JSON.stringify(SOLICITUD_ESTADOS).includes('EN_COMPRA') || JSON.stringify(SOLICITUD_ESTADOS).includes('ABASTECIDA'), false));
for (const [status, expected] of [[403, 'No tienes permiso'], [404, 'ya no está disponible'], [409, 'cambió'], [500, 'No fue posible']]) test(`error ${status} se mapea`, () => assert.match(mapSolicitudError({ status }), new RegExp(expected)));
test('validacion especifica del backend se conserva', () => assert.equal(mapSolicitudError({ status: 400, message: 'La cantidad es inválida.' }), 'La cantidad es inválida.'));
test('409 de unidad allowlisted conserva el mensaje accionable del backend', () => {
  const message = "CONCENTRADO PINA: la presentacion 'Bote' utiliza una unidad base diferente. Revisa la presentacion en Inventario.";
  assert.equal(mapSolicitudError({ status: 409, code: 'PRESENTACION_UNIDAD_BASE_INCOMPATIBLE', message }), message);
});
test('otro conflicto allowlisted conserva su mensaje seguro', () => {
  const message = 'La sucursal requiere una asignación explícita de almacén.';
  assert.equal(mapSolicitudError({ status: 409, data: { code: 'SCOPE_AMBIGUOUS', message }, message }), message);
});
test('409 desconocido usa fallback y no muestra su mensaje arbitrario', () => {
  const result = mapSolicitudError({ status: 409, code: 'OTRO_CONFLICTO', message: 'Mensaje no autorizado.' });
  assert.equal(result, 'La solicitud o el inventario cambió. Actualiza la información y vuelve a intentar.');
});
for (const technicalMessage of [
  'duplicate key value violates unique constraint foo',
  'relation public.foo does not exist',
  'SELECT * FROM secretos'
]) {
  test(`conflicto conocido no filtra detalle tecnico: ${technicalMessage}`, () => {
    const result = mapSolicitudError({ status: 409, code: 'PRESENTACION_UNIDAD_BASE_INCOMPATIBLE', message: technicalMessage });
    assert.equal(result, 'La solicitud o el inventario cambió. Actualiza la información y vuelve a intentar.');
  });
}
