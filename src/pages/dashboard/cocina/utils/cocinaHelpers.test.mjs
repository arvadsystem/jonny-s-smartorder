import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyKitchenTransition,
  groupOrdersByColumn
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
