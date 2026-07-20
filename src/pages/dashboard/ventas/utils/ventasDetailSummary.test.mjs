import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVentaDetailSummary } from './ventasDetailSummary.js';

describe('venta detail summary', () => {
  it('clasifica extras independientes como extras (no base) sin duplicar adjuntos en VTA-00002', () => {
    const summary = buildVentaDetailSummary({
      total: 80108,
      items: [
        {
          sub_total: 11368,
          origen_snapshot: { subtotal_extras: 34370 }
        },
        { sub_total: 34370, es_linea_extra_independiente: true }
      ]
    });

    // base = solo el producto (11368); extras = adjuntos (34370) + independiente (34370)
    assert.equal(summary.base_items, 11368);
    assert.equal(summary.extras, 68740);
    assert.equal(summary.subtotal_bruto, 80108);
    assert.equal(summary.total, 80108);
  });

  it('coincide con el ejemplo del hallazgo: base 140, extras 240+280', () => {
    const summary = buildVentaDetailSummary({
      items: [
        { sub_total: 140, origen_snapshot: { subtotal_extras: 240 } },
        { sub_total: 280, es_linea_extra_independiente: true }
      ]
    });

    assert.equal(summary.base_items, 140);
    assert.equal(summary.extras, 520);
    assert.equal(summary.subtotal_bruto, 660);
  });

  it('recupera extras asociados anidados cuando el snapshot historico guarda cero', () => {
    const summary = buildVentaDetailSummary({
      total: 2520,
      items: [
        {
          tipo_item: 'RECETA',
          cantidad: 1,
          sub_total: 1900,
          origen_snapshot: { subtotal_extras: 0 },
          extras: [{ nombre: 'Extra asociado', cantidad: 2, precio_unitario: 300, subtotal: 600 }]
        },
        {
          tipo_item: 'EXTRA',
          cantidad: 2,
          sub_total: 20,
          es_linea_extra_independiente: true,
          extras: []
        }
      ]
    });

    assert.deepEqual(summary, {
      base_items: 1900,
      extras: 620,
      subtotal_bruto: 2520,
      total: 2520
    });
  });

  it('no duplica extras cuando snapshot y detalle anidado representan el mismo importe', () => {
    const summary = buildVentaDetailSummary({
      items: [{
        tipo_item: 'PRODUCTO',
        cantidad: 2,
        sub_total: 200,
        origen_snapshot: { subtotal_extras: 40 },
        extras: [{ cantidad: 2, precio_unitario: 20, subtotal: 40 }]
      }]
    });

    assert.equal(summary.base_items, 200);
    assert.equal(summary.extras, 40);
    assert.equal(summary.subtotal_bruto, 240);
  });

  it('clasifica solo extras independientes sin base', () => {
    const summary = buildVentaDetailSummary({
      total: 480,
      items: [{ sub_total: 480, tipo_item: 'EXTRA', es_linea_extra_independiente: true }]
    });

    assert.equal(summary.base_items, 0);
    assert.equal(summary.extras, 480);
    assert.equal(summary.subtotal_bruto, 480);
    assert.equal(summary.total, 480);
  });

  it('clasifica la linea ITEM del carrito como extra independiente antes del pago', () => {
    const summary = buildVentaDetailSummary({
      items: [{
        kind: 'ITEM',
        entityId: 4,
        id_extra: 4,
        id_producto: null,
        id_receta: null,
        precio_unitario: 10,
        cantidad: 2,
        extras: []
      }]
    });

    assert.equal(summary.base_items, 0);
    assert.equal(summary.extras, 20);
    assert.equal(summary.subtotal_bruto, 20);
  });

  it('conserva el total historico con producto receta cantidades descuento e ISV', () => {
    const summary = buildVentaDetailSummary({
      total: 345.75,
      items: [
        { tipo_item: 'PRODUCTO', cantidad: 2, sub_total: 200, extras: [{ cantidad: 2, subtotal: 30 }] },
        { tipo_item: 'RECETA', cantidad: 3, sub_total: 120, origen_snapshot: { subtotal_extras: 45 } },
        { tipo_item: 'EXTRA', cantidad: 4, sub_total: 20, es_linea_extra_independiente: true }
      ]
    });

    assert.equal(summary.base_items, 320);
    assert.equal(summary.extras, 95);
    assert.equal(summary.subtotal_bruto, 415);
    assert.equal(summary.total, 345.75);
  });

  it('preserva un total historico valido de cero', () => {
    const summary = buildVentaDetailSummary({
      total: 0,
      items: [{ tipo_item: 'PRODUCTO', sub_total: 100 }]
    });
    assert.equal(summary.subtotal_bruto, 100);
    assert.equal(summary.total, 0);
  });
});
