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
});
