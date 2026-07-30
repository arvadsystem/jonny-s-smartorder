import { useEffect, useMemo, useRef, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import useVentaReversionContext from '../hooks/useVentaReversionContext';
import useVentaReversionPreview from '../hooks/useVentaReversionPreview';
import {
  buildReversionPayload,
  isValidReversionPayload,
  resolveReversionIntent
} from '../utils/ventaReversionFlow';
import { resolveVentasApiErrorMessage } from '../utils/ventasHelpers';
import VentaReversionLines from './VentaReversionLines';
import VentaReversionPreview from './VentaReversionPreview';
import VentaReversionResult from './VentaReversionResult';

const MOTIVOS = [
  ['PRODUCTO_EQUIVOCADO', 'Producto equivocado'],
  ['CANTIDAD_EQUIVOCADA', 'Cantidad equivocada'],
  ['VENTA_DUPLICADA', 'Venta duplicada'],
  ['CLIENTE_CANCELO', 'Cliente canceló'],
  ['METODO_PAGO_EQUIVOCADO', 'Método de pago equivocado'],
  ['ERROR_OPERATIVO', 'Error operativo'],
  ['OTRO', 'Otro']
];

const positiveInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeVenta = (venta) => venta ? {
  ...venta,
  codigo_venta: venta.codigo_venta || venta.numero_venta,
  nombre_sucursal: venta.nombre_sucursal || venta.sucursal || '--'
} : null;

export default function VentaReversionModal({
  open,
  onClose,
  onSuccess,
  getVentaDetail,
  scopeInfo,
  sucursales,
  selectedVenta
}) {
  const [venta, setVenta] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [fecha, setFecha] = useState('');
  const [sucursal, setSucursal] = useState('');
  const [searching, setSearching] = useState(false);
  const [tipo, setTipo] = useState('TOTAL');
  const [motivo, setMotivo] = useState(MOTIVOS[0][0]);
  const [observacion, setObservacion] = useState('');
  const [cantidades, setCantidades] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);
  const intentRef = useRef(null);
  const submitInFlightRef = useRef(false);
  const firstInputRef = useRef(null);

  const idFactura = positiveInt(venta?.id_factura);
  const canSelectSucursal = Boolean(scopeInfo?.canSelectSucursal);
  const userSucursalId = positiveInt(scopeInfo?.userSucursalId);
  const allowedIds = useMemo(
    () => new Set((scopeInfo?.allowedSucursalIds || []).map(positiveInt).filter(Boolean)),
    [scopeInfo?.allowedSucursalIds]
  );
  const selectableSucursales = useMemo(
    () => (sucursales || []).filter((item) => allowedIds.has(positiveInt(item.id_sucursal))),
    [allowedIds, sucursales]
  );

  const { context, loading: contextLoading, error: contextError, reload: reloadContext } =
    useVentaReversionContext({ open, idFactura });
  const items = useMemo(() => (Array.isArray(context?.items) ? context.items : []), [context?.items]);
  const payload = useMemo(
    () => buildReversionPayload({ tipo, motivo, observacion, cantidades, items }),
    [cantidades, items, motivo, observacion, tipo]
  );
  const previewEnabled = Boolean(context?.reversible) && !result;
  const { preview, loading: previewLoading, error: previewError } =
    useVentaReversionPreview({ open, idFactura, payload, enabled: previewEnabled });
  const partialCompletesWholeOriginal = tipo === 'PARCIAL'
    && preview?.estado_acumulado_resultante === 'TOTAL'
    && context?.factura?.estado_reversion === 'NINGUNA';
  const canConfirm = Boolean(
    idFactura
    && context?.reversible
    && preview
    && isValidReversionPayload(payload)
    && !previewLoading
    && !partialCompletesWholeOriginal
    && !saving
    && !result
  );

  useEffect(() => {
    if (!open) return;
    const base = normalizeVenta(selectedVenta);
    setVenta(base);
    setCodigo(base?.codigo_venta || '');
    setFecha(String(base?.fecha_operacion || '').slice(0, 10));
    setSucursal(String(base?.id_sucursal || (!canSelectSucursal ? userSucursalId || '' : '')));
    setTipo('TOTAL');
    setMotivo(MOTIVOS[0][0]);
    setObservacion('');
    setCantidades({});
    setError('');
    setResult(null);
    setConfirmOpen(false);
    intentRef.current = null;
    window.setTimeout(() => firstInputRef.current?.focus(), 0);
  }, [canSelectSucursal, open, selectedVenta, userSucursalId]);

  useEffect(() => {
    if (!open || saving) return undefined;
    const handleKey = (event) => {
      if (event.key !== 'Escape') return;
      if (confirmOpen) setConfirmOpen(false);
      else onClose?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [confirmOpen, onClose, open, saving]);

  const loadVenta = async () => {
    setError('');
    const idSucursal = canSelectSucursal ? positiveInt(sucursal) : userSucursalId;
    if (!codigo.trim() || !fecha || !idSucursal) {
      setError('Completa código, fecha y sucursal para buscar la venta.');
      return;
    }
    setSearching(true);
    try {
      const response = await ventasService.buscarVenta({
        codigo_venta: codigo.trim().toUpperCase(),
        fecha_operacion: fecha,
        id_sucursal: idSucursal
      });
      const foundId = positiveInt(response?.data?.id_factura);
      if (!foundId) throw new Error('Venta no encontrada.');
      const nextVenta = normalizeVenta(await getVentaDetail(foundId));
      const nextFacturaId = positiveInt(nextVenta?.id_factura);
      if (nextFacturaId !== idFactura) {
        intentRef.current = null;
      }
      setConfirmOpen(false);
      setVenta(nextVenta);
      setResult(null);
      setCantidades({});
      setError('');
    } catch (requestError) {
      setVenta(null);
      setError(resolveVentasApiErrorMessage(requestError, 'No se encontró la venta solicitada.'));
    } finally {
      setSearching(false);
    }
  };

  const changeCantidad = (id, rawValue, max) => {
    const raw = String(rawValue ?? '');
    const parsed = Number(raw);
    const valid = /^\d+$/.test(raw) && Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max;
    setCantidades((current) => ({ ...current, [id]: valid ? parsed : '' }));
  };

  const submit = async () => {
    if (!canConfirm || saving || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSaving(true);
    setError('');
    const intent = resolveReversionIntent(intentRef.current, idFactura, payload);
    intentRef.current = intent;
    try {
      const response = await ventasService.createReversion(idFactura, payload, {
        idempotencyKey: intent.key
      });
      const nextResult = response?.data || response;
      setResult(nextResult);
      setConfirmOpen(false);
      const refreshed = await getVentaDetail(idFactura).catch(() => null);
      if (refreshed) setVenta(normalizeVenta(refreshed));
      reloadContext();
      onSuccess?.(nextResult, refreshed);
    } catch (requestError) {
      setConfirmOpen(false);
      setError(resolveVentasApiErrorMessage(requestError, 'No se pudo registrar la reversión.'));
    } finally {
      submitInFlightRef.current = false;
      setSaving(false);
    }
  };

  if (!open) return null;
  const originalSession = context?.sesion_original;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={saving ? undefined : onClose}>
      <section className="ventas-modal ventas-detail-modal" role="dialog" aria-modal="true" aria-labelledby="reversion-title" onClick={(event) => event.stopPropagation()}>
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon"><i className="bi bi-arrow-counterclockwise" /></span>
            <div><h3 id="reversion-title">Registrar reversión</h3><p>Documento compensatorio REV</p></div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={saving} aria-label="Cerrar"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body">
          {!selectedVenta?.id_factura ? (
            <div className="row g-2">
              <div className="col-md-4"><label className="form-label" htmlFor="reversion-codigo">Código de venta</label><input ref={firstInputRef} id="reversion-codigo" className="form-control" value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} /></div>
              <div className="col-md-3"><label className="form-label" htmlFor="reversion-fecha">Fecha de operación</label><input id="reversion-fecha" className="form-control" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} /></div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="reversion-sucursal">Sucursal</label>
                {canSelectSucursal ? (
                  <select id="reversion-sucursal" className="form-select" value={sucursal} onChange={(event) => setSucursal(event.target.value)}>
                    <option value="">Selecciona sucursal</option>
                    {selectableSucursales.map((item) => <option key={item.id_sucursal} value={item.id_sucursal}>{item.nombre_sucursal}</option>)}
                  </select>
                ) : <div className="form-control bg-light">Sucursal operativa</div>}
              </div>
              <div className="col-md-2 d-flex align-items-end"><button type="button" className="btn btn-outline-secondary w-100" onClick={loadVenta} disabled={searching}>{searching ? 'Buscando...' : 'Buscar venta'}</button></div>
            </div>
          ) : null}

          {venta ? <div className="alert alert-light mt-3 mb-0">Venta original: <strong>{venta.codigo_venta}</strong> · Sucursal: <strong>{venta.nombre_sucursal}</strong></div> : null}
          {contextLoading ? <div className="alert alert-info mt-3 mb-0">Verificando disponibilidad de reversión...</div> : null}
          {contextError ? <div className="alert alert-danger mt-3 mb-0">{contextError}</div> : null}
          {context && !context.reversible ? <div className="alert alert-warning mt-3 mb-0">{context.motivo_bloqueo || 'Esta venta no puede reversarse.'}<small className="d-block text-muted">Referencia: {context.code}</small></div> : null}

          {context?.reversible && !result ? (
            <>
              <div className="row g-2 mt-1">
                <div className="col-md-4">
                  <label className="form-label" htmlFor="reversion-tipo">Tipo</label>
                  <select ref={selectedVenta?.id_factura ? firstInputRef : undefined} id="reversion-tipo" className="form-select" value={tipo} onChange={(event) => setTipo(event.target.value)}>
                    <option value="TOTAL">Reversar todo el saldo pendiente</option>
                    <option value="PARCIAL">Reversión parcial</option>
                  </select>
                </div>
                <div className="col-md-4"><label className="form-label" htmlFor="reversion-motivo">Motivo</label><select id="reversion-motivo" className="form-select" value={motivo} onChange={(event) => setMotivo(event.target.value)}>{MOTIVOS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div className="col-md-4"><label className="form-label" htmlFor="reversion-observacion">Observación</label><input id="reversion-observacion" className="form-control" maxLength="300" value={observacion} onChange={(event) => setObservacion(event.target.value)} /></div>
              </div>
              {tipo === 'TOTAL' ? (
                <div className="alert alert-light mt-3 mb-0">Se reversarán las cantidades disponibles determinadas por el servidor. Saldo disponible: <strong>L {Number(context.factura?.total_restante || 0).toFixed(2)}</strong>.</div>
              ) : <VentaReversionLines items={items} cantidades={cantidades} onChange={changeCantidad} disabled={saving} />}
              <VentaReversionPreview preview={preview} loading={previewLoading} error={previewError} />
              {partialCompletesWholeOriginal ? <div className="alert alert-danger mt-2 mb-0">Esta selección representa toda la factura original. Utiliza la opción TOTAL.</div> : null}
            </>
          ) : null}

          <VentaReversionResult open={open} result={result} />
          {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}
        </div>

        <footer className="ventas-reversion-modal__footer">
          <div className="ventas-reversion-modal__footer-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>{result ? 'Cerrar' : 'Cancelar'}</button>
            {!result ? <button type="button" className="btn btn-danger" disabled={!canConfirm} onClick={() => setConfirmOpen(true)}>{saving ? 'Registrando...' : 'Revisar y confirmar'}</button> : null}
          </div>
        </footer>

        {confirmOpen ? (
          <div className="ventas-modal-backdrop" role="presentation" onClick={() => !saving && setConfirmOpen(false)}>
            <section className="ventas-modal ventas-detail-modal" role="alertdialog" aria-modal="true" aria-labelledby="reversion-confirm-title" onClick={(event) => event.stopPropagation()}>
              <header className="ventas-modal__header"><div><h3 id="reversion-confirm-title">Confirmar reversión</h3><p>Esta acción no debe duplicarse.</p></div></header>
              <div className="ventas-modal__body">
                <dl>
                  <div><dt>Venta original</dt><dd>{venta?.codigo_venta}</dd></div>
                  <div><dt>Tipo solicitado</dt><dd>{tipo}</dd></div>
                  <div><dt>Resultado esperado</dt><dd>{preview?.estado_acumulado_resultante}</dd></div>
                  <div><dt>Motivo</dt><dd>{MOTIVOS.find(([value]) => value === motivo)?.[1]}</dd></div>
                  <div><dt>Líneas seleccionadas</dt><dd>{tipo === 'TOTAL' ? 'Todo el saldo pendiente' : payload.lineas?.length}</dd></div>
                  <div><dt>Monto a reversar</dt><dd>L {Number(preview?.total || 0).toFixed(2)}</dd></div>
                  <div><dt>Sesión original</dt><dd>{originalSession?.id_sesion_caja ? `#${originalSession.id_sesion_caja} (${originalSession.estado})` : '--'}</dd></div>
                </dl>
                <div className="alert alert-warning">La reversión afectará Caja, Inventario, Cocina y Fidelización.<br />Esta acción no debe duplicarse.</div>
              </div>
              <footer className="ventas-reversion-modal__footer"><button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>Volver</button><button type="button" className="btn btn-danger" onClick={submit} disabled={saving}>{saving ? 'Registrando...' : 'Confirmar reversión'}</button></footer>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}
