import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildVentaDetailSummary } from './ventasDetailSummary.js';

describe('venta detail summary', () => {
  it('usa subtotales historicos y no duplica extras adjuntos en VTA-00002', () => {
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

    assert.equal(summary.base_items, 45738);
    assert.equal(summary.extras, 34370);
    assert.equal(summary.subtotal_bruto, 80108);
    assert.equal(summary.total, 80108);
  });
});
