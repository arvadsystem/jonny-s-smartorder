import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../../../..');
const planillasPagePath = path.join(repoRoot, 'src/pages/dashboard/personas/Planillas.jsx');
const planillasComponentsDir = path.join(repoRoot, 'src/pages/dashboard/personas/components/planillas');
const planillasServicePath = path.join(repoRoot, 'src/services/planillasService.js');
const planillasModuleDir = path.join(repoRoot, 'src/modules/planillas');
const mojibakePattern = /Ãƒ|Ã‚|ï¿½|ÃƒÆ|Ãƒâ|Â·/;

const collectSourceFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(fullPath));
    } else if (/\.(jsx?|mjs)$/.test(entry.name) && !entry.name.endsWith('.test.mjs')) {
      files.push(fullPath);
    }
  }
  return files;
};

test('planillas cierre envia CERRADA y el filtro la expone', async () => {
  const source = await readFile(planillasPagePath, 'utf8');

  assert.match(source, /cerrada:\s*'CERRADA'/);
  assert.match(source, /<option value="CERRADA">Cerrada<\/option>/);
  assert.doesNotMatch(source, /cerrada:\s*'CALCULADA'/);
});

test('anular bonos o deducciones espera la recarga completa', async () => {
  const source = await readFile(planillasPagePath, 'utf8');
  const actionBlock = source.slice(source.indexOf("actionType === 'anular_movimiento_bono_deduccion'"));

  assert.ok(actionBlock.includes('await withAction('));
  assert.doesNotMatch(actionBlock, /skipReload:\s*true/);
  assert.doesNotMatch(actionBlock, /void refreshPlanillaData\(\)/);
});

test('movimientos con estado false se tratan como anulados', async () => {
  const source = await readFile(planillasPagePath, 'utf8');
  const helperBlock = source.slice(
    source.indexOf('const isMovimientoAnulado'),
    source.indexOf('const sortByDateDesc')
  );

  assert.match(helperBlock, /row\?\.estado === false/);
  assert.match(helperBlock, /row\?\.estado_movimiento === false/);
  assert.match(helperBlock, /row\?\.estado_descripcion === false/);
  assert.doesNotMatch(helperBlock, /row\?\.estado\s*\|\|/);
});

test('fuentes de planillas no contienen mojibake', async () => {
  const files = [
    planillasPagePath,
    planillasServicePath,
    ...await collectSourceFiles(planillasComponentsDir),
    ...await collectSourceFiles(planillasModuleDir)
  ];

  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    if (mojibakePattern.test(source)) {
      offenders.push(path.relative(repoRoot, file));
    }
  }

  assert.deepEqual(offenders, []);
});
