import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildPaidSalePayload, buildPedidoPendientePayload } from '../src/modules/ventas/utils/ventasPayloadBuilders.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [modalSource, helpersSource, ticketSource, comandaSource] = await Promise.all([
  readFile(path.join(root, 'src/pages/dashboard/ventas/components/VentaFinalizarOperacionModal.jsx'), 'utf8'),
  readFile(path.join(root, 'src/pages/dashboard/ventas/utils/ventasHelpers.js'), 'utf8'),
  readFile(path.join(root, 'src/pages/dashboard/ventas/components/VentaTicketPrint.jsx'), 'utf8'),
  readFile(path.join(root, 'src/pages/dashboard/ventas/components/ComandaCocina80mm.jsx'), 'utf8')
]);
const state = {
  selectedClient: 'cf',
  paymentMethod: 'efectivo',
  referenciaPago: '',
  temporarySessionId: 8,
  selectedDiscountId: '',
  cart: [{ kind: 'PRODUCTO', cartKey: 'p-1', lineId: 'p-1', id_producto: 1, cantidad: 1 }]
};
const contacto = { nombre_contacto: 'Zohan', telefono_contacto: '9203-8975', dni: null, rtn: null, correo: null };
const contexto = { canal: 'LOCAL', modalidad: 'CONSUMO_LOCAL', observacion_contexto: null };

const paid = buildPaidSalePayload({ state, selectedSucursalId: 2, cashValue: 100, contacto, contexto });
assert.deepEqual(paid.contacto, contacto, 'Pagar ahora debe conservar el snapshot de contacto');
assert.deepEqual(paid.contexto, contexto, 'Pagar ahora debe conservar el contexto');
assert.equal(paid.id_cliente, null, 'Consumidor final no debe crear cliente');

const paidEmpty = buildPaidSalePayload({
  state,
  selectedSucursalId: 2,
  cashValue: 100,
  contacto: { nombre_contacto: null, telefono_contacto: null, dni: null, rtn: null, correo: null },
  contexto
});
assert.equal(paidEmpty.contacto.nombre_contacto, null);
assert.equal(paidEmpty.contacto.telefono_contacto, null);

const registered = buildPaidSalePayload({
  state: { ...state, selectedClient: '44' },
  selectedSucursalId: 2,
  cashValue: 100,
  contacto: { ...contacto, telefono_contacto: '9999-1111' },
  contexto
});
assert.equal(registered.id_cliente, 44, 'Debe conservar id_cliente');
assert.equal(registered.contacto.telefono_contacto, '9999-1111', 'Debe conservar telefono temporal');

const pickup = buildPedidoPendientePayload({
  state,
  selectedSucursalId: 2,
  contacto: { nombre_contacto: null, telefono_contacto: null },
  contexto: { canal: 'LOCAL', modalidad: 'RECOGER' },
  pagoPendiente: { motivo: 'CLIENTE_PAGARA_AL_RETIRAR', observacion_pago: null },
  delivery: null
});
assert.equal(pickup.delivery, null, 'RECOGER no debe reutilizar payload delivery');
assert.equal(pickup.contacto.nombre_contacto, null);
assert.equal(pickup.contacto.telefono_contacto, null);

assert.match(modalSource, /Nombre contacto \(opcional\)/);
assert.match(modalSource, /Telefono \(opcional\)/);
assert.match(modalSource, /Nombre receptor \(opcional\)/);
assert.match(modalSource, /Direccion de entrega \(opcional\)/);
assert.doesNotMatch(modalSource, /es obligatorio para delivery/);
assert.match(modalSource, /parsedCost < 0/, 'Costo negativo debe rechazarse');
assert.match(modalSource, /paidSubmittingRef\.current/, 'Pagar ahora debe bloquear doble envio');
assert.match(modalSource, /pendingSubmittingRef\.current/, 'Pago pendiente debe bloquear doble envio');
assert.match(modalSource, /guardarTelefonoCliente/, 'Guardar telefono maestro debe seguir siendo confirmacion separada');
assert.match(helpersSource, /cliente_nombre: contacto\?\.nombre_contacto \|\| base\.cliente_nombre/,
  'Detalle e historial deben preferir el snapshot de contacto');
assert.match(ticketSource, /Telefono cliente:/, 'Ticket debe mostrar telefono del snapshot');
assert.match(comandaSource, /contacto\?\.telefono_contacto/, 'Comanda debe leer telefono del snapshot');

console.log('QA frontend ventas contacto/entrega: OK');
