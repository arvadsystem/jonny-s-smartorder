import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyKitchenTransition,
  groupKitchenItems,
  groupOrdersByColumn,
  normalizeKitchenOrder
} from './cocinaHelpers.js';

const order = (id, status, values = {}) => ({
  id_pedido: id,
  estado_codigo: status,
  columna_kds: status === 'EN_PREPARACION' ? 'EN_PREPARACION' : 'PENDIENTES',
  ...values
});

test('pendientes conserva orden ascendente por visibilidad y desempata por id', () => {
  const grouped = groupOrdersByColumn([
    order(30, 'EN_COCINA', { visible_en_cocina_at: '2026-07-20T15:00:00Z' }),
    order(12, 'EN_COCINA', { visible_en_cocina_at: '2026-07-20T14:00:00Z' }),
    order(11, 'EN_COCINA', { visible_en_cocina_at: '2026-07-20T14:00:00Z' })
  ]);

  assert.deepEqual(grouped.PENDIENTES.map((item) => item.id_pedido), [11, 12, 30]);
});

test('preparacion prioriza la primera transicion y usa los fallbacks operativos', () => {
  const grouped = groupOrdersByColumn([
    order(3, 'EN_PREPARACION', {
      en_preparacion_at: '2026-07-20T16:00:00Z',
      visible_en_cocina_at: '2026-07-20T13:00:00Z'
    }),
    order(2, 'EN_PREPARACION', {
      en_preparacion_at: '2026-07-20T15:00:00Z',
      visible_en_cocina_at: '2026-07-20T14:00:00Z'
    }),
    order(1, 'EN_PREPARACION', {
      fecha_hora_facturacion: '2026-07-20T14:30:00Z'
    })
  ]);

  assert.deepEqual(grouped.EN_PREPARACION.map((item) => item.id_pedido), [1, 2, 3]);
});

test('transicion optimista conserva la marca persistida devuelta por backend', () => {
  const transitioned = applyKitchenTransition(
    [order(8, 'EN_COCINA', { en_preparacion_at: null })],
    8,
    'EN_PREPARACION',
    { en_preparacion_at: '2026-07-20T17:30:00Z' }
  );

  assert.equal(transitioned[0].en_preparacion_at, '2026-07-20T17:30:00Z');
});

test('pedido mixto separa preparaciones y recordatorios de entrega', () => {
  const normalized = normalizeKitchenOrder({
    id_pedido: 80,
    items: [
      { id_detalle: 1, id_receta: 20, id_producto: null, tipo_item: 'RECETA', instruccion_operativa: 'PREPARAR', nombre_item: 'Hamburguesa', cantidad: 1 },
      { id_detalle: 2, id_receta: null, id_producto: 10, tipo_item: 'PRODUCTO', instruccion_operativa: 'ENTREGAR_JUNTO_CON_EL_PEDIDO', nombre_item: 'Refresco', cantidad: 2 }
    ]
  });
  const groups = groupKitchenItems(normalized.items);
  assert.deepEqual(groups.preparar.map((item) => item.nombre_item), ['Hamburguesa']);
  assert.deepEqual(groups.entregarJunto.map((item) => item.nombre_item), ['Refresco']);
});

test('multiples productos de un pedido mixto permanecen como recordatorios', () => {
  const normalized = normalizeKitchenOrder({
    id_pedido: 81,
    items: [
      { id_receta: 20, tipo_item: 'RECETA', instruccion_operativa: 'PREPARAR', nombre_item: 'Combo', cantidad: 1 },
      { id_producto: 10, tipo_item: 'PRODUCTO', instruccion_operativa: 'ENTREGAR_JUNTO_CON_EL_PEDIDO', nombre_item: 'Refresco', cantidad: 1 },
      { id_producto: 11, tipo_item: 'PRODUCTO', instruccion_operativa: 'ENTREGAR_JUNTO_CON_EL_PEDIDO', nombre_item: 'Helado', cantidad: 1 }
    ]
  });
  const groups = groupKitchenItems(normalized.items);
  assert.equal(groups.preparar.length, 1);
  assert.equal(groups.entregarJunto.length, 2);
  assert.ok(groups.entregarJunto.every((item) => item.instruccion_operativa === 'ENTREGAR_JUNTO_CON_EL_PEDIDO'));
});
