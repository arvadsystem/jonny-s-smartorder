import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { buildVentaQuantityCommitResult } from './ventasCartUtils.js';
import { isSaleBlockedByStock } from './ventasStockPolicy.js';

const readSource = (relativeUrl) => readFile(new URL(relativeUrl, import.meta.url), 'utf8');

describe('integracion frontend de la politica de stock de PRODUCTO', () => {
  it('catalogo delega la vendibilidad fisica a ventasStockPolicy', async () => {
    const source = await readSource('../../../pages/dashboard/ventas/components/VentaComposerCatalog.jsx');

    assert.match(source, /import \{ isSaleBlockedByStock \} from ['"]\.\.\/\.\.\/\.\.\/\.\.\/modules\/ventas\/utils\/ventasStockPolicy['"]/);
    assert.match(source, /if \(isProducto\) return isSaleBlockedByStock\(row\?\.cantidad \?\? row\?\.stock_disponible, 1\)/);
    assert.doesNotMatch(source, /if \(isProducto\) return Number\([^\n]+\) <= 0/);
  });

  it('producto con stock cero conserva visibilidad y seleccion en catalogo normal o con descuento', async () => {
    const source = await readSource('../../../pages/dashboard/ventas/components/VentaComposerCatalog.jsx');

    assert.equal(isSaleBlockedByStock(0, 1), false);
    assert.equal(isSaleBlockedByStock(-5, 1), false);
    assert.match(source, /const visibleDiscountRows = discountCatalogRows\.filter/);
    assert.match(source, /return !isExplicitlyOutOfStock\(row, isProducto\)/);
    assert.match(source, /composer\.addCatalogItem\(kind, row/);
  });

  it('hook no bloquea ni clampa PRODUCTO contra stock fisico', async () => {
    const source = await readSource('../../../pages/dashboard/ventas/hooks/useVentaComposer.js');

    assert.match(source, /if \(!canIncreaseVentaLineQuantity\(currentLine\)\)/);
    assert.doesNotMatch(source, /stockDisponible <= 0/);
    assert.doesNotMatch(source, /alreadyInCart >= stockDisponible/);
    assert.doesNotMatch(source, /nextQty > Number\(currentLine\.stock_disponible/);
    assert.doesNotMatch(source, /requested > maxStock/);
    assert.doesNotMatch(source, /Stock maximo alcanzado/);
  });

  it('resumen limita el boton mas por cantidad general y no por stock', async () => {
    const source = await readSource('../../../pages/dashboard/ventas/components/VentaComposerSummary.jsx');

    assert.match(source, /const canIncrease = isStandaloneExtra[\s\S]+canIncreaseVentaLineQuantity\(line\)/);
    assert.match(source, /disabled=\{!canIncrease\}/);
    assert.doesNotMatch(source, /Math\.min\(VENTA_LINE_MAX_QUANTITY, Number\(line\.stock_disponible/);
  });

  it('edicion manual conserva 49 aunque el stock informativo sea 48', async () => {
    const hookSource = await readSource('../../../pages/dashboard/ventas/hooks/useVentaComposer.js');
    const result = buildVentaQuantityCommitResult('49', 48, { manual: true });

    assert.equal(result.ok, true);
    assert.equal(result.quantity, 49);
    assert.doesNotMatch(hookSource, /requested > maxStock/);
  });

  it('conserva intacta la politica existente de extras', async () => {
    const [hookSource, summarySource] = await Promise.all([
      readSource('../../../pages/dashboard/ventas/hooks/useVentaComposer.js'),
      readSource('../../../pages/dashboard/ventas/components/VentaComposerSummary.jsx')
    ]);

    assert.match(hookSource, /canAddStandaloneExtraToCart\(row\)/);
    assert.match(summarySource, /canIncreaseStandaloneExtraQuantity\(line\)/);
  });
});
