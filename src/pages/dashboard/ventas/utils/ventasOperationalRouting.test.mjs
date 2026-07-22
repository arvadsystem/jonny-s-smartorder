import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
