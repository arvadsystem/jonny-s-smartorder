import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(relative, import.meta.url), 'utf8');
const gitBlobSha = async (relative) => {
  const content = Buffer.from((await read(relative)).replace(/\r\n/g, '\n'));
  return createHash('sha1').update(Buffer.from(`blob ${content.length}\0`)).update(content).digest('hex');
};

const LEGACY_PROXY_PATHS = [
  '/login', '/logout', '/me', '/status', '/api', '/seguridad', '/uploads',
  '/usuarios', '/categorias', '/productos', '/insumos', '/proveedores',
  '/almacenes', '/sucursales', '/ventas', '/cocina', '/clientes', '/empleados',
  '/planillas', '/personas', '/empresas', '/parametros', '/movimientos', '/perfil',
  '/reportes', '/email-campaigns', '/archivos', '/mobiliario', '/orden_compras',
  '/detalle_orden_compras', '/compras', '/detalle_compras', '/tipo_departamento',
  '/movimientos_inventario', '/kardex', '/correos', '/telefonos', '/direcciones'
];

test('proxy de Vite incluye solicitudes_compra exactamente una vez', async () => {
  const source = await read('../../../../../vite.config.js');
  const matches = source.match(/['"]\/solicitudes_compra['"]/g) || [];
  assert.equal(matches.length, 1);
  assert.match(source, /'\/mobiliario',\s*'\/solicitudes_compra',\s*'\/orden_compras',/);
});

test('rutas legacy del proxy permanecen intactas', async () => {
  const source = await read('../../../../../vite.config.js');
  LEGACY_PROXY_PATHS.forEach((path) => assert.match(source, new RegExp(`['"]${path}['"]`)));
  assert.match(source, /Object\.fromEntries\(proxiedPaths\.map\(\(path\) => \[path, buildProxyTarget\(\)\]\)\)/);
});

test('un solo prefijo cubre subrutas sin entradas manuales', async () => {
  const source = await read('../../../../../vite.config.js');
  assert.doesNotMatch(source, /['"]\/solicitudes_compra\/(?:catalogo|proveedores|aprobar|rechazar|recibir|evidencias)['"]/);
});

test('VITE_API_URL y servicio conservan su contrato sin backend directo', async () => {
  const constants = await read('../../../../utils/constants.js');
  const service = await read('../../../../services/solicitudesCompraService.js');
  const vite = await read('../../../../../vite.config.js');
  assert.match(constants, /import\.meta\.env\.VITE_API_URL \|\| ''/);
  assert.doesNotMatch(vite, /VITE_API_URL/);
  assert.doesNotMatch(service, /https?:\/\/|localhost:3001|VITE_API_URL/);
  assert.doesNotMatch(`${vite}\n${service}\n${constants}`, /https?:\/\/(?:qa\.|api\.qa|staging\.|api\.staging|api\.jonnys|jonnys.*produccion)/i);
});

test('archivos fuera de alcance conservan SHA exacto', async () => {
  assert.equal(await gitBlobSha('../../../../utils/constants.js'), 'fd04cda23758a23cde26e0a31b1a45d27269831b');
  assert.equal(await gitBlobSha('../../../../services/solicitudesCompraService.js'), 'dbc90d2ded3840f746ef9225774fae00915b72b4');
  assert.equal(await gitBlobSha('../../../../pages/dashboard/Inventario.jsx'), 'be5b830e2542376b0556b299ec35b6e81a063aea');
  assert.equal(await gitBlobSha('../../../../pages/dashboard/inventario/OrdenesCompraTab.jsx'), '08b35bb7ca08789a3781a10423359e1da01b154b');
});
