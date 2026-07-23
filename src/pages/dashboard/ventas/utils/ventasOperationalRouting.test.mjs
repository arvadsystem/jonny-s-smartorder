import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildComandaCocinaHtml } from './buildComandaCocinaHtml.js';
import { canPrintKitchenComanda } from './ventasKitchenRouting.js';

test('PedidosView muestra Mandar a cocina solo con autorizacion explicita del backend', () => {
  const source = fs.readFileSync(new URL('../components/PedidosView.jsx', import.meta.url), 'utf8');
  assert.match(source, /const requiereCocina = pedido\?\.requiere_cocina === true/);
  assert.match(source, /laneCode === 'PENDIENTE' && requiereCocina && !requiereRevision/);
  assert.doesNotMatch(source, /id_receta[^\n]*Mandar a cocina|nombre_item[^\n]*Mandar a cocina/);
});

test('VentasPage no abre comanda para producto terminado o pedido en revision', () => {
  const source = fs.readFileSync(new URL('../VentasPage.jsx', import.meta.url), 'utf8');
  assert.match(source, /if \(comanda\?\.requiere_revision === true\)/);
  assert.match(source, /if \(comanda\?\.requiere_cocina !== true\) return/);
  assert.match(source, /else if \(ventaDetail\.requiere_cocina\)/);
});

test('detalle oculta comanda cuando backend no requiere cocina o no hay preparaciones', () => {
  assert.equal(canPrintKitchenComanda({
    requiere_cocina: false,
    items: [{ tipo_item: 'RECETA', id_receta: 1 }]
  }), false);
  assert.equal(canPrintKitchenComanda({
    requiere_cocina: true,
    items: [{ tipo_item: 'PRODUCTO', id_producto: 1 }]
  }), false);
  assert.equal(canPrintKitchenComanda({
    requiere_cocina: true,
    items: [{ tipo_item: 'RECETA', id_receta: 1 }]
  }), true);
  assert.equal(canPrintKitchenComanda({
    requiere_cocina: true,
    items: [{ tipo_item: 'EXTRA', nombre_item: 'Extra incompleto', cantidad: 1 }]
  }), false);

  const source = fs.readFileSync(new URL('../components/VentaDetalleModal.jsx', import.meta.url), 'utf8');
  assert.match(source, /canPrintKitchenComanda\(venta\)/);
  assert.doesNotMatch(source, /hasKitchenItems/);
});

test('HTML de navegador separa preparar y entrega conjunta sin secciones vacias', () => {
  const base = {
    numero_pedido: 'PED-1',
    items: [{
      id_detalle: 1,
      tipo_item: 'RECETA',
      cantidad: 1,
      nombre_item: 'Hamburguesa',
      instruccion_operativa: 'PREPARAR'
    }]
  };
  const withoutCompanions = buildComandaCocinaHtml(base, { widthMm: 58 });
  assert.match(withoutCompanions, />PREPARAR</);
  assert.doesNotMatch(withoutCompanions, />ENTREGAR JUNTO CON EL PEDIDO</);

  const withCompanions = buildComandaCocinaHtml({
    ...base,
    items: [...base.items, {
      id_detalle: 2,
      tipo_item: 'PRODUCTO',
      cantidad: 1,
      nombre_item: 'Coca-Cola',
      instruccion_operativa: 'ENTREGAR_JUNTO_CON_EL_PEDIDO'
    }]
  }, { widthMm: 80 });
  assert.match(withCompanions, />ENTREGAR JUNTO CON EL PEDIDO</);
});

test('transicion explicita ocurre antes del intento de impresion y no depende del evento impreso', () => {
  const source = fs.readFileSync(new URL('../VentasPage.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const executeComandaPrint = async');
  const end = source.indexOf('const openComandaReprintFromDetail', start);
  const block = source.slice(start, end);
  const transition = block.indexOf("ventasService.updatePedidoEstado(venta.id_pedido, 'EN_COCINA')");
  const agentPrint = block.indexOf('if (AGENT_PRINT_MODE)');
  const browserPrint = block.indexOf('printComandaCocinaWithQz');
  assert.ok(transition >= 0 && transition < agentPrint && transition < browserPrint);
});
