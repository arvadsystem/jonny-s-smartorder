import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createQzContextKey,
  resolveQzApiErrorCode,
  setQzAuthenticatedContext,
  subscribeQzAuthenticatedContext,
} from './qzSessionContext.js';

test('la identidad QZ cambia entre root, admin y cajero sin depender del rol', async () => {
  const changes = [];
  const unsubscribe = subscribeQzAuthenticatedContext(({ currentContext, reason }) => {
    changes.push({ currentContext, reason });
  });

  await setQzAuthenticatedContext({ idUsuario: 30, idSucursal: 1, reason: 'root-login' });
  await setQzAuthenticatedContext({ idUsuario: null, idSucursal: null, reason: 'root-logout' });
  await setQzAuthenticatedContext({ idUsuario: 1, idSucursal: 1, reason: 'admin-login' });
  await setQzAuthenticatedContext({ idUsuario: null, idSucursal: null, reason: 'admin-logout' });
  await setQzAuthenticatedContext({ idUsuario: 54, idSucursal: 1, reason: 'cashier-login' });
  const unchanged = await setQzAuthenticatedContext({
    idUsuario: 54,
    idSucursal: 1,
    reason: 'same-render',
  });

  unsubscribe();
  await setQzAuthenticatedContext({ idUsuario: null, idSucursal: null, reason: 'test-cleanup' });

  assert.equal(unchanged.changed, false);
  assert.deepEqual(changes.map(({ currentContext }) => currentContext), [
    { idUsuario: 30, idSucursal: 1 },
    { idUsuario: null, idSucursal: null },
    { idUsuario: 1, idSucursal: 1 },
    { idUsuario: null, idSucursal: null },
    { idUsuario: 54, idSucursal: 1 },
  ]);
});

test('la clave QZ incluye usuario, sucursal, host y puerto', () => {
  const options = { idSucursal: 1, host: 'qz-elcarmen.jonnyshn.com', port: 8181 };

  assert.equal(
    createQzContextKey({ idUsuario: 30, ...options }),
    '30:1:qz-elcarmen.jonnyshn.com:8181',
  );
  assert.notEqual(
    createQzContextKey({ idUsuario: 30, ...options }),
    createQzContextKey({ idUsuario: 1, ...options }),
  );
  assert.notEqual(
    createQzContextKey({ idUsuario: 1, ...options }),
    createQzContextKey({ idUsuario: 54, ...options }),
  );
});

test('clasifica respuestas HTTP de certificado y firma', () => {
  assert.equal(resolveQzApiErrorCode({ status: 401 }), 'QZ_SESSION_UNAUTHORIZED');
  assert.equal(resolveQzApiErrorCode({ status: 403, code: 'CSRF' }, 'sign'), 'QZ_CSRF_INVALID');
  assert.equal(
    resolveQzApiErrorCode({ status: 403, code: 'QZ_SUCURSAL_FORBIDDEN' }, 'sign'),
    'QZ_SUCURSAL_FORBIDDEN',
  );
  assert.equal(
    resolveQzApiErrorCode({ status: 403, code: 'FORBIDDEN' }, 'sign'),
    'QZ_PERMISSION_FORBIDDEN',
  );
  assert.equal(resolveQzApiErrorCode({ status: 503 }), 'QZ_CERTIFICATE_UNAVAILABLE');
  assert.equal(resolveQzApiErrorCode({ status: 500 }, 'sign'), 'QZ_SIGNATURE_ERROR');
});
