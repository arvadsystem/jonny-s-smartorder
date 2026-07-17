import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

assert.equal(String(process.env.VITE_PRINT_MODE || '').toLowerCase(), 'agent', 'VITE_PRINT_MODE debe ser agent para esta prueba.');
const distDir = path.resolve('dist');
const jsFiles = fs.readdirSync(path.join(distDir, 'assets'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => path.join(distDir, 'assets', name));
const bundle = jsFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
assert.match(bundle, /new Set\(\["agent","direct"\]\)[\s\S]{0,300}\("agent"\)/, 'El bundle no contiene el modo agent inyectado durante build.');
assert.match(bundle, /JONNYS_PRINT_MODE_/, 'El bundle no contiene el marcador de modo de impresion.');
assert.match(bundle, /QZ_DISABLED_IN_AGENT_MODE/, 'El bundle no conserva el bloqueo de QZ para modo agent.');
assert.doesNotMatch(bundle, /ws:\/\/192\.168\./, 'El bundle agent contiene una conexion QZ remota insegura hardcodeada.');

const probeEntry = path.resolve('src/services/printModeGuard.js');
const probeResult = await build({
  configFile: false,
  logLevel: 'silent',
  build: {
    write: false,
    rollupOptions: {
      input: probeEntry,
      preserveEntrySignatures: 'strict',
      output: { format: 'es', entryFileNames: 'agent-mode-probe.mjs' }
    }
  }
});
const probeOutput = Array.isArray(probeResult) ? probeResult[0].output : probeResult.output;
const probeChunk = probeOutput.find((item) => item.type === 'chunk' && item.isEntry);
assert.ok(probeChunk, 'No se genero el probe ejecutable del modo agent.');
const probePath = path.resolve('dist', '.qa-agent-mode-probe.mjs');
fs.writeFileSync(probePath, `${probeChunk.code}\n`, 'utf8');
try {
  const compiled = await import(`${pathToFileURL(probePath).href}?t=${Date.now()}`);
  assert.throws(() => compiled.assertBrowserQzAllowed(), (error) => error.code === 'QZ_DISABLED_IN_AGENT_MODE');
} finally {
  fs.rmSync(probePath, { force: true });
}
console.log('qa:print-agent-build OK');
