import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApprovalPayload, createAdministrativeApprovalLine, createApprovalDraft, validateApprovalDraft } from './solicitudesCompraRevisionUtils.js';
import { applyProviderToLines, buildProviderDistribution } from './solicitudesCompraProviderUtils.js';

const persisted = createApprovalDraft([{ id_solicitud_detalle: 10, id_item: 44, tipo_item: 'PRODUCTO', nombre: 'COCA-COLA', cantidad_solicitada: '5', proveedor: { id_proveedor: 7 }, origen_linea: 'SUCURSAL' }])[0];

test('producto administrativo es temporal editable y no suplanta origen de sucursal', () => {
  const added = createAdministrativeApprovalLine({ tipo_item: 'producto', id_item: 55, nombre: 'AGUA', cantidad: 3, presentacion: 'Unidad', unidad_base_visual: 'Unidades' });
  assert.equal(added.id_solicitud_detalle, null);
  assert.equal(added.origen_linea, 'ADMINISTRACION');
  assert.equal(added.cantidad_aprobada, '3');
  assert.equal(persisted.origen_linea, 'SUCURSAL');
});

test('insumo administrativo conserva presentacion visual pero payload omite snapshots origen base y almacen', () => {
  const added = { ...createAdministrativeApprovalLine({ tipo_item: 'insumo', id_item: 51, id_presentacion_insumo: 90, nombre: 'Jarabe', cantidad: '1.123456', presentacion: 'Caja', factor_conversion_visual: '200', unidad_base_visual: 'ml' }), id_proveedor: '8' };
  const payload = buildApprovalPayload({ comentario: '', detalles: [persisted, added] });
  assert.deepEqual(payload.detalles[1], { tipo_item: 'insumo', id_item: 51, id_presentacion_insumo: 90, cantidad_aprobada: '1.123456', id_proveedor: 8 });
  for (const forbidden of ['origen_linea', 'factor_conversion_snapshot', 'cantidad_base', 'id_almacen', 'id_sucursal']) assert.equal(Object.hasOwn(payload.detalles[1], forbidden), false);
});

test('validacion bloquea nueva sin proveedor y bulk incluye originales y nuevas', () => {
  const added = createAdministrativeApprovalLine({ tipo_item: 'producto', id_item: 55, nombre: 'AGUA', cantidad: 3 });
  assert.equal(validateApprovalDraft([persisted, added]).valid, false);
  const assigned = applyProviderToLines([persisted, added], '7', 'all');
  assert.equal(validateApprovalDraft(assigned).valid, true);
  assert.deepEqual(buildProviderDistribution(assigned, [{ value: '7', label: 'COCA-COLA' }]), [{ id_proveedor: '7', nombre: 'COCA-COLA', cantidad: 2, missing: false }]);
});

test('ocho originales y dos nuevas producen union payload de diez lineas', () => {
  const originals = Array.from({ length: 8 }, (_, index) => ({ ...persisted, id_solicitud_detalle: index + 1, _line_key: `persisted-${index + 1}` }));
  const additions = [55, 56].map((id) => ({ ...createAdministrativeApprovalLine({ tipo_item: 'producto', id_item: id, nombre: `Producto ${id}`, cantidad: 1 }), id_proveedor: '7' }));
  const payload = buildApprovalPayload({ comentario: null, detalles: [...originals, ...additions] });
  assert.equal(payload.detalles.length, 10);
  assert.equal(payload.detalles.filter((line) => line.id_solicitud_detalle).length, 8);
  assert.equal(payload.detalles.filter((line) => line.id_item).length, 2);
});
