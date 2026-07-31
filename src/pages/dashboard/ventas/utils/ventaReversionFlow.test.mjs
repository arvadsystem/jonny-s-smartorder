import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  buildReversionIntentSignature,
  buildReversionPayload,
  getPrintStateLabel,
  isFinalPrintState,
  resolveReversionIntent,
  stableReversionPayload
} from './ventaReversionFlow.js';
import {
  resolveInheritedFacturaPrinterDisplay
} from '../../sucursales/utils/sucursalFacturacionPrinterDisplay.js';

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

  it('misma factura y mismo payload conserva la clave, incluso tras timeout o reintento', () => {
    const payload = { tipo_reversion: 'TOTAL', motivo: 'OTRO', observacion: '' };
    const first = resolveReversionIntent(null, 41, payload);
    const retryAfterTimeout = resolveReversionIntent(first, 41, payload);
    const retryInProgress = resolveReversionIntent(retryAfterTimeout, 41, payload);
    assert.equal(retryAfterTimeout.key, first.key);
    assert.equal(retryInProgress.key, first.key);
  });

  it('misma factura con cambio de cantidad genera una clave nueva', () => {
    const base = {
      tipo_reversion: 'PARCIAL',
      motivo: 'OTRO',
      observacion: '',
      lineas: [{ id_detalle_factura: 11, cantidad: 1 }]
    };
    const first = resolveReversionIntent(null, 41, base);
    const changed = resolveReversionIntent(first, 41, {
      ...base,
      lineas: [{ id_detalle_factura: 11, cantidad: 2 }]
    });
    assert.notEqual(changed.key, first.key);
  });

  it('factura distinta con el mismo payload genera una clave nueva', () => {
    const payload = { tipo_reversion: 'TOTAL', motivo: 'OTRO', observacion: '' };
    const first = resolveReversionIntent(null, 41, payload);
    const changed = resolveReversionIntent(first, 42, payload);
    assert.notEqual(changed.key, first.key);
    assert.notEqual(
      buildReversionIntentSignature(41, payload),
      buildReversionIntentSignature(42, payload)
    );
  });

  it('cambiar tipo, motivo, observacion o lineas genera una clave nueva', () => {
    const payload = {
      tipo_reversion: 'PARCIAL',
      motivo: 'OTRO',
      observacion: 'Original',
      lineas: [{ id_detalle_factura: 11, cantidad: 1 }]
    };
    const first = resolveReversionIntent(null, 41, payload);
    const changes = [
      { ...payload, tipo_reversion: 'TOTAL' },
      { ...payload, motivo: 'CLIENTE_CANCELO' },
      { ...payload, observacion: 'Actualizada' },
      { ...payload, lineas: [{ id_detalle_factura: 12, cantidad: 1 }] }
    ];

    for (const changedPayload of changes) {
      const changed = resolveReversionIntent(first, 41, changedPayload);
      assert.notEqual(changed.key, first.key);
      assert.notEqual(stableReversionPayload(payload), stableReversionPayload(changedPayload));
    }
  });
});

describe('limpieza defensiva al cargar manualmente otra venta', () => {
  it('descarta la intencion y el estado operativo de la venta anterior', async () => {
    const source = await readFile(
      new URL('../components/VentaReversionModal.jsx', import.meta.url),
      'utf8'
    );
    const loadVentaBlock = source.slice(
      source.indexOf('const loadVenta = async'),
      source.indexOf('const changeCantidad')
    );

    assert.match(
      loadVentaBlock,
      /if\s*\(nextFacturaId !== idFactura\)\s*\{\s*intentRef\.current = null;\s*\}/
    );
    assert.match(loadVentaBlock, /setConfirmOpen\(false\);/);
    assert.match(loadVentaBlock, /setResult\(null\);/);
    assert.match(loadVentaBlock, /setCantidades\(\{\}\);/);
    assert.match(loadVentaBlock, /setError\(''\);/);
  });
});

describe('impresora FACTURA heredada', () => {
  it('muestra Sin asignar y Sin configurar cuando no existe impresora valida', () => {
    assert.deepEqual(resolveInheritedFacturaPrinterDisplay(null), {
      name: 'Sin asignar',
      state: 'Sin configurar'
    });
    assert.deepEqual(
      resolveInheritedFacturaPrinterDisplay({
        nombre_impresora_sistema: '   ',
        activa: true
      }),
      {
        name: 'Sin asignar',
        state: 'Sin configurar'
      }
    );
  });

  it('muestra Activa cuando la impresora existe y no esta desactivada', () => {
    assert.deepEqual(
      resolveInheritedFacturaPrinterDisplay({
        nombre_impresora_sistema: 'Caja principal',
        activa: undefined
      }),
      {
        name: 'Caja principal',
        state: 'Activa'
      }
    );
  });

  it('muestra Inactiva cuando la impresora existe y activa es false', () => {
    assert.deepEqual(
      resolveInheritedFacturaPrinterDisplay({
        nombre_impresora_sistema: 'Caja principal',
        activa: false
      }),
      {
        name: 'Caja principal',
        state: 'Inactiva'
      }
    );
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
    const styles = await readFile(new URL('../styles/ventas.css', import.meta.url), 'utf8');
    const previewHook = await readFile(new URL('../hooks/useVentaReversionPreview.js', import.meta.url), 'utf8');
    assert.match(modal, /useVentaReversionContext/);
    assert.match(modal, /useVentaReversionPreview/);
    assert.match(modal, /role="alertdialog"/);
    assert.match(modal, /ventas-reversion-confirm-modal/);
    assert.doesNotMatch(modal, /ventas-modal ventas-detail-modal" role="alertdialog"/);
    assert.match(styles, /\.ventas-reversion-confirm-modal\s*\{[\s\S]*?width:\s*min\(580px, 100%\)/);
    assert.match(styles, /\.ventas-reversion-confirm-modal__summary/);
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
    assert.match(action, /million-ignore/);
    assert.match(action, /data-action="reprint-reversion"/);
    assert.match(action, /addEventListener\('click', handleNativeClick\)/);
    assert.match(action, /removeEventListener\('click', handleNativeClick\)/);
    assert.match(action, /inFlightRef\.current/);
    assert.doesNotMatch(action, /onClick=\{reprint\}/);
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
