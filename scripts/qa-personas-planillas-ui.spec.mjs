import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:5173';
const BACKEND_REPO_PATH =
  process.env.BACKEND_REPO_PATH || path.resolve(process.cwd(), '../Base_de_datos/jonny-s-backend');

const nowStamp = () => {
  const date = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

const parseLastJsonLine = (raw = '') => {
  const lines = String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith('{') || !line.endsWith('}')) continue;
    try {
      return JSON.parse(line);
    } catch {
      // continue
    }
  }
  return null;
};

const buildAuthArtifacts = () => {
  const nodeScript = `
    import pool from './config/db-connection.js';
    import jwt from 'jsonwebtoken';
    import JWT_SECRET from './config/jwt.js';
    import crypto from 'crypto';
    import { createSession } from './utils/security/sessionService.js';

    const userResult = await pool.query(\`
      SELECT u.id_usuario, u.nombre_usuario, u.id_empleado, e.id_sucursal
      FROM usuarios u
      LEFT JOIN empleados e ON e.id_empleado = u.id_empleado
      WHERE u.id_usuario = 1
      LIMIT 1
    \`);
    const user = userResult.rows[0];
    if (!user) {
      console.log(JSON.stringify({ error: 'super_admin_not_found' }));
      await pool.end();
      process.exit(1);
    }

    const activeSessionId = await createSession({
      id_usuario: user.id_usuario,
      ip_origen: '127.0.0.1',
      user_agent: 'playwright-ui-qa',
      dispositivo: 'qa-bot',
      navegador: 'chromium',
      sistema_operativo: 'windows',
      ubicacion: null
    });

    const payload = {
      id_usuario: user.id_usuario,
      nombre_usuario: user.nombre_usuario,
      rol: user.id_empleado,
      id_sucursal: user.id_sucursal,
      must_change_password: false,
      sid: activeSessionId
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    const csrf = crypto.randomBytes(32).toString('hex');
    console.log(JSON.stringify({ token, csrf, sid: activeSessionId }));
    await pool.end();
  `;

  const command = process.platform === 'win32'
    ? 'node --input-type=module -'
    : "node --input-type=module -";

  const result = spawnSync(command, {
    cwd: BACKEND_REPO_PATH,
    shell: true,
    input: nodeScript,
    encoding: 'utf8'
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const parsed = parseLastJsonLine(stdout);
  if (result.status !== 0 || !parsed?.token || !parsed?.csrf) {
    throw new Error(`No se pudo construir autenticacion UI. status=${result.status} stdout=${stdout} stderr=${stderr}`);
  }

  return parsed;
};

const writeUiReport = (rows) => {
  const docsDir = path.resolve(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
  const reportPath = path.join(docsDir, `REPORTE_QA_UI_PERSONAS_PLANILLAS_${nowStamp()}.md`);

  const allPassed = rows.every((row) => row.status === 'PASS');
  const lines = [];
  lines.push('# Reporte QA UI - Personas y Planillas');
  lines.push('');
  lines.push(`Fecha: ${new Date().toISOString()}`);
  lines.push(`Base URL: ${UI_BASE_URL}`);
  lines.push(`Resultado global: ${allPassed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('| ID | Prueba | Resultado | Evidencia |');
  lines.push('|---|---|---|---|');
  for (const row of rows) {
    lines.push(`| ${row.id} | ${row.name} | ${row.status} | ${String(row.evidence || '').replaceAll('|', '/') } |`);
  }
  lines.push('');
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
  return reportPath;
};

test.describe('QA UI Personas/Planillas', () => {
  test('A-E smoke', async ({ browser }) => {
    test.setTimeout(180000);
    const auth = buildAuthArtifacts();
    const rows = [];

    const record = (id, name, passed, evidence) => {
      rows.push({
        id,
        name,
        status: passed ? 'PASS' : 'FAIL',
        evidence: evidence || ''
      });
    };

    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'access_token',
        value: auth.token,
        url: UI_BASE_URL,
        httpOnly: true
      },
      {
        name: 'csrf_token',
        value: auth.csrf,
        url: UI_BASE_URL,
        httpOnly: false
      },
      {
        name: 'access_token',
        value: auth.token,
        url: 'http://localhost:3001',
        httpOnly: true
      },
      {
        name: 'csrf_token',
        value: auth.csrf,
        url: 'http://localhost:3001',
        httpOnly: false
      }
    ]);
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('smartorder_storage_schema_version', '2026-03-25.1');
        window.localStorage.setItem('usuariosViewMode', 'cards');
        window.localStorage.setItem('clientesViewMode', 'cards');
        window.localStorage.setItem('empleadosViewMode', 'cards');
        window.localStorage.setItem('smartorder_auth_session_hint', '1');
      } catch {
        // Ignorar documentos sin acceso a localStorage (about:blank/sandbox).
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    const waitForTabReady = async (expectedClass) => {
      const timeoutMs = 30000;
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        if (page.url().includes('/login')) {
          return { ok: false, reason: `redirect_login url=${page.url()}` };
        }

        if (await page.locator(expectedClass).count()) {
          return { ok: true, reason: '' };
        }

        if (await page.getByText('No se pudo validar la sesion', { exact: false }).count()) {
          return { ok: false, reason: `session_reconnect_screen url=${page.url()}` };
        }

        await page.waitForTimeout(800);
      }

      const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
      const snippet = bodyText.slice(0, 220);
      return { ok: false, reason: `class_not_found expected=${expectedClass} url=${page.url()} body="${snippet}"` };
    };

    const openTab = async (tabKey, expectedClass) => {
      await page.goto(`${UI_BASE_URL}/dashboard/personas?tab=${tabKey}`, { waitUntil: 'domcontentloaded' });
      return waitForTabReady(expectedClass);
    };

    const waitForListLoaded = async (rootSelector) => {
      await page.waitForFunction(
        (selector) => {
          const root = document.querySelector(selector);
          if (!root) return false;
          if (root.querySelector('.inv-catpro-loading')) return false;
          return Boolean(
            root.querySelector('.inv-catpro-grid-page') ||
            root.querySelector('.personas-page__table') ||
            root.querySelector('.inv-catpro-empty')
          );
        },
        rootSelector,
        { timeout: 30000 }
      );
    };

    try {
      if (page.url().includes('/login')) {
        throw new Error('No se pudo abrir dashboard con sesion tecnica.');
      }

      // A) y B) Usuarios.
      try {
        const usersReady = await openTab('usuarios', '.personas-page--usuarios');
        if (!usersReady.ok) {
          record('A', 'Usuarios muestra 9 cards por pagina', false, `No se pudo abrir tab Usuarios :: ${usersReady.reason}`);
          record('B', 'Usuarios inactivos se muestran correctamente en cards', false, `No se pudo abrir tab Usuarios :: ${usersReady.reason}`);
        } else {
          await waitForListLoaded('.personas-page--usuarios');
          const usersCardsViewBtn = page.locator('.personas-page--usuarios button[title="Vista en tarjetas"]').first();
          if (await usersCardsViewBtn.count()) {
            const pressed = await usersCardsViewBtn.getAttribute('aria-pressed');
            if (pressed !== 'true') {
              await usersCardsViewBtn.click();
            }
          }
          await page.waitForFunction(
            () => document.querySelectorAll('.personas-page--usuarios .inv-catpro-grid-page .inv-catpro-item').length > 0,
            { timeout: 30000 }
          );
          const userCards = page.locator('.personas-page--usuarios .inv-catpro-grid-page .inv-catpro-item');
          const cardCount = await userCards.count();
          record('A', 'Usuarios muestra 9 cards por pagina', cardCount === 9, `cards_en_pagina=${cardCount}`);

          await page.locator('.personas-page--usuarios input[aria-label="Ver inactivos"]').first().click();
          await waitForListLoaded('.personas-page--usuarios');
          const inactiveBadges = page.locator('.personas-page--usuarios .inv-catpro-grid-page .inv-catpro-item .inv-ins-card__badge');
          const badgeCount = await inactiveBadges.count();
          const badgeTexts = (await inactiveBadges.allInnerTexts()).map((text) => text.trim().toUpperCase());
          const allInactive = badgeCount > 0 && badgeTexts.every((text) => text.includes('INACTIVO'));
          record('B', 'Usuarios inactivos se muestran correctamente en cards', allInactive, `badges=${badgeCount} textos=${badgeTexts.join(',')}`);
        }
      } catch (error) {
        record('A', 'Usuarios muestra 9 cards por pagina', false, `Error A: ${error.message}`);
        record('B', 'Usuarios inactivos se muestran correctamente en cards', false, `Error B: ${error.message}`);
      }

      // C) y D) Clientes.
      try {
        const clientsReady = await openTab('clientes', '.personas-page--clientes');
        if (!clientsReady.ok) {
          record('C', 'Clientes refresca RTN en card tras editar persona', false, `No se pudo abrir tab Clientes :: ${clientsReady.reason}`);
          record('D', 'Filtro estado no rompe pantalla', false, `No se pudo abrir tab Clientes :: ${clientsReady.reason}`);
        } else {
          await waitForListLoaded('.personas-page--clientes');
          const clientsCardsViewBtn = page.locator('.personas-page--clientes button[title="Vista en tarjetas"]').first();
          if (await clientsCardsViewBtn.count()) {
            const pressed = await clientsCardsViewBtn.getAttribute('aria-pressed');
            if (pressed !== 'true') {
              await clientsCardsViewBtn.click();
            }
          }
          await page.waitForFunction(
            () => document.querySelectorAll('.personas-page--clientes .inv-catpro-grid-page .inv-catpro-item').length > 0,
            { timeout: 30000 }
          );

          const personaCard = page
            .locator('.personas-page--clientes .inv-catpro-grid-page .inv-catpro-item')
            .filter({ hasText: 'Tipo: Cliente Persona' })
            .first();
          try {
            const hasPersonaCard = await personaCard.count();

            if (hasPersonaCard === 0) {
              record('C', 'Clientes refresca RTN en card tras editar persona', false, 'No se encontro card de Cliente Persona para prueba');
            } else {
              const cardTitle = (await personaCard.locator('.fw-bold').first().innerText()).trim();
              const rtnRowBefore = (await personaCard.locator('.personas-page__card-row').filter({ hasText: 'RTN:' }).first().innerText()).trim();

              await personaCard.locator('button[title="Editar"]').first().click({ force: true });
              await page.waitForTimeout(1200);
              await page.locator('button:has-text("Editar datos de persona")').first().click();
              const personaModal = page.locator('aside:has-text("Editar persona vinculada")').first();
              await expect(personaModal).toBeVisible({ timeout: 12000 });

              const rtnInput = personaModal.locator('xpath=.//label[contains(., "RTN")]/following::input[1]').first();
              const oldRtn = await rtnInput.inputValue();
              const newRtn = oldRtn === '9' ? '8' : '9';
              await rtnInput.fill(newRtn);
              const submitPersonaButton = personaModal.locator('button[type="submit"]').first();
              await submitPersonaButton.scrollIntoViewIfNeeded();
              await submitPersonaButton.click({ force: true });
              await page.waitForTimeout(2400);

              const updatedCard = page
                .locator('.personas-page--clientes .inv-catpro-grid-page .inv-catpro-item')
                .filter({ hasText: cardTitle.replace(/^\d+\.\s*/, '') })
                .first();
              const rtnRowAfter = (await updatedCard.locator('.personas-page__card-row').filter({ hasText: 'RTN:' }).first().innerText()).trim();

              const changed = rtnRowAfter !== rtnRowBefore;
              record('C', 'Clientes refresca RTN en card tras editar persona', changed, `antes="${rtnRowBefore}" despues="${rtnRowAfter}"`);
            }
          } catch (error) {
            record('C', 'Clientes refresca RTN en card tras editar persona', false, `Error C: ${error.message}`);
          } finally {
            const closeButtons = page.locator(
              'aside button[title="Cerrar"], aside button[aria-label="Cerrar"], .inv-prod-drawer-close'
            );
            if (await closeButtons.count()) {
              await closeButtons.first().click({ force: true }).catch(() => {});
            }
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }

          try {
            const inactiveToggle = page.locator('.personas-page--clientes input[aria-label="Ver inactivos"]').first();
            if (await inactiveToggle.count()) {
              await inactiveToggle.click({ force: true });
              await waitForListLoaded('.personas-page--clientes');
            }
            const bodyText = (await page.locator('body').innerText()).toLowerCase();
            const hasEstadoError = bodyText.includes('no soporta filtro por estado') || bodyText.includes('tabla personas no soporta filtro por estado');
            record('D', 'Filtro estado no rompe pantalla', !hasEstadoError, hasEstadoError ? 'Se detecto mensaje de error de filtro estado' : 'Sin errores de filtro estado');
          } catch (error) {
            record('D', 'Filtro estado no rompe pantalla', false, `Error D: ${error.message}`);
          }
        }
      } catch (error) {
        if (!rows.some((row) => row.id === 'C')) {
          record('C', 'Clientes refresca RTN en card tras editar persona', false, `Error C: ${error.message}`);
        }
        if (!rows.some((row) => row.id === 'D')) {
          record('D', 'Filtro estado no rompe pantalla', false, `Error D: ${error.message}`);
        }
      }

      // E) Planillas.
      try {
        await page.goto(
          `${UI_BASE_URL}/dashboard/planillas?planillasTab=adelantos-salario`,
          { waitUntil: 'domcontentloaded' }
        );
        const planillasReady = await waitForTabReady('.personas-page--planillas');
        if (!planillasReady.ok) {
          record('E', 'Modal de adelantos reabre limpio', false, `No se pudo abrir Planillas :: ${planillasReady.reason}`);
          throw new Error(`Planillas no disponible: ${planillasReady.reason}`);
        }
        await page.waitForTimeout(1200);

        const applyButton = page.locator('button[title="Aplicar adelanto"]').first();
        if (await applyButton.count()) {
          await applyButton.click();
          await expect(page.locator('text=Aplicar Adelanto')).toBeVisible({ timeout: 12000 });
          const montoInput = page.locator('#adelanto-monto-aplicar').first();
          await montoInput.fill('12');
          await page.locator('button:has-text("Cancelar")').first().click();
          await page.waitForTimeout(900);

          await applyButton.click();
          await expect(page.locator('text=Aplicar Adelanto')).toBeVisible({ timeout: 12000 });
          const reopenedValue = await page.locator('#adelanto-monto-aplicar').first().inputValue();
          record('E', 'Modal de adelantos reabre limpio', reopenedValue.trim() === '', `valor_reabrir="${reopenedValue}"`);
        } else {
          const globalRegisterBtn = page.locator('button:has-text("Registrar adelanto")').first();
          if (await globalRegisterBtn.count()) {
            await globalRegisterBtn.click();
            await page.waitForTimeout(900);
            const globalMonto = page.locator('#adelanto-global-monto').first();
            await globalMonto.fill('25');
            await page.locator('button:has-text("Cancelar")').first().click();
            await page.waitForTimeout(800);
            await globalRegisterBtn.click();
            await page.waitForTimeout(900);
            const reopenedGlobalValue = await page.locator('#adelanto-global-monto').first().inputValue();
            record('E', 'Modal de adelantos reabre limpio', reopenedGlobalValue.trim() === '', `fallback_global valor_reabrir="${reopenedGlobalValue}"`);
          } else {
            record('E', 'Modal de adelantos reabre limpio', false, 'No se encontro boton de aplicar ni registrar adelanto');
          }
        }
      } catch (error) {
        if (!rows.some((row) => row.id === 'E')) {
          record('E', 'Modal de adelantos reabre limpio', false, `Error E: ${error.message}`);
        }
      }
    } finally {
      await context.close();
    }

    const reportPath = writeUiReport(rows);
    const failures = rows.filter((row) => row.status !== 'PASS');
    console.log(`Reporte UI generado: ${reportPath}`);
    if (failures.length > 0) {
      throw new Error(`UI QA con fallas: ${failures.map((f) => f.id).join(', ')}`);
    }
  });
});
