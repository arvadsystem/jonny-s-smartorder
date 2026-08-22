import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProviderToLines, buildProviderDistribution, countProviderReplacements, isMissingProvider } from './solicitudesCompraProviderUtils.js';

const options = [{ value: '1', label: 'COCA-COLA' }, { value: '2', label: 'Proveedor XYZ' }];

test('all asigna a todas, reemplaza distintos y no muta referencias originales', () => {
  const lines = [{ id: 1, id_proveedor: '' }, { id: 2, id_proveedor: '2' }];
  const result = applyProviderToLines(lines, 1, 'all');
  assert.deepEqual(result.map((line) => line.id_proveedor), ['1', '1']);
  assert.notEqual(result, lines);
  assert.notEqual(result[0], lines[0]);
  assert.equal(lines[1].id_proveedor, '2');
});

test('missing rellena todos los vacios y conserva decisiones existentes', () => {
  const lines = [null, undefined, '', 0, '0', '2'].map((id_proveedor, id) => ({ id, id_proveedor }));
  const result = applyProviderToLines(lines, '1', 'missing');
  assert.deepEqual(result.map((line) => line.id_proveedor), ['1', '1', '1', '1', '1', '2']);
});

test('null cadena vacia cero y cero string son proveedores vacios', () => {
  for (const value of [null, undefined, '', 0, '0']) assert.equal(isMissingProvider(value), true);
  assert.equal(isMissingProvider('2'), false);
});

test('distribution representa 9/1 y resuelve nombres solo desde options', () => {
  const lines = [...Array.from({ length: 9 }, () => ({ id_proveedor: '1' })), { id_proveedor: '2' }];
  assert.deepEqual(buildProviderDistribution(lines, options), [
    { id_proveedor: '1', nombre: 'COCA-COLA', cantidad: 9, missing: false },
    { id_proveedor: '2', nombre: 'Proveedor XYZ', cantidad: 1, missing: false },
  ]);
});

test('distribution incluye Sin proveedor como advertencia', () => {
  const result = buildProviderDistribution([{ id_proveedor: '' }, { id_proveedor: '1' }], options);
  assert.deepEqual(result[0], { id_proveedor: '', nombre: 'Sin proveedor', cantidad: 1, missing: true });
});

test('replacement count cuenta unicamente proveedores existentes distintos', () => {
  const lines = [{ id_proveedor: '1' }, { id_proveedor: 1 }, { id_proveedor: '2' }, { id_proveedor: '' }, { id_proveedor: 0 }];
  assert.equal(countProviderReplacements(lines, '1'), 1);
  assert.equal(countProviderReplacements(lines, ''), 0);
});
