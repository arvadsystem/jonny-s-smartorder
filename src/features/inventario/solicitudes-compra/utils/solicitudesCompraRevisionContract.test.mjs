import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
const gitBlobSha = async (relative) => {
  const content = Buffer.from((await read(relative)).replace(/\r\n/g, '\n'));
  return createHash('sha1').update(Buffer.from(`blob ${content.length}\0`)).update(content).digest('hex');
};

test('servicio usa endpoints administrativos exactos y URLSearchParams', async () => {
  const source = await read('../../../../services/solicitudesCompraService.js');
  assert.match(source, /PROVIDER_FILTERS = \['buscar', 'page', 'limit'\]/);
  assert.match(source, /getProveedores:[\s\S]*\/solicitudes_compra\/proveedores[\s\S]*'GET'/);
  assert.match(source, /aprobarSolicitud:[\s\S]*encodeURIComponent[\s\S]*\/aprobar`[\s\S]*'PUT'/);
  assert.match(source, /rechazarSolicitud:[\s\S]*encodeURIComponent[\s\S]*\/rechazar`[\s\S]*'PUT'/);
  assert.match(source, /new URLSearchParams/);
  assert.doesNotMatch(source, /orden_compras|detalle_compras|ordenes_compra_workflow/);
});

test('permisos administrativos se calculan exclusivamente con constantes autorizadas', async () => {
  const source = await read('../SolicitudesCompraTab.jsx');
  assert.match(source, /APPROVE_PERMISSIONS = \[PERMISSIONS\.INVENTARIO_OC_APROBAR, PERMISSIONS\.INVENTARIO_ORDENES_COMPRA_GESTIONAR\]/);
  assert.match(source, /REJECT_PERMISSIONS = \[PERMISSIONS\.INVENTARIO_OC_RECHAZAR, PERMISSIONS\.INVENTARIO_ORDENES_COMPRA_GESTIONAR\]/);
  assert.match(source, /canApprove = canAny\(APPROVE_PERMISSIONS\)/);
  assert.match(source, /canReject = canAny\(REJECT_PERMISSIONS\)/);
});

test('panel solo se integra en PENDIENTE con permiso administrativo', async () => {
  const detail = await read('../components/SolicitudCompraDetalle.jsx');
  assert.match(detail, /=== 'PENDIENTE' && \(canApprove \|\| canReject\)/);
  assert.doesNotMatch(detail, /window\.confirm|alert\(/);
});

test('proveedores solo cargan para pendiente con canApprove', async () => {
  const hook = await read('../hooks/useSolicitudCompraRevision.js');
  assert.match(hook, /if \(!pending \|\| !canApprove\) return/);
  assert.match(hook, /pending && canApprove/);
  assert.doesNotMatch(hook, /setInterval|polling/i);
});

test('acciones comparten bloqueo, conservan borrador en error y refrescan ambas vistas', async () => {
  const hook = await read('../hooks/useSolicitudCompraRevision.js');
  assert.match(hook, /actionLock\.current/);
  assert.match(hook, /Promise\.all\(\[reloadDetail\?\.\(\), reloadList\?\.\(\)\]\)/);
  assert.match(hook, /error\?\.status === 409[\s\S]*refreshInformation/);
  const executeSource = hook.slice(hook.indexOf('const execute'));
  const catchBlock = executeSource.slice(executeSource.indexOf('} catch (error)'));
  assert.doesNotMatch(catchBlock.split('} finally')[0], /setComment\(''\)/);
});

test('fallo de proveedores bloquea aprobacion pero no rechazo', async () => {
  const hook = await read('../hooks/useSolicitudCompraRevision.js');
  assert.match(hook, /approveDisabled = [^;]*providerUnavailable/);
  assert.match(hook, /rejectDisabled = [^;]*rejectionCommentError/);
  assert.doesNotMatch(hook.match(/rejectDisabled = [^;]*/)?.[0] || '', /provider/);
});

test('confirmacion es inline, no usa modal y conserva el borrador al volver', async () => {
  const panel = await read('../components/SolicitudCompraRevisionPanel.jsx');
  assert.match(panel, /sol-comp-inline-confirm/);
  assert.match(panel, /setConfirmation\(null\)/);
  assert.doesNotMatch(panel, /window\.confirm|modal/i);
});

test('feature no implementa recepcion factura archivos ni clientes Supabase', async () => {
  const files = await Promise.all([
    '../components/SolicitudCompraRevisionPanel.jsx', '../components/SolicitudCompraRevisionLinea.jsx',
    '../hooks/useSolicitudCompraRevision.js', '../utils/solicitudesCompraRevisionUtils.js'
  ].map(read));
  assert.doesNotMatch(files.join('\n'), /\/recibir|\/evidencias|factura|createSignedUrl|supabase|service_role|precio|costo|impuesto|cantidad_base_aprobada/i);
});

test('archivos protegidos conservan SHA exacto', async () => {
  assert.equal(await gitBlobSha('../../../../pages/dashboard/inventario/OrdenesCompraTab.jsx'), '08b35bb7ca08789a3781a10423359e1da01b154b');
  assert.equal(await gitBlobSha('../../../../pages/dashboard/Inventario.jsx'), 'be5b830e2542376b0556b299ec35b6e81a063aea');
});
