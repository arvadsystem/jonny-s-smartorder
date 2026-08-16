import assert from 'node:assert/strict';
import test from 'node:test';
import { formatKardexFecha, parseKardexUtcDate } from './kardexDateTime.js';

const normalizeVisibleText = (value) =>
  String(value)
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

test('timestamp PostgreSQL sin zona se interpreta como UTC y se muestra en Honduras', () => {
  const formatted = normalizeVisibleText(formatKardexFecha('2026-08-16 04:35:16.590447'));

  assert.equal(parseKardexUtcDate('2026-08-16 04:35:16.590447').toISOString(), '2026-08-16T04:35:16.590Z');
  assert.match(formatted, /^15\/08\/2026,? 10:35 p\. m\.$/i);
});

test('timestamp con Z representa el mismo instante local sin doble conversion', () => {
  const withoutZone = normalizeVisibleText(formatKardexFecha('2026-08-16 04:35:16.590447'));
  const withZulu = normalizeVisibleText(formatKardexFecha('2026-08-16T04:35:16.590Z'));

  assert.equal(withZulu, withoutZone);
});

test('valores nulos e invalidos mantienen un fallback seguro', () => {
  assert.equal(formatKardexFecha(null), '-');
  assert.equal(formatKardexFecha(undefined), '-');
  assert.equal(formatKardexFecha('fecha-invalida'), 'fecha-invalida');
});
