import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('catalogo calcula conversion en tiempo real y conserva bloqueo fase 3', async () => {
  const source = await read('../components/SolicitudCompraCatalogo.jsx');
  assert.match(source, /buildConversionPreview\(\{/);
  assert.match(source, /quantity,/);
  assert.match(source, /Entrada estimada al inventario/);
  assert.match(source, /Conversión tomada de Presentaciones y conversiones/);
  assert.match(source, /Solo unidad base/);
  assert.match(source, /Solicitud por unidad/);
  assert.match(source, /if \(!isSolicitable\) return/);
  assert.match(source, /disabled=\{!isSolicitable\}/);
  assert.match(source, /unidad_presentacion_visual/);
  assert.match(source, /cantidad_presentacion_visual/);
});

test('resumen recalcula equivalencia sin cambiar payload', async () => {
  const [summary, utils] = await Promise.all([
    read('../components/SolicitudCompraResumen.jsx'),
    read('./solicitudesCompraUtils.js')
  ]);
  assert.match(summary, /buildConversionPreview/);
  assert.match(summary, /Cantidad solicitada/);
  assert.match(summary, /Sin presentación de compra\. Solicitud directa en unidad base/);
  assert.match(summary, /onChange\(index, event\.target\.value\)/);
  assert.doesNotMatch(utils.match(/export const buildSolicitudPayload[\s\S]*?^};/m)?.[0] || '', /factor_conversion|cantidad_base|unidad_base_visual|nombre_presentacion_visual/);
});

test('detalle usa snapshots y estados pendientes', async () => {
  const source = await read('../components/SolicitudCompraDetalle.jsx');
  assert.match(source, /isBaseOnlyLine\(line\)/);
  assert.match(source, /<span>Pendiente<\/span>/);
  assert.match(source, /Entrada aplicada/);
  assert.match(source, /Solicitud directa en unidad base/);
  assert.doesNotMatch(source, /insumo_presentaciones|presentacionesService|catalogo/i);
});

test('revision conserva factor calcula base y no amplía payload', async () => {
  const [draft, line, panel] = await Promise.all([
    read('./solicitudesCompraRevisionUtils.js'),
    read('../components/SolicitudCompraRevisionLinea.jsx'),
    read('../components/SolicitudCompraRevisionPanel.jsx')
  ]);
  assert.match(draft, /factor_conversion_snapshot/);
  assert.match(line, /Cantidad base calculada para inventario/);
  assert.match(line, /Equivalencia de aprobación/);
  assert.match(panel, /sol-comp-conversion-confirmation/);
  const payload = draft.match(/export const buildApprovalPayload[\s\S]*?^};/m)?.[0] || '';
  assert.doesNotMatch(payload, /cantidad_base_aprobada|factor_conversion_snapshot/);
  assert.match(payload, /id_proveedor/);
});

test('recepcion calcula entrada y diferencias sin ampliar payload', async () => {
  const [draft, line, panel] = await Promise.all([
    read('./solicitudesCompraRecepcionUtils.js'),
    read('../components/SolicitudCompraRecepcionLinea.jsx'),
    read('../components/SolicitudCompraRecepcionPanel.jsx')
  ]);
  assert.match(draft, /factor_conversion_snapshot/);
  assert.match(line, /Entrada al inventario/);
  assert.match(line, /subtractConversionDecimal/);
  assert.match(panel, /Al confirmar, el sistema agregará automáticamente/);
  assert.match(panel, /No realice un ajuste manual adicional/);
  const payload = draft.match(/export const buildReceptionPayload[\s\S]*?^};/m)?.[0] || '';
  assert.doesNotMatch(payload, /cantidad_base_recibida|factor_conversion_snapshot/);
  assert.match(payload, /cantidad_recibida/);
  assert.match(payload, /factura/);
});

test('flujo no introduce precios movimientos ni dependencias', async () => {
  const sources = await Promise.all([
    read('../components/SolicitudCompraCatalogo.jsx'),
    read('../components/SolicitudCompraResumen.jsx'),
    read('../components/SolicitudCompraDetalle.jsx'),
    read('../components/SolicitudCompraRevisionPanel.jsx'),
    read('../components/SolicitudCompraRecepcionPanel.jsx'),
    read('./solicitudesCompraConversionUtils.js')
  ]);
  const combined = sources.join('\n');
  assert.doesNotMatch(combined, /precio|costo|impuesto|movimientos_inventario|npm install|supabase/i);
});
