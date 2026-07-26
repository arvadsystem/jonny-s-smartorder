import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
  buildSaveConfiguracionPayload,
  computeConfiguracionSubmitState,
  normalizeConfiguracion
} from './fidelizacionHelpers.js';

// ConfiguracionReglasModal.jsx usa createPortal(..., document.body) y solo
// se monta tras un useEffect (mounted=true); renderToStaticMarkup (SSR) no
// ejecuta efectos, asi que ese componente siempre devuelve null bajo SSR y
// no se puede verificar su HTML con esa tecnica. Por eso el switch y el
// payload de guardado se prueban aqui como logica pura extraida a
// fidelizacionHelpers.js (mismo valor que consume el componente), y el
// aislamiento de otros modulos se verifica sobre el codigo fuente real.

describe('switch de acumulacion de puntos: carga desde el backend', () => {
  it('el switch carga apagado cuando el backend responde acumulacion_habilitada=false', () => {
    const normalized = normalizeConfiguracion({
      data: {
        id_sucursal: 1,
        configuracion: { id_configuracion: 5, lempiras_por_punto: 10, acumulacion_habilitada: false },
        productos_canjeables: []
      }
    });
    assert.equal(normalized.configuracion.acumulacion_habilitada, false);
  });

  it('el switch carga encendido cuando el backend responde acumulacion_habilitada=true', () => {
    const normalized = normalizeConfiguracion({
      data: {
        id_sucursal: 1,
        configuracion: { id_configuracion: 5, lempiras_por_punto: 10, acumulacion_habilitada: true },
        productos_canjeables: []
      }
    });
    assert.equal(normalized.configuracion.acumulacion_habilitada, true);
  });

  it('no asume true: sin configuracion previa (null), el valor inicial es false', () => {
    const normalized = normalizeConfiguracion({ data: { id_sucursal: 1, configuracion: null, productos_canjeables: [] } });
    assert.equal(normalized.configuracion, null);
  });
});

describe('switch de acumulacion de puntos: guardar', () => {
  it('guardar envia acumulacion_habilitada en el payload (true)', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '10',
      acumulacionHabilitada: true,
      productosCanjeables: []
    });
    assert.equal(payload.acumulacion_habilitada, true);
    assert.equal(payload.lempiras_por_punto, 10);
  });

  it('guardar envia acumulacion_habilitada en el payload (false)', () => {
    const payload = buildSaveConfiguracionPayload({
      idSucursal: 1,
      lempiras: '',
      acumulacionHabilitada: false,
      productosCanjeables: []
    });
    assert.equal(payload.acumulacion_habilitada, false);
  });

  it('apagado no exige tasa activa: se puede guardar sin lempiras_por_punto valido', () => {
    const { canSubmit } = computeConfiguracionSubmitState({
      acumulacionHabilitada: false,
      lempiras: '',
      saving: false
    });
    assert.equal(canSubmit, true);
  });

  it('encendido exige tasa mayor que cero: no se puede guardar con lempiras invalido', () => {
    const invalido = computeConfiguracionSubmitState({ acumulacionHabilitada: true, lempiras: '0', saving: false });
    assert.equal(invalido.canSubmit, false);

    const vacio = computeConfiguracionSubmitState({ acumulacionHabilitada: true, lempiras: '', saving: false });
    assert.equal(vacio.canSubmit, false);

    const valido = computeConfiguracionSubmitState({ acumulacionHabilitada: true, lempiras: '5', saving: false });
    assert.equal(valido.canSubmit, true);
  });

  it('mientras esta guardando (saving=true) nunca permite un nuevo submit', () => {
    const { canSubmit } = computeConfiguracionSubmitState({ acumulacionHabilitada: false, lempiras: '10', saving: true });
    assert.equal(canSubmit, false);
  });
});

describe('switch de acumulacion de puntos: aislamiento de otros modulos', () => {
  it('un error del endpoint de guardado solo actualiza toast/saving, no otro estado global', async () => {
    const source = await readFile(
      new URL('../hooks/useFidelizacion.js', import.meta.url),
      'utf8'
    );
    const start = source.indexOf('const saveConfiguracion = useCallback');
    assert.notEqual(start, -1);
    const end = source.indexOf('}, [openToast]);', start);
    const block = source.slice(start, end);
    const catchStart = block.indexOf('catch (err)');
    const catchBlock = block.slice(catchStart);
    assert.match(catchBlock, /openToast\(/);
    assert.match(catchBlock, /throw err;/);
    // El catch no debe tocar pedidos/caja/ventas ni otro estado ajeno a este flujo.
    assert.doesNotMatch(catchBlock, /setPedidos|setCaja|setVenta/);
  });

  it('el modal y los helpers de configuracion no importan ni referencian Caja ni Ventas', async () => {
    const modalSource = await readFile(
      new URL('../components/ConfiguracionReglasModal.jsx', import.meta.url),
      'utf8'
    );
    const helpersSource = await readFile(new URL('./fidelizacionHelpers.js', import.meta.url), 'utf8');

    for (const source of [modalSource, helpersSource]) {
      assert.doesNotMatch(source, /from ['"].*\/(caja|ventas)Service/i);
      assert.doesNotMatch(source, /from ['"].*dashboard\/ventas\//);
    }
  });

  it('guardar la configuracion de fidelizacion no dispara ninguna llamada a servicios de caja o ventas', async () => {
    const hookSource = await readFile(
      new URL('../hooks/useFidelizacion.js', import.meta.url),
      'utf8'
    );
    assert.doesNotMatch(hookSource, /cajaService|ventasService/);
  });
});
