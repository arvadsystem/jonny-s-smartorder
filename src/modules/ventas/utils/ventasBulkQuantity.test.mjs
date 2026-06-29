import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildVentaLineConfigSignature,
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
  extras: [{ id_extra: 8, nombre: 'Queso', precio: 10, cantidad: 1 }],
  observacion: 'Bien cocidas',
  id_descuento_catalogo_linea: '',
  ...overrides
});

describe('ventas bulk recipe quantity utilities', () => {
  it('genera la misma firma para configuraciones identicas sin considerar lineId', () => {
    const first = baseRecipeLine({ cartKey: 'RECETA:line:a', lineId: 'a' });
    const second = baseRecipeLine({ cartKey: 'RECETA:line:b', lineId: 'b' });

    assert.equal(buildVentaLineConfigSignature(first), buildVentaLineConfigSignature(second));
  });

  it('distingue firmas por salsa, extras y observacion', () => {
    const base = baseRecipeLine();

    assert.notEqual(
      buildVentaLineConfigSignature(base),
      buildVentaLineConfigSignature(baseRecipeLine({ complementos: [{ id_complemento: 6, nombre: 'Cajun' }] }))
    );
    assert.notEqual(
      buildVentaLineConfigSignature(base),
      buildVentaLineConfigSignature(baseRecipeLine({ extras: [{ id_extra: 9, nombre: 'Tocino', precio: 15, cantidad: 1 }] }))
    );
    assert.notEqual(
      buildVentaLineConfigSignature(base),
      buildVentaLineConfigSignature(baseRecipeLine({ observacion: 'Sin picante' }))
    );
  });

  it('combina lineas identicas conservando una sola configuracion', () => {
    const result = mergeEquivalentVentaLines([
      baseRecipeLine({ cartKey: 'RECETA:line:a', lineId: 'a', cantidad: 50 }),
      baseRecipeLine({ cartKey: 'RECETA:line:b', lineId: 'b', cantidad: 49 })
    ]);

    assert.equal(result.merged, true);
    assert.equal(result.cart.length, 1);
    assert.equal(result.cart[0].cantidad, 99);
    assert.equal(result.cart[0].lineId, 'a');
  });

  it('preserva cantidad al editar complementos y extras antes de fusionar', () => {
    const editedComplement = baseRecipeLine({
      cantidad: 99,
      complementos: [{ id_complemento: 6, nombre: 'Cajun' }]
    });
    const editedExtras = baseRecipeLine({
      cantidad: 99,
      extras: [{ id_extra: 8, nombre: 'Queso', precio: 10, cantidad: 2 }]
    });

    assert.equal(editedComplement.cantidad, 99);
    assert.equal(editedExtras.cantidad, 99);
    assert.notEqual(buildVentaLineConfigSignature(editedComplement), buildVentaLineConfigSignature(editedExtras));
  });

  it('multiplica subtotal de extras por la cantidad de ordenes', () => {
    assert.equal(getLineExtrasSubtotal(baseRecipeLine()), 990);
  });

  it('envia payload de receta con cantidad 99 y extras por orden', () => {
    const [payload] = buildVentaItemsPayload([baseRecipeLine()]);

    assert.equal(payload.id_receta, 12);
    assert.equal(payload.cantidad, 99);
    assert.deepEqual(payload.extras, [{ id_extra: 8, cantidad: 1 }]);
  });

  it('rechaza cantidades invalidas', () => {
    for (const value of [0, -1, 1.5, '2.5', 'abc', '', 1000]) {
      assert.equal(parseVentaLineQuantity(value), null);
    }
    assert.equal(parseVentaLineQuantity(999), 999);
  });
});
