import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentUrl = new URL('../components/SolicitudCompraCatalogo.jsx', import.meta.url);
const cssUrl = new URL('../solicitudesCompra.css', import.meta.url);
const searchUrl = new URL('./solicitudesCompraCatalogSearch.js', import.meta.url);
const component = await readFile(componentUrl, 'utf8');
const css = await readFile(cssUrl, 'utf8');
const search = await readFile(searchUrl, 'utf8');

test('card no solicitable permanece visible y comunica configuracion pendiente', () => {
  assert.match(component, /visibleItems\.map\(\(item\) => <CatalogItem/);
  assert.match(component, /item\.solicitable !== false/);
  assert.match(component, /Configuración pendiente/);
  assert.match(component, /Este insumo no tiene una unidad base configurada\./);
  assert.match(component, /'Sin configurar'/);
  assert.match(css, /\.sol-comp-catalog-card--configuration-pending/);
});

test('controles no solicitables quedan deshabilitados y add aplica defensa adicional', () => {
  assert.match(component, /if \(!isSolicitable\) return;/);
  assert.match(component, /<AppSelect[^>]+disabled=\{!isSolicitable\}/);
  assert.match(component, /<input[^>]+aria-disabled=\{!isSolicitable\}[^>]+disabled=\{!isSolicitable\}/);
  assert.match(component, /<button[^>]+disabled=\{!isSolicitable\}[^>]+aria-disabled=\{!isSolicitable\}/);
  assert.match(component, /aria-describedby=\{!isSolicitable \? unavailableMessageId/);
  assert.match(component, /\{isSolicitable \? addLabel : 'No disponible'\}/);
  assert.match(component, /addLabel = 'Agregar'/);
});

test('articulos validos conservan agregar presentaciones cantidades y conversion', () => {
  assert.match(component, /onAdd\(\{/);
  assert.match(component, /id_presentacion_insumo/);
  assert.match(component, /factor_conversion_visual/);
  assert.match(component, /parseRequestedQuantity\(quantity, item\.tipo_item\)/);
  assert.match(component, /onChange=\{\(event\) => setQuantity\(event\.target\.value\)\}/);
});

test('banner depende solo de invalidos en la pagina visible', () => {
  assert.match(component, /visibleItems\.some\(\(item\) => item\.solicitable === false\)/);
  assert.match(component, /Algunos insumos no pueden solicitarse porque su unidad base está pendiente de configuración\./);
  assert.doesNotMatch(component, /cantidad total|total global/i);
  assert.match(css, /\.sol-comp-catalog-warning/);
});

test('busqueda debounce filtros y paginacion permanecen coordinados por backend', () => {
  assert.match(search, /delay = 300/);
  assert.match(search, /pendingTimer = scheduleTimer/);
  assert.match(search, /tipo: filters\.type/);
  assert.match(search, /solo_stock_bajo/);
  assert.match(component, /searchController\.page\(page - 1\)/);
  assert.match(component, /searchController\.page\(page \+ 1\)/);
  assert.doesNotMatch(component, /state\.items\.filter\(/);
});
