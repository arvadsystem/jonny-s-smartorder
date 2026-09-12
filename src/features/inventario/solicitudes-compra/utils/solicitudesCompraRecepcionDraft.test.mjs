import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const hookSource = (await readFile(new URL('../hooks/useSolicitudCompraRecepcion.js', import.meta.url), 'utf8'))
  .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
  .replace('export default function useSolicitudCompraRecepcion', 'function useSolicitudCompraRecepcion');

const createHookHarness = () => {
  const state = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let evidenceRows = [{ id_evidencia: 1 }, { id_evidencia: 2 }];
  const calls = { evidence: 0, detail: 0, list: 0, upload: 0, remove: 0, receive: 0 };
  const services = {
    getEvidencias: async () => { calls.evidence += 1; return { evidencias: evidenceRows }; },
    subirFactura: async () => { calls.upload += 1; evidenceRows = [...evidenceRows, { id_evidencia: 3 }]; return { ok: true }; },
    reconciliarFactura: async () => ({ ok: true }),
    eliminarEvidencia: async (_, id) => { calls.remove += 1; evidenceRows = evidenceRows.filter((row) => row.id_evidencia !== id); },
    recibirSolicitud: async () => { calls.receive += 1; return { ok: true }; },
    reconciliarRecepcion: async () => ({ ok: true })
  };
  const sandbox = {
    crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' },
    solicitudesCompraService: services,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useCallback: (callback) => callback,
    useMemo: (factory) => factory(),
    useEffect: () => {},
    createReceptionDraft: () => [{ id_solicitud_detalle: 10, tipo_item: 'PRODUCTO', cantidad_aprobada: 10, cantidad_base_aprobada: 10, cantidad_recibida: '10' }],
    updateReceptionDraftLine: (lines, id, amount) => lines.map((line) => line.id_solicitud_detalle === id ? { ...line, cantidad_recibida: amount } : line),
    validateReceptionDraft: () => ({ valid: true }),
    getReceptionDifferences: () => [],
    getReceptionObservationError: () => '',
    validateInvoiceBatch: () => ({ valid: true }),
    prevalidateInvoiceFiles: async () => {},
    uploadInvoiceFilesSequentially: async (files, upload) => { for (const file of files) await upload(file); return { uploaded: files.length, failures: [] }; },
    readFileAsDataUrl: async () => 'data:image/jpeg;base64,/9j/AA==',
    buildInvoiceUploadPayload: () => ({ nombre_original: 'factura.jpg' }),
    uploadInvoiceWithReconciliation: async ({ uploadRequest, idSolicitud, factura, uploadRequestId }) => {
      await uploadRequest(idSolicitud, factura, uploadRequestId);
      return { confirmed: true };
    },
    buildReceptionPayload: ({ observacion, detalles, receptionRequestId }) => ({ observacion, detalles, receptionRequestId }),
    receiveWithReconciliation: async ({ receive, idSolicitud, payload }) => { await receive(idSolicitud, payload); return { confirmed: true }; },
    mapReceptionError: (error) => error.message
  };
  const useHook = runInNewContext(`${hookSource}\nuseSolicitudCompraRecepcion`, sandbox);
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return useHook({
      solicitud: { id_solicitud_compra: 7, estado: 'APROBADA' }, detalles: [], canReceive: true,
      reloadDetail: async () => { calls.detail += 1; },
      reloadList: async () => { calls.list += 1; },
      openToast: () => {}
    });
  };
  return { render, calls, refs };
};

for (const operation of ['upload', 'remove-one', 'remove-all']) {
  test(`${operation} conserva cantidad cero, observacion, confirmacion e id de recepcion`, async () => {
    const harness = createHookHarness();
    let hook = harness.render();
    await hook.loadEvidence();
    hook.updateLine(10, '0');
    hook.setObservation('PRUEBA');
    hook = harness.render();
    hook.startConfirmation();
    hook = harness.render();
    const requestIdBefore = harness.refs.find((ref) => typeof ref.current === 'string')?.current;
    assert.ok(requestIdBefore);
    const evidenceBefore = harness.calls.evidence;

    if (operation === 'upload') await hook.selectInvoices([{ name: 'factura.jpg', type: 'image/jpeg', size: 4 }]);
    if (operation === 'remove-one') await hook.removeEvidence(1);
    if (operation === 'remove-all') await hook.removeAllEvidence();

    hook = harness.render();
    assert.equal(hook.lines[0].cantidad_recibida, '0');
    assert.equal(hook.observation, 'PRUEBA');
    assert.equal(hook.confirmation, true);
    assert.equal(harness.refs.find((ref) => typeof ref.current === 'string')?.current, requestIdBefore);
    assert.equal(harness.calls.evidence, evidenceBefore + 1);
    assert.equal(harness.calls.detail, 0);
    assert.equal(harness.calls.list, 0);
    assert.equal(harness.calls.upload, operation === 'upload' ? 1 : 0);
    assert.equal(harness.calls.remove, operation === 'remove-all' ? 2 : operation === 'remove-one' ? 1 : 0);
  });
}

test('recepcion confirmada recarga detalle y listado', async () => {
  const harness = createHookHarness();
  let hook = harness.render();
  await hook.loadEvidence();
  hook = harness.render();
  await hook.executeReception();
  assert.equal(harness.calls.receive, 1);
  assert.equal(harness.calls.detail, 1);
  assert.equal(harness.calls.list, 1);
});
