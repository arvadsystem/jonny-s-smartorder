import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApprovalPayload,
  buildRejectionPayload,
  createApprovalDraft,
  getRevisionCommentError,
  normalizeRevisionComment,
  parseApprovedQuantity,
  updateApprovalDraftLine,
  validateApprovalDraft
} from './solicitudesCompraRevisionUtils.js';

const detail = (overrides = {}) => ({
  id_solicitud_detalle: 15,
  tipo_item: 'INSUMO',
  id_item: 230,
  nombre: 'Harina',
  categoria: 'Secos',
  presentacion_snapshot: 'Saco',
  cantidad_solicitada: 2,
  cantidad_base_solicitada: 50,
  unidad_base: 'Kilogramo',
  stock_actual: 20,
  stock_minimo: 5,
  estado_stock: 'DISPONIBLE',
  cantidad_aprobada: null,
  proveedor: null,
  ...overrides
});

test('borrador conserva dos presentaciones del mismo insumo mediante IDs reales distintos', () => {
  const draft = createApprovalDraft([
    detail(),
    detail({ id_solicitud_detalle: 16, presentacion_snapshot: 'Bolsa', cantidad_solicitada: 3 })
  ]);
  assert.deepEqual(draft.map((line) => line.id_solicitud_detalle), [15, 16]);
  assert.equal(draft.length, 2);
  assert.ok(draft.every((line) => line.id_solicitud_detalle !== line.id_item));
});

test('cantidad inicial usa solicitada y la aprobada existente tiene prioridad', () => {
  assert.equal(createApprovalDraft([detail()])[0].cantidad_aprobada, '2');
  assert.equal(createApprovalDraft([detail({ cantidad_aprobada: 1.5 })])[0].cantidad_aprobada, '1.5');
});

test('proveedor existente queda preseleccionado', () => {
  const draft = createApprovalDraft([detail({ proveedor: { id_proveedor: 8, nombre_proveedor: 'Proveedor' } })]);
  assert.equal(draft[0].id_proveedor, '8');
});

test('actualizacion usa id_solicitud_detalle y no id_item', () => {
  const draft = createApprovalDraft([detail(), detail({ id_solicitud_detalle: 16 })]);
  const updated = updateApprovalDraftLine(draft, 16, { cantidad_aprobada: '4' });
  assert.equal(updated[0].cantidad_aprobada, '2');
  assert.equal(updated[1].cantidad_aprobada, '4');
  assert.strictEqual(updateApprovalDraftLine(draft, 230, { cantidad_aprobada: '9' })[0], draft[0]);
});

test('producto acepta entero y rechaza decimal', () => {
  assert.equal(parseApprovedQuantity('3', 'PRODUCTO'), 3);
  assert.equal(parseApprovedQuantity('3.5', 'PRODUCTO'), null);
});

test('insumo acepta cuatro decimales y rechaza cinco', () => {
  assert.equal(parseApprovedQuantity('1.2345', 'INSUMO'), 1.2345);
  assert.equal(parseApprovedQuantity('1.23456', 'INSUMO'), null);
});

for (const value of ['0', '-1']) test(`cantidad ${value} se rechaza`, () => {
  assert.equal(parseApprovedQuantity(value, 'INSUMO'), null);
  assert.equal(parseApprovedQuantity(value, 'PRODUCTO'), null);
});

test('validacion bloquea proveedor faltante', () => {
  const draft = createApprovalDraft([detail()]);
  const validation = validateApprovalDraft(draft);
  assert.equal(validation.valid, false);
  assert.equal(validation.errors['15'].proveedor, 'Selecciona un proveedor.');
});

test('validacion bloquea IDs duplicados y ausentes', () => {
  const duplicate = createApprovalDraft([detail(), detail()]).map((line) => ({ ...line, id_proveedor: '5' }));
  assert.equal(validateApprovalDraft(duplicate).valid, false);
  const missing = createApprovalDraft([detail({ id_solicitud_detalle: null })]);
  assert.match(validateApprovalDraft(missing).general.join(' '), /id_solicitud_detalle/);
});

test('detalle vacio bloquea aprobacion', () => {
  assert.equal(validateApprovalDraft([]).valid, false);
});

test('payload de aprobacion contiene exclusivamente campos autorizados', () => {
  const draft = createApprovalDraft([detail({ proveedor: { id_proveedor: 5 } })]);
  const payload = buildApprovalPayload({ comentario: '  compra   urgente ', detalles: draft });
  assert.deepEqual(payload, {
    comentario_revision: 'compra urgente',
    detalles: [{ id_solicitud_detalle: 15, cantidad_aprobada: 2, id_proveedor: 5 }]
  });
  assert.doesNotMatch(JSON.stringify(payload), /id_item|tipo_item|nombre|presentacion|stock|cantidad_solicitada|cantidad_base|precio|costo|impuesto|total/);
});

test('comentario de aprobacion puede ser null', () => {
  const draft = createApprovalDraft([detail({ proveedor: { id_proveedor: 5 } })]);
  assert.equal(buildApprovalPayload({ comentario: ' ', detalles: draft }).comentario_revision, null);
});

test('payload de rechazo solo contiene comentario normalizado', () => {
  assert.deepEqual(buildRejectionPayload('  No   procede\npor stock  '), { comentario_revision: 'No procede por stock' });
  assert.equal(normalizeRevisionComment(' a   b '), 'a b');
});

test('rechazo exige comentario y limita mil caracteres', () => {
  assert.throws(() => buildRejectionPayload('   '), /obligatorio/);
  assert.throws(() => buildRejectionPayload('x'.repeat(1001)), /1,000/);
  assert.equal(getRevisionCommentError('x'.repeat(1000), true), '');
  assert.match(getRevisionCommentError('x'.repeat(1001), true), /1,000/);
});
