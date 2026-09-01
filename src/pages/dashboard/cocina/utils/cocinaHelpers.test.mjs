import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyKitchenTransition,
  formatKdsDeliveryModeLabel,
  formatKdsOriginLabel,
  groupKitchenItems,
  groupOrdersByColumn,
  matchesKitchenOrder,
  normalizeKitchenOrder
} from './cocinaHelpers.js';

const order = (id, status, values = {}) => ({
  id_pedido: id,
  estado_codigo: status,
  columna_kds: status === 'EN_PREPARACION' ? 'EN_PREPARACION' : 'PENDIENTES',
  ...values
});

test('etiquetas KDS distinguen origen y modalidad sin ocultar anomalías', () => {
  assert.equal(formatKdsOriginLabel('LOCAL'), 'Local');
  assert.equal(formatKdsOriginLabel('DELIVERY'), 'Delivery');
  assert.equal(formatKdsOriginLabel('WEB'), 'Web');
  assert.equal(formatKdsOriginLabel('NO_DEFINIDO'), 'Origen no definido');
  assert.equal(formatKdsDeliveryModeLabel('COMER_AQUI'), 'Comer aquí');
  assert.equal(formatKdsDeliveryModeLabel('PARA_LLEVAR'), 'Para llevar');
});

test('normalización conserva combinaciones KDS y payload antiguo no inventa origen', () => {
  for (const [origin, mode] of [['WEB', 'DELIVERY'], ['LOCAL', 'PARA_LLEVAR'], ['LOCAL', 'COMER_AQUI']]) {
    const normalized = normalizeKitchenOrder({ id_pedido: 90, origen_pedido_kds: origin, modalidad_entrega_kds: mode });
    assert.deepEqual([normalized.origen_pedido_kds, normalized.modalidad_entrega_kds], [origin, mode]);
  }
  const legacy = normalizeKitchenOrder({ id_pedido: 91, tipo_servicio: 'PARA_LLEVAR' });
  assert.deepEqual([legacy.origen_pedido_kds, legacy.modalidad_entrega_kds], ['NO_DEFINIDO', 'PARA_LLEVAR']);
});

test('búsqueda encuentra etiquetas de origen y modalidad', () => {
  const webDelivery = normalizeKitchenOrder({ id_pedido: 92, origen_pedido_kds: 'WEB', modalidad_entrega_kds: 'DELIVERY' });
  const localPickup = normalizeKitchenOrder({ id_pedido: 93, origen_pedido_kds: 'LOCAL', modalidad_entrega_kds: 'PARA_LLEVAR' });
  const localDineIn = normalizeKitchenOrder({ id_pedido: 94, origen_pedido_kds: 'LOCAL', modalidad_entrega_kds: 'COMER_AQUI' });
  assert.equal(matchesKitchenOrder(webDelivery, 'web'), true);
  assert.equal(matchesKitchenOrder(webDelivery, 'delivery'), true);
  assert.equal(matchesKitchenOrder(localPickup, 'para llevar'), true);
  assert.equal(matchesKitchenOrder(localDineIn, 'comer aquí'), true);
});

test('CocinaOrderCard usa origen estructurado y no duplica badge Online', async () => {
  const source = await readFile(new URL('../components/CocinaOrderCard.jsx', import.meta.url), 'utf8');
  assert.match(source, /pedido\.origen_pedido_kds/);
  assert.match(source, /pedido\?\.modalidad_entrega_kds/);
  assert.doesNotMatch(source, /descripcion_pedido[\s\S]*public-menu/i);
  assert.doesNotMatch(source, />\s*Online\s*</i);
  assert.doesNotMatch(source, /tipo_servicio \|\| 'LOCAL'/);
});

test('CocinaPage reutiliza CocinaBoard y CocinaOrderCard como árbol único', async () => {
  const page = await readFile(new URL('../CocinaPage.jsx', import.meta.url), 'utf8');
  const board = await readFile(new URL('../components/CocinaBoard.jsx', import.meta.url), 'utf8');
  const column = await readFile(new URL('../components/CocinaColumn.jsx', import.meta.url), 'utf8');
  assert.match(page, /<CocinaBoard/);
  assert.match(board, /<CocinaColumn/);
  assert.match(column, /<CocinaOrderCard/);
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
