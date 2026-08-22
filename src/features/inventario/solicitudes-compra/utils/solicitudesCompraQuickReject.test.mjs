import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildRejectionPayload,
  canQuickReject,
  getRevisionCommentError,
  mapRevisionError
} from './solicitudesCompraRevisionUtils.js';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('rechazo rapido depende de capacidad backend true y estado PENDIENTE', async () => {
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  assert.match(source, /canQuickReject\(solicitud, canReject\)/);
  assert.doesNotMatch(source, /CAJERO|COCINA|ADMINISTRADOR|SUPER_ADMIN/);
});

for (const scenario of [
  { name: 'permiso y capacidad en PENDIENTE', permission: true, capability: true, state: 'PENDIENTE', expected: true },
  { name: 'administrador sin permiso efectivo', permission: false, capability: true, state: 'PENDIENTE', expected: false },
  { name: 'operativo con permiso legacy', permission: true, capability: false, state: 'PENDIENTE', expected: false },
  { name: 'sin permiso ni capacidad', permission: false, capability: false, state: 'PENDIENTE', expected: false },
  { name: 'APROBADA aunque ambos sean true', permission: true, capability: true, state: 'APROBADA', expected: false }
]) {
  test(`visibilidad: ${scenario.name}`, () => {
    assert.equal(canQuickReject({ estado: scenario.state, acciones: { puede_rechazar: scenario.capability } }, scenario.permission), scenario.expected);
  });
}

test('tab y listado propagan canReject hasta rechazo rapido', async () => {
  const [tab, list] = await Promise.all([
    read('../SolicitudesCompraTab.jsx'),
    read('../components/SolicitudesCompraListado.jsx')
  ]);
  assert.match(tab, /SolicitudesCompraListado[\s\S]*canReject=\{canReject\}/);
  assert.match(list, /SolicitudCompraRechazoRapido solicitud=\{item\} canReject=\{canReject\}/);
});

test('listado no muestra accion fuera del componente autorizado', async () => {
  const source = await read('../components/SolicitudesCompraListado.jsx');
  assert.match(source, /SolicitudCompraRechazoRapido solicitud=\{item\}/);
});

test('clic inicial abre modal y no llama API directamente', async () => {
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  assert.match(source, /onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(source, /open \? \(/);
  assert.doesNotMatch(source, /onClick=\{\(\) => solicitudesCompraService\.rechazarSolicitud/);
});

test('motivo obligatorio y maximo mil reutilizan utilidades existentes', () => {
  assert.match(getRevisionCommentError('', true), /obligatorio/);
  assert.equal(getRevisionCommentError('Solicitud duplicada', true), '');
  assert.match(getRevisionCommentError('x'.repeat(1001), true), /1,000/);
  assert.deepEqual(buildRejectionPayload(' Solicitud   duplicada '), { comentario_revision: 'Solicitud duplicada' });
});

test('presets requeridos completan un comentario editable', async () => {
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  for (const preset of ['Solicitud duplicada', 'Creada por error', 'Ya no se requiere', 'Otro motivo']) assert.match(source, new RegExp(preset));
  assert.match(source, /setComment\(preset\)/);
  assert.match(source, /onChange=\{\(event\) => setComment\(event\.target\.value\)\}/);
});

test('confirmar usa endpoint existente y payload exacto', async () => {
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  assert.match(source, /const payload = buildRejectionPayload\(comment\)/);
  assert.match(source, /rechazarSolicitud\(solicitud\.id_solicitud_compra, payload\)/);
});

test('action lock impide doble submit y bloquea controles durante request', async () => {
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  assert.match(source, /if \(actionLock\.current \|\| commentError\) return/);
  assert.match(source, /actionLock\.current = true/);
  assert.match(source, /disabled=\{busy \|\| Boolean\(commentError\)\}/);
  assert.match(source, /Rechazando…/);
});

test('exito muestra toast cierra limpia y refresca listado canonico', async () => {
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  assert.match(source, /SOLICITUD RECHAZADA/);
  assert.match(source, /setOpen\(false\)[\s\S]*setComment\(''\)[\s\S]*await onRefresh\?\.\(\)/);
});

test('409 muestra error cierra y refresca; 403 no simula exito', async () => {
  assert.equal(mapRevisionError({ status: 409 }, 'reject'), 'La solicitud cambió y ya no puede rechazarse.');
  assert.equal(mapRevisionError({ status: 403 }, 'reject'), 'No tienes permiso para rechazar esta solicitud.');
  const source = await read('../components/SolicitudCompraRechazoRapido.jsx');
  assert.match(source, /if \(error\?\.status === 409\)[\s\S]*setOpen\(false\)[\s\S]*await onRefresh\?\.\(\)/);
});

test('detalle administrativo también exige capacidad efectiva del backend', async () => {
  const detail = await read('../components/SolicitudCompraDetalle.jsx');
  assert.match(detail, /canReject=\{canReject && request\.acciones\?\.puede_rechazar === true\}/);
  const panel = await read('../components/SolicitudCompraRevisionPanel.jsx');
  assert.match(panel, /Rechazar solicitud/);
});
