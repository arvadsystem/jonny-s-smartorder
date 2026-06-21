import assert from 'node:assert/strict';
import {
  createVentasClientRequestManager,
  isCancelledVentasClientRequest
} from '../src/pages/dashboard/ventas/utils/ventasClientRequestManager.js';
import {
  createInitialPersonaForm,
  validatePersonaForm
} from '../src/pages/dashboard/personas/components/common/persona-form-shared.js';
import {
  createInitialEmpresaForm,
  validateEmpresaForm
} from '../src/pages/dashboard/personas/components/common/empresa-form-shared.js';

const manager = createVentasClientRequestManager();
const slow = manager.start('fernando');
const current = manager.start('jose');
assert.equal(slow.controller.signal.aborted, true, 'nueva busqueda debe cancelar la anterior');
assert.equal(manager.isCurrent(slow), false, 'respuesta anterior no debe seguir vigente');
assert.equal(manager.finish(slow), false, 'finally anterior no debe apagar loading vigente');
assert.equal(manager.isCurrent(current), true, 'ultima busqueda debe conservar vigencia');
assert.equal(isCancelledVentasClientRequest({ name: 'AbortError' }, slow.controller.signal), true);
assert.equal(manager.finish(current), true, 'ultima busqueda debe poder finalizar loading');

const quickPersona = { ...createInitialPersonaForm(), nombre: 'Fernando' };
assert.deepEqual(
  validatePersonaForm(quickPersona, { requireLastName: false, requireGender: false }),
  {},
  'alta rapida debe aceptar solo nombre'
);
assert.ok(validatePersonaForm(quickPersona).apellido, 'formulario completo conserva apellido obligatorio');
assert.ok(validatePersonaForm(quickPersona).genero, 'formulario completo conserva genero obligatorio');

const quickEmpresa = { ...createInitialEmpresaForm(), nombre_empresa: 'Empresa QA' };
assert.deepEqual(
  validateEmpresaForm(quickEmpresa, { requireRtn: false }),
  {},
  'alta rapida de empresa debe aceptar RTN vacio'
);
assert.ok(validateEmpresaForm(quickEmpresa).rtn, 'formulario completo conserva RTN obligatorio');

console.log(JSON.stringify({
  ok: true,
  stale_request_ignored: true,
  cancellation_is_silent: true,
  quick_person_optional_fields: true,
  quick_company_optional_rtn: true
}));
