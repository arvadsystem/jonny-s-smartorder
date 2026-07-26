import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConversionPreview,
  formatConversionQuantity,
  multiplyConversionDecimal,
  normalizeConversionDecimal,
  subtractConversionDecimal
} from './solicitudesCompraConversionUtils.js';

test('multiplicacion decimal exacta cubre conversiones operativas', () => {
  assert.equal(multiplyConversionDecimal('3', '200'), '600');
  assert.equal(multiplyConversionDecimal('1.5', '200'), '300');
  assert.equal(multiplyConversionDecimal('0.25', '200'), '50');
  assert.equal(multiplyConversionDecimal('2.5', '0.5'), '1.25');
  assert.equal(multiplyConversionDecimal('0.1', '3'), '0.3');
});

test('multiplicacion redondea half-up a seis decimales sin usar Number como fuente', () => {
  assert.equal(multiplyConversionDecimal('1.234567', '1.000001'), '1.234568');
  assert.equal(multiplyConversionDecimal('0.000001', '0.5'), '0.000001');
  assert.equal(multiplyConversionDecimal('3', '0.166667'), '0.500001');
});

test('normalizacion rechaza valores no contractuales', () => {
  for (const value of ['0', '-1', '1.1234567', '1e3', 'NaN', '']) {
    assert.equal(normalizeConversionDecimal(value), null);
  }
  assert.equal(normalizeConversionDecimal('200.000000'), '200');
  assert.equal(normalizeConversionDecimal('1.000000'), '1');
  assert.equal(normalizeConversionDecimal('0.166667'), '0.166667');
  assert.equal(normalizeConversionDecimal('0.000001'), '0.000001');
  assert.equal(formatConversionQuantity('1200.500000'), '1,200.5');
});

test('preview conserva presentacion configurada y calcula base', () => {
  assert.deepEqual(buildConversionPreview({
    quantity: '3',
    presentationLabel: 'Fardos',
    baseUnit: 'Unidades',
    factor: '200'
  }), {
    valid: true,
    baseOnly: false,
    quantity: '3',
    presentationLabel: 'Fardos',
    baseQuantity: '600',
    baseUnit: 'Unidades',
    factor: '200',
    text: '3 Fardos equivalen a 600 Unidades'
  });
});

test('preview base evita equivalencia duplicada y diferencia acepta signo', () => {
  const preview = buildConversionPreview({
    quantity: '3',
    presentationLabel: 'Unidades',
    baseUnit: 'Unidades',
    factor: '1',
    baseOnly: true
  });
  assert.equal(preview.baseOnly, true);
  assert.equal(preview.text, '3 Unidades');
  assert.equal(subtractConversionDecimal('1.5', '2'), '-0.5');
  assert.equal(subtractConversionDecimal('300', '400'), '-100');
});
