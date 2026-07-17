import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const qzRequests = [];
const authRequests = [];
const server = await createServer({
  server: {
    host: '127.0.0.1',
    port: 0,
    open: false,
  },
});

let browser;

try {
  await server.listen();
  const appUrl = server.resolvedUrls?.local?.[0];
  assert.ok(appUrl, 'Vite no expuso una URL local para la prueba QZ.');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/logout')) {
      authRequests.push({
        operation: 'logout',
        csrf: request.headers()['x-csrf-token'] || '',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (url.pathname.endsWith('/login')) {
      authRequests.push({
        operation: 'login',
        csrf: request.headers()['x-csrf-token'] || '',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          usuario: { id_usuario: 30, id_sucursal: 1 },
          csrfToken: 'a'.repeat(64),
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/ventas/qz/certificate')) {
      const idSucursal = url.searchParams.get('id_sucursal');
      qzRequests.push({
        operation: 'certificate',
        idSucursal,
      });

      if (idSucursal === '403' || idSucursal === '404') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({
            code: idSucursal === '403' ? 'QZ_SUCURSAL_FORBIDDEN' : 'FORBIDDEN',
            message: 'Acceso denegado.',
          }),
        });
        return;
      }

      if (idSucursal === '503') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'QZ_CERTIFICATE_NOT_CONFIGURED',
            message: 'Certificado no disponible.',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ certificate: 'QA_CERTIFICATE' }),
      });
      return;
    }

    if (url.pathname.endsWith('/ventas/qz/sign')) {
      const body = request.postDataJSON();
      qzRequests.push({
        operation: 'sign',
        idSucursal: String(body?.id_sucursal || ''),
        request: String(body?.request || ''),
        csrf: request.headers()['x-csrf-token'] || '',
      });

      if (body?.request === 'qa-csrf-invalid') {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'CSRF', message: 'CSRF invalido.' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ signature: 'QA_SIGNATURE' }),
      });
      return;
    }

    await route.continue();
  });

  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });

  const browserEvidence = await page.evaluate(async () => {
    const qzContext = await import('/src/services/qzSessionContext.js');
    const qzService = await import('/src/services/qzPrintService.js');
    const { apiFetch } = await import('/src/services/api.js');

    const currentCsrfToken = 'a'.repeat(64);
    sessionStorage.setItem('smartorder_client_csrf_token', 'b'.repeat(64));
    await apiFetch('/logout', 'POST');
    const csrfAfterLogout = sessionStorage.getItem('smartorder_client_csrf_token');
    await apiFetch('/login', 'POST', { username: 'qa-user' });
    const csrfAfterLogin = sessionStorage.getItem('smartorder_client_csrf_token');
    await qzService.isQzAvailable();

    const qz = window.qz;
    const state = {
      active: false,
      connects: 0,
      disconnects: 0,
      concurrentConnections: 0,
      maxConcurrentConnections: 0,
      certificateHandler: null,
      signatureFactory: null,
      printJobs: [],
    };

    qz.websocket.isActive = () => state.active;
    qz.websocket.connect = async () => {
      state.concurrentConnections += 1;
      state.maxConcurrentConnections = Math.max(
        state.maxConcurrentConnections,
        state.concurrentConnections,
      );
      state.connects += 1;
      state.active = true;
      state.concurrentConnections -= 1;
    };
    qz.websocket.disconnect = async () => {
      if (state.active) state.disconnects += 1;
      state.active = false;
    };
    qz.security.setCertificatePromise = (handler) => {
      state.certificateHandler = handler;
    };
    qz.security.setSignatureAlgorithm = () => undefined;
    qz.security.setSignaturePromise = (factory) => {
      state.signatureFactory = factory;
    };
    qz.printers.find = async () => ['ZKP8008', 'POS-80C'];
    qz.configs.create = (printerName, options) => ({ printerName, options });
    const recordPrintJob = async (config) => {
      state.printJobs.push(config.printerName);
    };
    qz.print = recordPrintJob;

    const resolveCertificate = () => new Promise((resolve, reject) => {
      state.certificateHandler(resolve, reject);
    });
    const resolveSignature = (factory = state.signatureFactory, request = 'qa-request') =>
      new Promise((resolve, reject) => factory(request)(resolve, reject));

    const users = [30, 1, 54];
    const staleCallbackCodes = [];

    for (const idUsuario of users) {
      await qzContext.setQzAuthenticatedContext({
        idUsuario,
        idSucursal: 1,
        reason: `qa-login-${idUsuario}`,
      });
      await qzService.connectQz({ idSucursal: 1 });
      await resolveCertificate();
      await resolveSignature();
      await qzService.getPrinters({ idSucursal: 1 });
      await qzService.printHtmlToPrinter({
        idSucursal: 1,
        printerName: 'ZKP8008',
        html: '<p>Factura QA</p>',
        jobName: `Factura QA ${idUsuario}`,
      });
      await qzService.printHtmlToPrinter({
        idSucursal: 1,
        printerName: 'POS-80C',
        html: '<p>Cocina QA</p>',
        jobName: `Cocina QA ${idUsuario}`,
      });

      const staleSignatureFactory = state.signatureFactory;
      await qzContext.setQzAuthenticatedContext({
        idUsuario: null,
        idSucursal: null,
        reason: `qa-logout-${idUsuario}`,
      });

      try {
        await resolveSignature(staleSignatureFactory);
        staleCallbackCodes.push('NO_ERROR');
      } catch (error) {
        staleCallbackCodes.push(error?.code || 'UNKNOWN');
      }
    }

    let withoutSessionCode = null;
    try {
      await qzService.connectQz({ idSucursal: 1 });
    } catch (error) {
      withoutSessionCode = error?.code || null;
    }

    const rootAdminCashierEvidence = {
      connects: state.connects,
      disconnects: state.disconnects,
      maxConcurrentConnections: state.maxConcurrentConnections,
      active: state.active,
    };

    await qzContext.setQzAuthenticatedContext({
      idUsuario: 30,
      idSucursal: 1,
      reason: 'qa-negative-login',
    });
    await qzService.connectQz({ idSucursal: 1 });

    let csrfInvalidCode = null;
    qz.print = async () => resolveSignature(state.signatureFactory, 'qa-csrf-invalid');
    try {
      await qzService.printHtmlToPrinter({
        idSucursal: 1,
        printerName: 'ZKP8008',
        html: '<p>CSRF negativo</p>',
      });
    } catch (error) {
      csrfInvalidCode = error?.code || null;
    } finally {
      qz.print = recordPrintJob;
    }
    await qzContext.setQzAuthenticatedContext({
      idUsuario: null,
      idSucursal: null,
      reason: 'qa-negative-csrf-logout',
    });

    const resolveCertificateError = async (idSucursal) => {
      await qzContext.setQzAuthenticatedContext({
        idUsuario: 30,
        idSucursal: 1,
        reason: `qa-negative-${idSucursal}`,
      });
      try {
        await qzService.connectQz({ idSucursal });
        return null;
      } catch (error) {
        return error?.code || null;
      } finally {
        await qzContext.setQzAuthenticatedContext({
          idUsuario: null,
          idSucursal: null,
          reason: `qa-negative-${idSucursal}-logout`,
        });
      }
    };

    const forbiddenSucursalCode = await resolveCertificateError(403);
    const forbiddenPermissionCode = await resolveCertificateError(404);
    const unavailableCertificateCode = await resolveCertificateError(503);

    return {
      rootAdminCashierEvidence,
      active: state.active,
      staleCallbackCodes,
      withoutSessionCode,
      csrfAfterLogoutCleared: csrfAfterLogout === null,
      csrfAfterLoginValid: csrfAfterLogin === currentCsrfToken,
      printJobs: state.printJobs,
      csrfInvalidCode,
      forbiddenSucursalCode,
      forbiddenPermissionCode,
      unavailableCertificateCode,
    };
  });

  assert.deepEqual(browserEvidence, {
    rootAdminCashierEvidence: {
      connects: 3,
      disconnects: 3,
      maxConcurrentConnections: 1,
      active: false,
    },
    active: false,
    staleCallbackCodes: [
      'QZ_SESSION_UNAUTHORIZED',
      'QZ_SESSION_UNAUTHORIZED',
      'QZ_SESSION_UNAUTHORIZED',
    ],
    withoutSessionCode: 'QZ_SESSION_UNAUTHORIZED',
    csrfAfterLogoutCleared: true,
    csrfAfterLoginValid: true,
    printJobs: ['ZKP8008', 'POS-80C', 'ZKP8008', 'POS-80C', 'ZKP8008', 'POS-80C'],
    csrfInvalidCode: 'QZ_CSRF_INVALID',
    forbiddenSucursalCode: 'QZ_SUCURSAL_FORBIDDEN',
    forbiddenPermissionCode: 'QZ_PERMISSION_FORBIDDEN',
    unavailableCertificateCode: 'QZ_CERTIFICATE_UNAVAILABLE',
  });
  assert.deepEqual(
    qzRequests.slice(0, 6).map(({ operation, idSucursal }) => ({ operation, idSucursal })),
    [
      { operation: 'certificate', idSucursal: '1' },
      { operation: 'sign', idSucursal: '1' },
      { operation: 'certificate', idSucursal: '1' },
      { operation: 'sign', idSucursal: '1' },
      { operation: 'certificate', idSucursal: '1' },
      { operation: 'sign', idSucursal: '1' },
    ],
  );
  assert.deepEqual(
    qzRequests.filter(({ operation }) => operation === 'sign').map(({ csrf }) => csrf),
    ['a'.repeat(64), 'a'.repeat(64), 'a'.repeat(64), 'a'.repeat(64)],
  );
  assert.deepEqual(authRequests, [
    { operation: 'logout', csrf: 'b'.repeat(64) },
    { operation: 'login', csrf: '' },
  ]);

  const apiSource = fs.readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
  assert.match(apiSource, /credentials:\s*'include'/);

  const safeAuthEvidence = authRequests.map(({ operation, csrf }) => ({
    operation,
    csrfHeaderPresent: Boolean(csrf),
  }));
  const safeQzEvidence = qzRequests.map(({ operation, idSucursal, csrf }) => ({
    operation,
    idSucursal,
    ...(operation === 'sign' ? { csrfHeaderPresent: Boolean(csrf) } : {}),
  }));
  console.log(JSON.stringify({ browserEvidence, safeAuthEvidence, safeQzEvidence }, null, 2));
} finally {
  if (browser) await browser.close();
  await server.close();
}
