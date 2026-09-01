import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  VENTA_LINE_MAX_QUANTITY,
  parseVentaLineQuantity
} from './ventasCartUtils.js';
import {
  getProjectedStock,
  hasStockShortage,
  isSaleBlockedByStock
} from './ventasStockPolicy.js';

const saleCases = [
  { stock: 48, requestedQuantity: 1, projectedStock: 47, shortage: false },
  { stock: 48, requestedQuantity: 48, projectedStock: 0, shortage: false },
  { stock: 48, requestedQuantity: 49, projectedStock: -1, shortage: true },
  { stock: 0, requestedQuantity: 1, projectedStock: -1, shortage: true },
  { stock: -1, requestedQuantity: 1, projectedStock: -2, shortage: true },
  { stock: -10, requestedQuantity: 25, projectedStock: -35, shortage: true }
];

describe('politica de stock de Ventas', () => {
  for (const testCase of saleCases) {
    it(`permite vender ${testCase.requestedQuantity} con stock ${testCase.stock}`, () => {
      assert.equal(
        getProjectedStock(testCase.stock, testCase.requestedQuantity),
        testCase.projectedStock
      );
      assert.equal(
        hasStockShortage(testCase.stock, testCase.requestedQuantity),
        testCase.shortage
      );
      assert.equal(
        isSaleBlockedByStock(testCase.stock, testCase.requestedQuantity),
        false
      );
    });
  }

  it('calcula el stock proyectado sin limitar resultados negativos', () => {
    assert.equal(getProjectedStock(3, 8), -5);
    assert.equal(getProjectedStock(-4, 6), -10);
  });

  it('acepta valores numericos serializados por la API', () => {
    assert.equal(getProjectedStock('48', '49'), -1);
    assert.equal(hasStockShortage('-10', '25'), true);
  });

  it('distingue el deficit como informacion sin convertirlo en bloqueo', () => {
    assert.equal(hasStockShortage(5, 6), true);
    assert.equal(isSaleBlockedByStock(5, 6), false);
  });

  it('mantiene el limite tecnico existente independiente del stock', () => {
    assert.equal(VENTA_LINE_MAX_QUANTITY, 999);
    assert.equal(parseVentaLineQuantity(VENTA_LINE_MAX_QUANTITY), 999);
    assert.equal(parseVentaLineQuantity(VENTA_LINE_MAX_QUANTITY + 1), null);
    assert.equal(isSaleBlockedByStock(5, VENTA_LINE_MAX_QUANTITY), false);
  });

  it('no oculta valores de inventario invalidos como un deficit', () => {
    assert.throws(() => getProjectedStock(undefined, 1), TypeError);
    assert.throws(() => getProjectedStock(5, Number.NaN), TypeError);
  });
});
