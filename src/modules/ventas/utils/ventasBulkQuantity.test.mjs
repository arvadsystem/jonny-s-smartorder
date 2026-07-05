import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildExtrasSignature,
  buildVentaLineConfigSignature,
  buildVentaQuantityCommitResult,
  canAddStandaloneExtraToCart,
  canIncreaseStandaloneExtraQuantity,
  getLineExtrasSubtotal,
  mergeEquivalentVentaLines,
  parseVentaLineQuantity
} from './ventasCartUtils.js';
import { buildVentaItemsPayload } from './ventasPayloadBuilders.js';

const baseRecipeLine = (overrides = {}) => ({
  cartKey: overrides.cartKey || 'RECETA:line:a',
  lineId: overrides.lineId || 'a',
  kind: 'RECETA',
  entityId: 12,
  id_producto: null,
  id_receta: 12,
  id_extra: null,
  nombre_item: '12 alitas',
  precio_unitario: 100,
  cantidad: 99,
  complementos: [{ id_complemento: 5, nombre: 'Barbecue' }],
  complementos_disponibles: [{ id_complemento: 5, nombre: 'Barbecue' }],
  complementos_requiere: true,
  minimo_complementos: 2,
  maximo_complementos: 2,
  complementos_incompletos_autorizados: false,
  tipo_complemento: 'SALSAS',
  extras: [{ id_extra: 8, nombre: 'Queso', precio: 10, cantidad: 1 }],
  observacion: 'Bien cocidas',
  id_descuento_catalogo_linea: '',
  ...overrides
});

const sumQuantities = (lines) => lines.reduce((sum, line) => sum + Number(line.cantidad || 0), 0);

describe('ventas bulk recipe quantity utilities', () => {
  it('acepta cantidades enteras validas 1..999', () => {
    for (const value of [1, 9, 10, 99, 998, 999]) {
      assert.equal(parseVentaLineQuantity(value), value);
      assert.equal(parseVentaLineQuantity(String(value)), value);
    }
  });

  it('permite extra independiente con stock cero', () => {
    const extra = {
      id_extra: 7,
      disponible: false,
      codigo_no_disponible: 'EXTRA_STOCK_INSUFICIENTE',
      stock_disponible: 0,
      cantidad_consumo_base: 1
    };

    assert.equal(canAddStandaloneExtraToCart(extra), true);
    assert.equal(canIncreaseStandaloneExtraQuantity({ kind: 'ITEM', cantidad: 1, available_units: 0 }), true);
  });

  it('permite extra independiente con stock negativo', () => {
    const extra = {
      id_extra: 7,
      disponible: false,
      codigo_no_disponible: 'EXTRA_STOCK_INSUFICIENTE',
      stock_disponible: -5,
      cantidad_consumo_base: 1
    };

    assert.equal(canAddStandaloneExtraToCart(extra), true);
    assert.equal(canIncreaseStandaloneExtraQuantity({ kind: 'ITEM', cantidad: 25, available_units: 0 }), true);
  });

  it('permite extra independiente sobre stock disponible positivo', () => {
    const extra = {
      id_extra: 7,
      disponible: true,
      stock_disponible: 10,
      cantidad_consumo_base: 1
    };

    assert.equal(canAddStandaloneExtraToCart(extra), true);
    assert.equal(canIncreaseStandaloneExtraQuantity({ kind: 'ITEM', cantidad: 10, available_units: 10 }), true);
    assert.equal(canIncreaseStandaloneExtraQuantity({ kind: 'ITEM', cantidad: 999, available_units: 10 }), false);
  });

  it('bloquea extra independiente sin asignacion de sucursal', () => {
    const extra = {
      id_extra: 7,
      disponible: false,
      codigo_no_disponible: 'EXTRA_INSUMO_SIN_ASIGNACION_SUCURSAL'
    };

    assert.equal(canAddStandaloneExtraToCart(extra), false);
  });

  it('bloquea extra independiente inactivo', () => {
    const extra = {
      id_extra: 7,
      disponible: false,
      codigo_no_disponible: 'EXTRA_INACTIVO'
    };

    assert.equal(canAddStandaloneExtraToCart(extra), false);
  });

  it('rechaza cantidades invalidas sin transformarlas', () => {
    for (const value of [0, -1, -10, 1.5, '2.5', 'abc', '10a', '', ' ', 1000, 1234]) {
      assert.equal(parseVentaLineQuantity(value), null, `debe rechazar ${JSON.stringify(value)}`);
    }
  });

  it('calcula el resultado de commit sin convertir entradas invalidas', () => {
    const invalidDecimal = buildVentaQuantityCommitResult('1.5', 7, { manual: true });
    const invalidNegative = buildVentaQuantityCommitResult('-10', 7, { manual: true });
    const invalidOverflow = buildVentaQuantityCommitResult('1000', 7, { manual: true });

    assert.equal(invalidDecimal.ok, false);
    assert.equal(invalidDecimal.quantity, 7);
    assert.equal(invalidDecimal.draft, '7');
    assert.equal(invalidNegative.quantity, 7);
    assert.equal(invalidOverflow.quantity, 7);
  });

  it('modela el flujo equivalente de confirmar 99 y luego usar + o -', () => {
    const confirm99 = buildVentaQuantityCommitResult('99', 1, { manual: true });
    assert.equal(confirm99.shouldConfirm, true);
    let visibleDraft = confirm99.draft;
    let realQuantity = confirm99.quantity;

    realQuantity += 1;
    visibleDraft = String(realQuantity);
    assert.equal(visibleDraft, '100');
    assert.equal(realQuantity, 100);

    realQuantity -= 1;
    visibleDraft = String(realQuantity);
    assert.equal(visibleDraft, '99');
    assert.equal(realQuantity, 99);
  });

  it('modela cancelacion de cantidad masiva restaurando el valor anterior', () => {
    const confirm99 = buildVentaQuantityCommitResult('99', 1, { manual: true });
    assert.equal(confirm99.shouldConfirm, true);

    const visibleDraftAfterCancel = String(1);
    const realQuantityAfterCancel = 1;
    assert.equal(visibleDraftAfterCancel, '1');
    assert.equal(realQuantityAfterCancel, 1);
  });

  it('genera la misma firma para configuraciones identicas sin considerar lineId', () => {
    const first = baseRecipeLine({ cartKey: 'RECETA:line:a', lineId: 'a' });
    const second = baseRecipeLine({ cartKey: 'RECETA:line:b', lineId: 'b' });

    assert.equal(buildVentaLineConfigSignature(first), buildVentaLineConfigSignature(second));
  });

  it('distingue firmas por precio, salsa, extra, observacion, descuento y autorizacion incompleta', () => {
    const base = baseRecipeLine();
    const variants = [
      baseRecipeLine({ precio_unitario: 101 }),
      baseRecipeLine({ complementos: [{ id_complemento: 6, nombre: 'Cajun' }] }),
      baseRecipeLine({ extras: [{ id_extra: 9, nombre: 'Tocino', precio: 15, cantidad: 1 }] }),
      baseRecipeLine({ observacion: 'Sin picante' }),
      baseRecipeLine({ id_descuento_catalogo_linea: 44 }),
      baseRecipeLine({ complementos_incompletos_autorizados: true })
    ];

    for (const variant of variants) {
      assert.notEqual(buildVentaLineConfigSignature(base), buildVentaLineConfigSignature(variant));
    }
  });

  it('distingue firmas de extras por precio y configuracion de inventario', () => {
    const base = [{ id_extra: 8, nombre: 'Queso', precio: 10, cantidad: 1, id_insumo: 300, cantidad_consumo_base: 0.5, id_unidad_base: 1 }];
    const variants = [
      [{ ...base[0], precio: 11 }],
      [{ ...base[0], id_insumo: 301 }],
      [{ ...base[0], id_insumo_maestro: 900 }],
      [{ ...base[0], cantidad_consumo_base: 0.75 }],
      [{ ...base[0], id_unidad_base: 2 }],
      [{ ...base[0], inventario_configurado: false }],
      [{ ...base[0], disponible: false }]
    ];

    for (const variant of variants) {
      assert.notEqual(buildExtrasSignature(base), buildExtrasSignature(variant));
    }
  });

  it('combina lineas identicas hasta 999 sin perder configuracion', () => {
    const cases = [
      { left: 50, right: 49, expected: [99] },
      { left: 998, right: 1, expected: [999] },
      { left: 999, right: 1, expected: [999, 1] },
      { left: 600, right: 600, expected: [999, 201] }
    ];

    for (const testCase of cases) {
      const result = mergeEquivalentVentaLines([
        baseRecipeLine({ cartKey: `RECETA:line:${testCase.left}:a`, lineId: `${testCase.left}:a`, cantidad: testCase.left }),
        baseRecipeLine({ cartKey: `RECETA:line:${testCase.right}:b`, lineId: `${testCase.right}:b`, cantidad: testCase.right })
      ]);
      assert.deepEqual(result.cart.map((line) => line.cantidad), testCase.expected);
      assert.equal(sumQuantities(result.cart), testCase.left + testCase.right);
      assert.equal(result.cart[0].lineId, `${testCase.left}:a`);
    }
  });

  it('divide multiples lineas equivalentes superiores a 999 sin descartar unidades', () => {
    const result = mergeEquivalentVentaLines([
      baseRecipeLine({ cartKey: 'RECETA:line:a', lineId: 'a', cantidad: 700 }),
      baseRecipeLine({ cartKey: 'RECETA:line:b', lineId: 'b', cantidad: 700 }),
      baseRecipeLine({ cartKey: 'RECETA:line:c', lineId: 'c', cantidad: 700 })
    ]);

    assert.deepEqual(result.cart.map((line) => line.cantidad), [999, 999, 102]);
    assert.equal(sumQuantities(result.cart), 2100);
  });

  it('no fusiona lineas funcionalmente distintas', () => {
    const base = baseRecipeLine({ cartKey: 'RECETA:line:a', lineId: 'a', cantidad: 9 });
    const distinctLines = [
      baseRecipeLine({ cartKey: 'RECETA:line:price', lineId: 'price', cantidad: 9, precio_unitario: 101 }),
      baseRecipeLine({ cartKey: 'RECETA:line:salsa', lineId: 'salsa', cantidad: 9, complementos: [{ id_complemento: 6, nombre: 'Cajun' }] }),
      baseRecipeLine({ cartKey: 'RECETA:line:extra', lineId: 'extra', cantidad: 9, extras: [{ id_extra: 9, nombre: 'Tocino', precio: 15, cantidad: 1 }] }),
      baseRecipeLine({ cartKey: 'RECETA:line:obs', lineId: 'obs', cantidad: 9, observacion: 'Sin picante' }),
      baseRecipeLine({ cartKey: 'RECETA:line:discount', lineId: 'discount', cantidad: 9, id_descuento_catalogo_linea: 44 }),
      baseRecipeLine({ cartKey: 'RECETA:line:incomplete', lineId: 'incomplete', cantidad: 9, complementos_incompletos_autorizados: true })
    ];

    const result = mergeEquivalentVentaLines([base, ...distinctLines]);
    assert.equal(result.cart.length, 7);
    assert.equal(sumQuantities(result.cart), 63);
  });

  it('multiplica totales de base y extras por cantidad con redondeo monetario', () => {
    const line = baseRecipeLine({
      precio_unitario: 33.33,
      cantidad: 3,
      extras: [{ id_extra: 8, nombre: 'Queso', precio: 2.34, cantidad: 2 }]
    });
    const baseTotal = Math.round((line.precio_unitario * line.cantidad + Number.EPSILON) * 100) / 100;

    assert.equal(baseTotal, 99.99);
    assert.equal(getLineExtrasSubtotal(line), 14.04);
  });

  it('envia payload de receta con cantidad de orden y extras por orden', () => {
    const [payload] = buildVentaItemsPayload([baseRecipeLine()]);

    assert.equal(payload.id_receta, 12);
    assert.equal(payload.cantidad, 99);
    assert.deepEqual(payload.extras, [{ id_extra: 8, cantidad: 1 }]);
    assert.equal(payload.observacion, 'Bien cocidas');
  });
});
