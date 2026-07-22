import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
const gitBlobSha = async (relative) => {
  const content = Buffer.from((await read(relative)).replace(/\r\n/g, '\n'));
  return createHash('sha1').update(Buffer.from(`blob ${content.length}\0`)).update(content).digest('hex');
};

test('servicio usa POST recibir y GET evidencias con IDs codificados', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /recibirSolicitud:[\s\S]*encodeURIComponent\(String\(id\)\)[\s\S]*\/recibir`[\s\S]*'POST'/);
  assert.match(source, /getEvidencias:[\s\S]*encodeURIComponent\(String\(id\)\)[\s\S]*\/evidencias`[\s\S]*'GET'/);
  assert.doesNotMatch(source, /orden_compras|detalle_orden_compras|createSignedUrl|supabase/i);
});

test('permisos de recepcion y evidencia usan solo constantes autorizadas', async () => {
  const source = await read('../SolicitudesCompraTab.jsx');
  assert.match(source, /RECEIVE_PERMISSIONS = \[PERMISSIONS\.INVENTARIO_OC_RECEPCIONAR, PERMISSIONS\.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR\]/);
  assert.match(source, /EVIDENCE_PERMISSIONS = \[PERMISSIONS\.INVENTARIO_OC_VER_EVIDENCIAS, PERMISSIONS\.INVENTARIO_OC_VER_DETALLE, PERMISSIONS\.INVENTARIO_OC_VER_FLUJO, PERMISSIONS\.INVENTARIO_ORDENES_COMPRA_VER, PERMISSIONS\.INVENTARIO_ORDENES_COMPRA_VER_TODAS, PERMISSIONS\.INVENTARIO_OC_RECEPCIONAR, PERMISSIONS\.INVENTARIO_ORDENES_COMPRA_RECEPCIONAR\]/);
  assert.match(source, /canReceive = canAny\(RECEIVE_PERMISSIONS\)/);
  assert.match(source, /canViewEvidence = canAny\(EVIDENCE_PERMISSIONS\)/);
  assert.match(source, /VIEW_PERMISSIONS = \[[^\]]*INVENTARIO_OC_VER_EVIDENCIAS[^\]]*INVENTARIO_OC_RECEPCIONAR[^\]]*INVENTARIO_ORDENES_COMPRA_RECEPCIONAR[^\]]*\]/);
  assert.doesNotMatch(source, /rol|role/i);
});

test('panel de recepcion solo aparece en APROBADA con permiso', async () => {
  const source = await read('../components/SolicitudCompraDetalle.jsx');
  assert.match(source, /=== 'APROBADA' && canReceive/);
  assert.doesNotMatch(source, /=== 'PENDIENTE' && canReceive|=== 'RECIBIDA' && canReceive/);
  assert.match(source, /request\.tiene_evidencia && canViewEvidence/);
});

test('listado distingue revisar, recibir y ver detalle', async () => {
  const source = await read('../components/SolicitudesCompraListado.jsx');
  assert.match(source, /'PENDIENTE' \? 'Revisar solicitud'/);
  assert.match(source, /'APROBADA' \? 'Recibir solicitud'/);
  assert.match(source, /: 'Ver detalle'/);
});

test('panel usa input nativo limitado a imagen y confirmacion inline', async () => {
  const source = await read('../components/SolicitudCompraRecepcionPanel.jsx');
  assert.match(source, /type="file"/);
  assert.match(source, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(source, /capture="environment"/);
  assert.match(source, /Tomar foto o seleccionar imagen/);
  assert.match(source, /Confirmar recepción final/);
  assert.match(source, /sol-comp-inline-confirm/);
  assert.doesNotMatch(source, /window\.confirm|alert\(|modal|application\/pdf|getUserMedia/i);
});

test('hook bloquea doble envio y conserva borrador en error ordinario', async () => {
  const source = await read('../hooks/useSolicitudCompraRecepcion.js');
  assert.match(source, /receiveLock\.current/);
  assert.match(source, /if \(receiveLock\.current \|\| receiveDisabled/);
  assert.match(source, /readFileAsDataUrl\(invoice\.file\)/);
  const catchBlock = source.slice(source.indexOf('} catch (error)'));
  const ordinary = catchBlock.slice(0, catchBlock.indexOf('} finally'));
  assert.doesNotMatch(ordinary.split("if (error?.status === 409)")[0], /setLines\(\[\]\)|setObservation\(''\)|setInvoice\(EMPTY_INVOICE\)/);
});

test('exito y 409 revocan URL y actualizan detalle y listado', async () => {
  const source = await read('../hooks/useSolicitudCompraRecepcion.js');
  assert.match(source, /Promise\.all\(\[reloadDetail\?\.\(\), reloadList\?\.\(\)\]\)/);
  assert.match(source, /RECEPCIÓN REGISTRADA[\s\S]*revokePreview\(\)[\s\S]*refreshInformation\(\)/);
  assert.match(source, /error\?\.status === 409[\s\S]*revokePreview\(\)[\s\S]*refreshInformation\(\)/);
  assert.match(source, /error\?\.status === 403[\s\S]*setAccessDenied\(true\)/);
});

test('object URL se revoca al reemplazar, quitar, desmontar y completar', async () => {
  const source = await read('../hooks/useSolicitudCompraRecepcion.js');
  assert.match(source, /const previewUrl = URL\.createObjectURL\(file\);[\s\S]*revokePreview\(\);[\s\S]*previewUrlRef\.current = previewUrl/);
  assert.match(source, /const removeInvoice[\s\S]*revokePreview\(\)[\s\S]*setInvoice\(EMPTY_INVOICE\)/);
  assert.match(source, /useEffect\(\(\) => \(\) => \{[\s\S]*revokePreview\(\)/);
  assert.match(source, /URL\.revokeObjectURL/);
});

test('evidencias cargan solo bajo demanda y permiten renovar y cerrar', async () => {
  const hook = await read('../hooks/useSolicitudCompraEvidencias.js');
  const component = await read('../components/SolicitudCompraEvidencias.jsx');
  assert.match(component, /Ver factura/);
  assert.match(component, /onClick=\{evidence\.openViewer\}/);
  assert.match(component, /onClick=\{evidence\.refreshAccess\}/);
  assert.match(component, /onClick=\{evidence\.closeViewer\}/);
  assert.match(hook, /setState\(CLOSED_STATE\)/);
  assert.doesNotMatch(hook, /setInterval|setTimeout|polling/i);
  const cleanupEffect = hook.match(/useEffect\(\(\) => \(\) => \{[\s\S]*?\}, \[\]\);/)?.[0] || '';
  assert.match(cleanupEffect, /requestSequence\.current/);
  assert.doesNotMatch(cleanupEffect, /getEvidencias|load\(\)/);
});

test('URL firmada permanece local y enlace es seguro', async () => {
  const hook = await read('../hooks/useSolicitudCompraEvidencias.js');
  const component = await read('../components/SolicitudCompraEvidencias.jsx');
  const joined = `${hook}\n${component}`;
  assert.doesNotMatch(joined, /localStorage|sessionStorage|dangerouslySetInnerHTML/);
  assert.match(component, /target="_blank" rel="noopener noreferrer"/);
  assert.match(component, /alt=\{`Factura/);
});

test('no hay carga directa a Storage, Supabase, logs de data URL ni recepcion parcial', async () => {
  const files = await Promise.all([
    '../hooks/useSolicitudCompraRecepcion.js', '../hooks/useSolicitudCompraEvidencias.js',
    '../components/SolicitudCompraRecepcionPanel.jsx', '../components/SolicitudCompraEvidencias.jsx',
    '../utils/solicitudesCompraRecepcionUtils.js', '../../../../services/solicitudesCompraService.js'
  ].map(read));
  const source = files.join('\n');
  assert.doesNotMatch(source, /createSignedUrl|upload\(|from\(['"]storage|supabase|service_role|console\.log|recepci[oó]n_parcial|partial reception/i);
  assert.doesNotMatch(source, /application\/pdf|\.pdf/i);
});

test('payload no incluye campos prohibidos', async () => {
  const source = await read('./solicitudesCompraRecepcionUtils.js');
  const builderStart = source.indexOf('export const buildReceptionPayload');
  const builderEnd = source.indexOf('\n};', builderStart) + 3;
  const builder = source.slice(builderStart, builderEnd);
  assert.doesNotMatch(builder, /cantidad_base_recibida|id_producto|id_insumo|id_almacen|id_sucursal|precio|costo|impuesto|bucket|object_path|url_publica|id_evidencia/);
});

test('revision administrativa y creacion operativa permanecen conectadas', async () => {
  const detail = await read('../components/SolicitudCompraDetalle.jsx');
  const creation = await read('../hooks/useSolicitudesCompra.js');
  assert.match(detail, /SolicitudCompraRevisionPanel/);
  assert.match(detail, /=== 'PENDIENTE' && \(canApprove \|\| canReject\)/);
  assert.match(creation, /crearSolicitud\(payload\)/);
  assert.match(creation, /submitLock\.current/);
});

test('archivos protegidos conservan SHA exacto', async () => {
  assert.equal(await gitBlobSha('../../../../pages/dashboard/inventario/OrdenesCompraTab.jsx'), '08b35bb7ca08789a3781a10423359e1da01b154b');
  assert.equal(await gitBlobSha('../../../../pages/dashboard/Inventario.jsx'), 'be5b830e2542376b0556b299ec35b6e81a063aea');
});
