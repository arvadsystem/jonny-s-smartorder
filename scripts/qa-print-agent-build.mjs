import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
console.log('qa:print-agent-build OK');
