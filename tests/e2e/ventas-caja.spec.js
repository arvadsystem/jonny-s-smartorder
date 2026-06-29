/* global process, Buffer */
import { test, expect } from '@playwright/test';

const QA_HOST_PATTERN = /(^|\.)qa\.jonnyshn\.com$/i;

const ensureQaOnly = (baseURL) => {
  const url = new URL(baseURL);
  if (!QA_HOST_PATTERN.test(url.hostname)) {
    throw new Error(`E2E de Caja bloqueado: E2E_BASE_URL debe apuntar a QA, recibido ${url.hostname}.`);
  }
};

const parseMoney = (value) => {
  const normalized = String(value || '')
    .replace(/[^\d.,-]/g, '')
    .replace(/,/g, '');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getEnvText = (name) => String(process.env[name] || '').trim();

const catalogByKind = {
  PRODUCTO: 'Productos',
  COMBO: 'Combos',
  RECETA: 'Recetas'
};

const catalogSearchPlaceholderByKind = {
  PRODUCTO: /Buscar productos/i,
  COMBO: /Buscar combos/i,
  RECETA: /Buscar recetas/i
};

const openCaja = async (page) => {
  await page.goto('/dashboard/ventas?tab=caja');
  await expect(page.locator('.ventas-caja-layout__catalog')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.ventas-cart-panel')).toBeVisible();
};

const selectCatalog = async (page, kind) => {
  await page.locator('.ventas-catalog-dropdown [role="combobox"]').click();
  await page.getByRole('option', { name: new RegExp(`^${catalogByKind[kind]}$`, 'i') }).click();
  await expect(page.getByPlaceholder(catalogSearchPlaceholderByKind[kind])).toBeVisible();
};

const visibleCardsByKind = async (page, kind) => {
  const dataCards = page.locator(`[data-testid="ventas-catalog-card"][data-catalog-kind="${kind}"]`).filter({ hasNotText: /Agotado|Sin stock/i });
  if (await dataCards.count()) return dataCards;
  return page.locator('.vcp-card').filter({ hasText: new RegExp(kind, 'i') }).filter({ hasNotText: /Agotado|Sin stock/i });
};

const addCatalogItem = async (page, kind, preferredName = '') => {
  await selectCatalog(page, kind);
  const search = page.getByPlaceholder(catalogSearchPlaceholderByKind[kind]);
  if (preferredName) {
    await search.fill(preferredName);
  } else {
    await search.fill('');
  }

  const cards = await visibleCardsByKind(page, kind);
  await expect(cards.first(), `No hay ${kind} disponible en el catalogo QA.`).toBeVisible({ timeout: 20_000 });

  let card = cards.first();
  if (kind === 'PRODUCTO') {
    const count = await cards.count();
    for (let index = 0; index < count; index += 1) {
      const candidate = cards.nth(index);
      const stockAttr = await candidate.getAttribute('data-catalog-stock');
      const stockText = await candidate.locator('.vcp-card__stock').innerText().catch(() => '');
      const stock = Number(stockAttr || String(stockText).match(/\d+/)?.[0] || 0);
      if (Number.isFinite(stock) && stock >= 2) {
        card = candidate;
        break;
      }
    }
  }

  const itemName = String(
    await card.getAttribute('data-catalog-name') ||
    await card.locator('.vcp-card__name').innerText().catch(() => '') ||
    kind
  );
  const addButton = card.getByTestId('ventas-catalog-add')
    .or(card.getByRole('button', { name: /agregar|anadir|añadir/i }))
    .first();
  await addButton.click();
  await resolveComplementModalIfOpen(page);
  return itemName;
};

const resolveComplementModalIfOpen = async (page, optionOffset = 0) => {
  const modal = page.getByRole('dialog', { name: /Seleccionar complementos/i });
  if (!(await modal.isVisible().catch(() => false))) return;

  const options = modal.getByTestId('ventas-complemento-option')
    .or(modal.locator('.ventas-complementos-modal__option'))
    .filter({ has: page.locator('input:not(:disabled)') });
  const count = await options.count();
  if (count > 0) {
    await options.nth(Math.min(optionOffset, count - 1)).click();
  }
  await modal.getByTestId('ventas-complementos-confirmar')
    .or(modal.getByRole('button', { name: /agregar al carrito|guardar complementos/i }))
    .first()
    .click();
  await expect(modal).toBeHidden();
};

const cartLines = async (page, kind) => {
  const dataLines = page.locator(`[data-testid="ventas-cart-item"][data-cart-kind="${kind}"]`);
  if (await dataLines.count()) return dataLines;
  return page.locator('.ventas-cart__item');
};

const addExtrasToLine = async (page, kind, index, quantity) => {
  const lines = await cartLines(page, kind);
  const line = lines.nth(index);
  await expect(line).toBeVisible();
  await line.getByTestId('ventas-cart-extras')
    .or(line.getByRole('button', { name: /extra/i }))
    .first()
    .click();

  const modal = page.getByRole('dialog', { name: /Extras/i });
  await expect(modal).toBeVisible();
  let extraOptions = modal.getByTestId('ventas-extra-option').filter({
    has: page.locator('[data-testid="ventas-extra-increment"]:not(:disabled)')
  });
  if (!(await extraOptions.count())) {
    extraOptions = modal.locator('.ventas-extras-modal__card').filter({
      has: page.locator('.ventas-create-modal__qty-control button:not(:disabled)')
    });
  }
  await expect(extraOptions.first(), 'QA no tiene extras disponibles para este item.').toBeVisible();

  const option = extraOptions.first();
  for (let step = 0; step < quantity; step += 1) {
    await option.getByTestId('ventas-extra-increment')
      .or(option.locator('.ventas-create-modal__qty-control button').last())
      .first()
      .click();
  }
  await modal.getByTestId('ventas-extras-confirmar')
    .or(modal.getByRole('button', { name: /confirmar/i }))
    .first()
    .click();
  await expect(modal).toBeHidden();
};

const setLineObservation = async (page, kind, index, text) => {
  const lines = await cartLines(page, kind);
  const line = lines.nth(index);
  await expect(line).toBeVisible();
  await line.getByTestId('ventas-cart-observacion-toggle')
    .or(line.getByRole('button', { name: /obs/i }))
    .first()
    .click();
  await line.getByTestId('ventas-cart-observacion')
    .or(line.locator('textarea'))
    .first()
    .fill(text);
};

const fillCartScenario = async (page) => {
  const comboName = await addCatalogItem(page, 'COMBO', getEnvText('E2E_COMBO_NAME'));
  await addCatalogItem(page, 'COMBO', getEnvText('E2E_COMBO_NAME') || comboName);
  await expect(await cartLines(page, 'COMBO')).toHaveCount(2);
  await addExtrasToLine(page, 'COMBO', 0, 2);
  await addExtrasToLine(page, 'COMBO', 1, 3);
  await setLineObservation(page, 'COMBO', 0, `E2E combo A ${Date.now()}`);
  await setLineObservation(page, 'COMBO', 1, `E2E combo B ${Date.now()}`);

  const recetaName = await addCatalogItem(page, 'RECETA', getEnvText('E2E_RECETA_NAME'));
  await addCatalogItem(page, 'RECETA', getEnvText('E2E_RECETA_NAME') || recetaName);
  const recetaLines = await cartLines(page, 'RECETA');
  await expect(recetaLines).toHaveCount(1);
  await expect(recetaLines.first().locator('.ventas-create-modal__qty-control input')).toHaveValue('2');

  await addCatalogItem(page, 'PRODUCTO');
  await addCatalogItem(page, 'PRODUCTO');
  const productLines = await cartLines(page, 'PRODUCTO');
  await expect(productLines).toHaveCount(1);
  await expect(productLines.first().locator('.ventas-create-modal__qty-control input')).toHaveValue('2');

  return { comboName, recetaName };
};

const assertIndependentCustomLines = async (page) => {
  const comboLines = await cartLines(page, 'COMBO');
  const recetaLines = await cartLines(page, 'RECETA');
  await expect(comboLines).toHaveCount(2);
  await expect(recetaLines).toHaveCount(1);
  await expect(comboLines.nth(0).getByTestId('ventas-cart-custom-qty')).toContainText('1 unidad');
  await expect(comboLines.nth(1).getByTestId('ventas-cart-custom-qty')).toContainText('1 unidad');
  await expect(recetaLines.first().locator('.ventas-create-modal__qty-control input')).toHaveValue('2');

  const firstComboKey = await comboLines.nth(0).getAttribute('data-cart-key');
  const secondComboKey = await comboLines.nth(1).getAttribute('data-cart-key');
  expect(firstComboKey).toBeTruthy();
  expect(secondComboKey).toBeTruthy();
  expect(firstComboKey).not.toBe(secondComboKey);
};

const setRecipeQuantity = async (page, quantity) => {
  const recetaLine = (await cartLines(page, 'RECETA')).first();
  await expect(recetaLine).toBeVisible();
  const quantityInput = recetaLine.locator('.ventas-create-modal__qty-control input').first();
  await quantityInput.fill(String(quantity));
  await quantityInput.press('Enter');
  const confirmModal = page.getByRole('alertdialog', { name: /Confirmar cantidad/i });
  await expect(confirmModal).toBeVisible();
  await confirmModal.getByRole('button', { name: new RegExp(`Aplicar ${quantity} ordenes`, 'i') }).click();
  await expect(confirmModal).toBeHidden();
  await expect(recetaLine.locator('.ventas-create-modal__qty-control input')).toHaveValue(String(quantity));
};

const openFinalize = async (page) => {
  await page.getByTestId('ventas-cart-continuar').click();
  const modal = page.getByRole('dialog', { name: /Finalizar operacion/i });
  await expect(modal).toBeVisible();
  return modal;
};

const payNow = async (page) => {
  const modal = await openFinalize(page);
  await modal.getByTestId('ventas-finalizar-tab-pagar').click();
  await modal.getByTestId('ventas-contacto-telefono').fill('99999999');
  const totalText = await modal.locator('.ventas-finalizar-modal__total .is-total strong').innerText();
  await modal.getByTestId('ventas-pago-monto-recibido').fill(parseMoney(totalText).toFixed(2));
  await modal.getByTestId('ventas-confirmar-pago').click();
  await page.waitForLoadState('networkidle').catch(() => null);
};

const createPendingOrder = async (page) => {
  const modal = await openFinalize(page);
  await modal.getByTestId('ventas-finalizar-tab-pendiente').click();
  await modal.getByTestId('ventas-pendiente-nombre-contacto').fill(`E2E Pendiente ${Date.now()}`);
  await modal.getByTestId('ventas-contacto-telefono').fill('99999999');
  await modal.getByTestId('ventas-crear-pedido-pendiente').click();
  await page.waitForLoadState('networkidle').catch(() => null);
};

test.describe.serial('Caja: combos y recetas independientes', () => {
  test.beforeAll(async ({ baseURL }) => {
    ensureQaOnly(baseURL);
  });

  test.beforeEach(async ({ page }) => {
    await openCaja(page);
  });

  test('pagar ahora conserva cards independientes y producto acumulado', async ({ page }, testInfo) => {
    const scenario = await fillCartScenario(page);
    await assertIndependentCustomLines(page);

    await testInfo.attach('ventas-caja-carrito-pagar-ahora', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        caso: 'pagar ahora',
        combo: scenario.comboName,
        receta: scenario.recetaName,
        combos_en_carrito: await (await cartLines(page, 'COMBO')).count(),
        recetas_en_carrito: await (await cartLines(page, 'RECETA')).count(),
        productos_en_carrito: await (await cartLines(page, 'PRODUCTO')).count()
      }, null, 2))
    });

    await payNow(page);
    await expect(page.getByRole('dialog').or(page.locator('.ventas-detail-modal'))).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('body')).toContainText(/venta|factura|pedido/i);
  });

  test('pedido pendiente conserva lineas separadas', async ({ page }, testInfo) => {
    const scenario = await fillCartScenario(page);
    await assertIndependentCustomLines(page);

    await testInfo.attach('ventas-caja-carrito-pendiente', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        caso: 'pedido pendiente',
        combo: scenario.comboName,
        receta: scenario.recetaName,
        combos_en_carrito: await (await cartLines(page, 'COMBO')).count(),
        recetas_en_carrito: await (await cartLines(page, 'RECETA')).count(),
        productos_en_carrito: await (await cartLines(page, 'PRODUCTO')).count()
      }, null, 2))
    });

    await createPendingOrder(page);
    await expect(page.locator('body')).toContainText(/pendiente|pedido/i, { timeout: 30_000 });
  });

  test('receta configurada soporta cantidad masiva y extras por orden', async ({ page }) => {
    const recetaName = await addCatalogItem(page, 'RECETA', getEnvText('E2E_RECETA_NAME'));
    await expect(await cartLines(page, 'RECETA')).toHaveCount(1);

    await setRecipeQuantity(page, 99);
    await addExtrasToLine(page, 'RECETA', 0, 1);
    const recetaLine = (await cartLines(page, 'RECETA')).first();
    await expect(recetaLine).toContainText(/99 en total/i);

    await recetaLine.getByTestId('ventas-cart-complementos')
      .or(recetaLine.getByRole('button', { name: /complementos/i }))
      .first()
      .click();
    const complementModal = page.getByRole('dialog', { name: /Editar configuracion de 99 ordenes|Seleccionar complementos/i });
    await expect(complementModal).toBeVisible();
    await complementModal.getByTestId('ventas-complementos-confirmar')
      .or(complementModal.getByRole('button', { name: /Aplicar a las 99 ordenes|Guardar complementos/i }))
      .first()
      .click();
    await expect(complementModal).toBeHidden();
    await expect((await cartLines(page, 'RECETA')).first().locator('.ventas-create-modal__qty-control input')).toHaveValue('99');

    await addCatalogItem(page, 'RECETA', getEnvText('E2E_RECETA_NAME') || recetaName);
    await expect(await cartLines(page, 'RECETA')).toHaveCount(1);
  });
});
