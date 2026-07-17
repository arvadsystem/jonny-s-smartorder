import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizePrintMode } from '../src/services/printModeService.js';
import { assertBrowserQzAllowed } from '../src/services/printModeGuard.js';

assert.equal(normalizePrintMode('agent'), 'agent');
assert.equal(normalizePrintMode('DIRECT'), 'direct');
assert.equal(normalizePrintMode('unknown'), 'direct');
assert.equal(assertBrowserQzAllowed('direct'), true);
assert.throws(() => assertBrowserQzAllowed('agent'), (error) => error.code === 'QZ_DISABLED_IN_AGENT_MODE');
const page = fs.readFileSync(new URL('../src/pages/dashboard/ventas/VentasPage.jsx', import.meta.url), 'utf8');
const detection = fs.readFileSync(new URL('../src/services/printerDeviceDetectionService.js', import.meta.url), 'utf8');
const qzService = fs.readFileSync(new URL('../src/services/qzPrintService.js', import.meta.url), 'utf8');
assert.match(page, /if \(AGENT_PRINT_MODE\)[\s\S]*enqueuePrintJob/);
assert.match(detection, /if \(isAgentPrintMode\(\)\)[\s\S]*status: 'AGENT_MODE'/);
assert.match(qzService, /ensureQzLibrary[\s\S]*assertQzDirectMode\(\)/);
assert.match(qzService, /QZ_DISABLED_IN_AGENT_MODE/);
console.log('qa:print-mode OK');
