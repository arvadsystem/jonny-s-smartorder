import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  buildReversionPayload,
  getPrintStateLabel,
  isFinalPrintState,
  resolveReversionIntent,
  stableReversionPayload
} from './ventaReversionFlow.js';

describe('payload e idempotencia de reversion', () => {
  const items = [
    { id_detalle_factura: 11, cantidad_disponible: 2 },
    { id_detalle_factura: 12, cantidad_disponible: 0 }
  ];

  it('total no reconstruye lineas en frontend', () => {
    assert.deepEqual(
      buildReversionPayload({ tipo: 'TOTAL', motivo: 'OTRO', observacion: '', cantidades: {}, items }),
      { tipo_reversion: 'TOTAL', motivo: 'OTRO', observacion: '' }
    );
  });

  it('parcial usa id del contexto y cantidades enteras dentro de disponibilidad', () => {
    assert.deepEqual(
      buildReversionPayload({
        tipo: 'PARCIAL',
        motivo: 'OTRO',
        observacion: '',
        cantidades: { 11: 2, 12: 1 },
        items
      }).lineas,
      [{ id_detalle_factura: 11, cantidad: 2 }]
    );
  });

  it('la misma intencion conserva clave y un cambio de payload genera otra', () => {
    const payload = { tipo_reversion: 'TOTAL', motivo: 'OTRO', observacion: '' };
    const first = resolveReversionIntent(null, payload);
    const retry = resolveReversionIntent(first, payload);
    const changed = resolveReversionIntent(first, { ...payload, motivo: 'CLIENTE_CANCELO' });
    assert.equal(retry.key, first.key);
    assert.notEqual(changed.key, first.key);
    assert.notEqual(stableReversionPayload(payload), stableReversionPayload({ ...payload, motivo: 'CLIENTE_CANCELO' }));
  });
});

describe('estado de impresion', () => {
  it('mapea estados reales y reconoce terminales', () => {
    assert.equal(getPrintStateLabel('pendiente'), 'Pendiente');
    assert.equal(getPrintStateLabel('imprimiendo'), 'Procesando');
    assert.equal(getPrintStateLabel('impreso'), 'Impreso');
    assert.equal(getPrintStateLabel('fallido'), 'Fallido');
    assert.equal(isFinalPrintState('impreso'), true);
    assert.equal(isFinalPrintState('fallido'), true);
    assert.equal(isFinalPrintState('pendiente'), false);
  });
});

describe('integracion declarada del flujo', () => {
  it('usa contexto, preview, proteccion obsoleta y confirmacion propia', async () => {
    const modal = await readFile(new URL('../components/VentaReversionModal.jsx', import.meta.url), 'utf8');
    const previewHook = await readFile(new URL('../hooks/useVentaReversionPreview.js', import.meta.url), 'utf8');
    assert.match(modal, /useVentaReversionContext/);
    assert.match(modal, /useVentaReversionPreview/);
    assert.match(modal, /role="alertdialog"/);
    assert.match(modal, /submitInFlightRef\.current/);
    assert.match(modal, /idempotencyKey: intent\.key/);
    assert.doesNotMatch(modal, /window\.confirm|window\.print|venta-reversion-ticket-printing/);
    assert.match(previewHook, /requestIdRef/);
    assert.match(previewHook, /AbortController/);
    assert.match(previewHook, /400/);
  });

  it('el servicio expone los cuatro contratos backend y acepta una clave proporcionada', async () => {
    const service = await readFile(new URL('../../../../services/ventasService.js', import.meta.url), 'utf8');
    assert.match(service, /getReversionContext/);
    assert.match(service, /previewReversion/);
    assert.match(service, /createReversion: \(id, payload, options = \{\}\)/);
    assert.match(service, /idempotencyKey/);
    assert.match(service, /reprintReversion/);
  });

  it('reimpresion llama solo al endpoint de impresion y muestra seguimiento', async () => {
    const action = await readFile(new URL('../components/VentaReversionReprintAction.jsx', import.meta.url), 'utf8');
    assert.match(action, /reprintReversion/);
    assert.match(action, /usePrintJobStatus/);
    assert.doesNotMatch(action, /createReversion/);
  });

  it('configuracion muestra Reversion heredando FACTURA sin impresora fisica nueva', async () => {
    const config = await readFile(new URL('../../sucursales/components/SucursalFacturacionConfigDrawer.jsx', import.meta.url), 'utf8');
    assert.match(config, /\['Factura', 'Comanda', 'Reversión', 'Reglas'\]/);
    assert.match(config, /Utiliza la misma impresora configurada para Factura/);
    assert.match(config, /facturaPrinter/);
    assert.doesNotMatch(config, /tipo_impresora:\s*['"]REVERSION/);
  });
});
