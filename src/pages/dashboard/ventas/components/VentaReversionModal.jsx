import { useEffect, useMemo, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import VentaReversionTicketPrint from './VentaReversionTicketPrint';
import './VentaReversionTicketPrint.css';

const MOTIVOS = [
  { code: 'PRODUCTO_EQUIVOCADO', label: 'Producto equivocado' },
  { code: 'CANTIDAD_EQUIVOCADA', label: 'Cantidad equivocada' },
  { code: 'VENTA_DUPLICADA', label: 'Venta duplicada' },
  { code: 'CLIENTE_CANCELO', label: 'Cliente canceló' },
  { code: 'METODO_PAGO_EQUIVOCADO', label: 'Método de pago equivocado' },
  { code: 'ERROR_OPERATIVO', label: 'Error operativo' },
  { code: 'OTRO', label: 'Otro' }
];

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `L ${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
};

const normalizeVentaHeader = (rawVenta) => {
  if (!rawVenta || typeof rawVenta !== 'object') return null;
  return {
    ...rawVenta,
    numero_venta: rawVenta.numero_venta || rawVenta.codigo_venta || null,
    cliente_nombre: rawVenta.cliente_nombre || rawVenta.cliente || 'Consumidor final',
    nombre_sucursal: rawVenta.nombre_sucursal || rawVenta.sucursal || '--',
    items: Array.isArray(rawVenta.items) ? rawVenta.items : []
  };
};

export default function VentaReversionModal({
  open,
  onClose,
  onSuccess,
  getVentaDetail,
  scopeInfo,
  sucursales,
  selectedVenta
}) {
  const [codigoVentaInput, setCodigoVentaInput] = useState('');
  const [fechaOperacionInput, setFechaOperacionInput] = useState('');
  const [idSucursalInput, setIdSucursalInput] = useState('');
  const [loadingVenta, setLoadingVenta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [venta, setVenta] = useState(null);
  const [tipoReversion, setTipoReversion] = useState('TOTAL');
  const [motivo, setMotivo] = useState(MOTIVOS[0].code);
  const [observacion, setObservacion] = useState('');
  const [lineQty, setLineQty] = useState({});
  const [reversionResult, setReversionResult] = useState(null);
  const [ticketWidthMm, setTicketWidthMm] = useState(80);
  const [showTicketPreview, setShowTicketPreview] = useState(false);

  const isFromDetail = Boolean(selectedVenta?.id_factura);
  const canSelectSucursal = Boolean(scopeInfo?.canSelectSucursal);
  const userSucursalId = toPositiveInt(scopeInfo?.userSucursalId);
  const allowedSucursalIds = useMemo(
    () => (Array.isArray(scopeInfo?.allowedSucursalIds)
      ? scopeInfo.allowedSucursalIds.map((id) => toPositiveInt(id)).filter(Boolean)
      : []),
    [scopeInfo?.allowedSucursalIds]
  );

  const selectableSucursales = useMemo(() => {
    const allowed = new Set(allowedSucursalIds);
    return (Array.isArray(sucursales) ? sucursales : [])
      .filter((row) => allowed.has(toPositiveInt(row?.id_sucursal)))
      .sort((a, b) =>
        String(a?.nombre_sucursal || '').localeCompare(String(b?.nombre_sucursal || ''), 'es', {
          sensitivity: 'base'
        })
      );
  }, [allowedSucursalIds, sucursales]);
  const userSucursalLabel = useMemo(() => {
    const fromCatalog = selectableSucursales.find(
      (row) => Number(row.id_sucursal) === Number(userSucursalId)
    );
    if (fromCatalog?.nombre_sucursal) return fromCatalog.nombre_sucursal;
    if (userSucursalId) return `Sucursal #${userSucursalId}`;
    return null;
  }, [selectableSucursales, userSucursalId]);

  const items = useMemo(() => (Array.isArray(venta?.items) ? venta.items : []), [venta]);
  const partialMetrics = useMemo(() => {
    const pendingLines = items
      .map((item) => Number.parseInt(String(item?.cantidad ?? 0), 10))
      .filter((qty) => Number.isInteger(qty) && qty > 0);
    const hasMultiplePendingLines = pendingLines.length > 1;
    const hasPendingQtyGreaterThanOne = pendingLines.some((qty) => qty > 1);
    return {
      partialApplies: hasMultiplePendingLines || hasPendingQtyGreaterThanOne
    };
  }, [items]);

  useEffect(() => {
    if (!open) return;

    setError('');
    setReversionResult(null);
    setShowTicketPreview(false);
    setTipoReversion('TOTAL');
    setMotivo(MOTIVOS[0].code);
    setObservacion('');
    setLineQty({});
    setTicketWidthMm(80);

    if (isFromDetail) {
      const baseVenta = normalizeVentaHeader(selectedVenta);
      setVenta(baseVenta);
      setCodigoVentaInput(baseVenta?.codigo_venta || '');
      setFechaOperacionInput(String(baseVenta?.fecha_operacion || '').slice(0, 10));
      setIdSucursalInput(String(baseVenta?.id_sucursal || userSucursalId || ''));

      const initialQty = {};
      (Array.isArray(baseVenta?.items) ? baseVenta.items : []).forEach((item) => {
        const detailId = Number(item.id_detalle || 0);
        if (detailId > 0) initialQty[detailId] = 0;
      });
      setLineQty(initialQty);
      return;
    }

    setVenta(null);
    setCodigoVentaInput('');
    setFechaOperacionInput('');
    setIdSucursalInput(canSelectSucursal ? '' : String(userSucursalId || ''));
  }, [open, isFromDetail, selectedVenta, canSelectSucursal, userSucursalId]);

  if (!open) return null;

  const close = () => {
    setError('');
    setVenta(null);
    setCodigoVentaInput('');
    setFechaOperacionInput('');
    setIdSucursalInput('');
    setTipoReversion('TOTAL');
    setMotivo(MOTIVOS[0].code);
    setObservacion('');
    setLineQty({});
    setReversionResult(null);
    setTicketWidthMm(80);
    setShowTicketPreview(false);
    onClose?.();
  };

  const loadVentaByCriteria = async () => {
    setError('');
    setReversionResult(null);
    setShowTicketPreview(false);

    const codigoVenta = String(codigoVentaInput || '').trim().toUpperCase();
    const fechaOperacion = String(fechaOperacionInput || '').trim();
    const idSucursalResolved = canSelectSucursal
      ? toPositiveInt(idSucursalInput)
      : userSucursalId;

    if (!codigoVenta) {
      setError('Ingresa el código de venta.');
      return;
    }
    if (!fechaOperacion) {
      setError('Selecciona la fecha de operación.');
      return;
    }
    if (!idSucursalResolved) {
      setError(canSelectSucursal ? 'Selecciona la sucursal.' : 'No se pudo determinar tu sucursal asignada.');
      return;
    }

    setLoadingVenta(true);
    try {
      const response = await ventasService.buscarVenta({
        codigo_venta: codigoVenta,
        fecha_operacion: fechaOperacion,
        id_sucursal: idSucursalResolved
      });
      const found = response?.data || null;
      const idFactura = Number(found?.id_factura || 0);
      if (!idFactura) {
        throw new Error('No se encontró una venta con ese código, fecha y sucursal.');
      }
      const detail = await getVentaDetail(idFactura);
      const normalized = normalizeVentaHeader(detail);
      setVenta(normalized);
      const initialQty = {};
      (Array.isArray(normalized?.items) ? normalized.items : []).forEach((item) => {
        const detailId = Number(item.id_detalle || 0);
        if (detailId > 0) initialQty[detailId] = 0;
      });
      setLineQty(initialQty);
    } catch (err) {
      setVenta(null);
      setError(err?.message || 'No se encontró una venta con ese código, fecha y sucursal.');
    } finally {
      setLoadingVenta(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    const idFactura = Number(venta?.id_factura || 0);
    if (!idFactura) {
      setError('Primero debes seleccionar una venta válida.');
      return;
    }

    const payload = {
      tipo_reversion: tipoReversion,
      motivo,
      observacion: observacion.trim()
    };

    if (tipoReversion === 'PARCIAL') {
      if (!partialMetrics.partialApplies) {
        setError('Esta venta solo tiene una unidad pendiente. Usa reversión total.');
        return;
      }
      const lineas = items
        .map((item) => {
          const idDetalle = Number(item.id_detalle || 0);
          const qty = Number.parseInt(String(lineQty[idDetalle] ?? 0), 10);
          return idDetalle > 0 && Number.isInteger(qty) && qty > 0
            ? { id_detalle_factura: idDetalle, cantidad: qty }
            : null;
        })
        .filter(Boolean);

      if (!lineas.length) {
        setError('Selecciona al menos una línea con cantidad para reversión parcial.');
        return;
      }

      payload.lineas = lineas;
    }

    setSaving(true);
    try {
      const response = await ventasService.createReversion(idFactura, payload);
      const result = response?.data || response;
      setReversionResult(result);
      setShowTicketPreview(true);
      onSuccess?.(result);
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la reversión.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrintTicket = () => {
    if (typeof window === 'undefined' || !reversionResult) return;

    document.body.classList.add('venta-reversion-ticket-printing');
    const cleanup = () => {
      document.body.classList.remove('venta-reversion-ticket-printing');
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 1200);
    });
  };

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={close}>
      <section
        className="ventas-modal ventas-detail-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-arrow-counterclockwise" />
            </span>
            <div>
              <h3>Registrar reversión</h3>
              <p>Documento compensatorio REV</p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={close} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-modal__body ventas-detail-modal__body">
          {!isFromDetail ? (
            <div className="row g-2">
              <div className="col-md-4">
                <label className="form-label">Código de venta</label>
                <input
                  className="form-control"
                  value={codigoVentaInput}
                  onChange={(event) => setCodigoVentaInput(event.target.value.toUpperCase())}
                  placeholder="Ej: VTA-00001"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Fecha de operación</label>
                <input
                  className="form-control"
                  type="date"
                  value={fechaOperacionInput}
                  onChange={(event) => setFechaOperacionInput(event.target.value)}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Sucursal</label>
                {canSelectSucursal ? (
                  <select
                    className="form-select"
                    value={idSucursalInput}
                    onChange={(event) => setIdSucursalInput(event.target.value)}
                  >
                    <option value="">Selecciona sucursal</option>
                    {selectableSucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={String(sucursal.id_sucursal)}>
                        {sucursal.nombre_sucursal}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="ventas-summary__static-field">
                    {userSucursalLabel || 'No se pudo determinar tu sucursal asignada.'}
                  </div>
                )}
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary w-100"
                  onClick={loadVentaByCriteria}
                  disabled={loadingVenta}
                >
                  {loadingVenta ? 'Buscando...' : 'Buscar venta'}
                </button>
              </div>
            </div>
          ) : null}

          {venta ? (
            <div className="alert alert-light mt-3 mb-2">
              Venta: <strong>{venta.numero_venta || venta.codigo_venta}</strong> | Fecha: <strong>{String(venta.fecha_operacion || '').slice(0, 10) || '--'}</strong> | Sucursal: <strong>{venta.nombre_sucursal || '--'}</strong>
              <br />
              Cliente: <strong>{venta.cliente_nombre || 'Consumidor final'}</strong> | Total: <strong>{formatCurrency(venta.total)}</strong>
            </div>
          ) : null}

          <div className="row g-2 mt-1">
            <div className="col-md-4">
              <label className="form-label">Tipo</label>
              <select className="form-select" value={tipoReversion} onChange={(e) => setTipoReversion(e.target.value)}>
                <option value="TOTAL">TOTAL</option>
                <option value="PARCIAL" disabled={venta && !partialMetrics.partialApplies}>PARCIAL</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Motivo</label>
              <select className="form-select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                {MOTIVOS.map((item) => (
                  <option key={item.code} value={item.code}>{item.label}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Observación</label>
              <input className="form-control" value={observacion} onChange={(e) => setObservacion(e.target.value)} maxLength={300} />
            </div>
          </div>

          {venta && !partialMetrics.partialApplies ? (
            <div className="alert alert-warning mt-3 mb-0">
              Esta venta solo tiene una unidad pendiente. Usa reversión total.
            </div>
          ) : null}

          {venta && tipoReversion === 'PARCIAL' && partialMetrics.partialApplies ? (
            <div className="table-responsive mt-3">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Detalle</th>
                    <th>Item</th>
                    <th>Cantidad vendida</th>
                    <th>Cantidad a reversar</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const idDetalle = Number(item.id_detalle || 0);
                    return (
                      <tr key={`${idDetalle || index}`}>
                        <td>{idDetalle || '-'}</td>
                        <td>{item.nombre_item || item.nombre_producto || 'Item'}</td>
                        <td>{item.cantidad || 0}</td>
                        <td>
                          <input
                            className="form-control form-control-sm"
                            type="number"
                            min="1"
                            max={item.cantidad || 0}
                            step="1"
                            value={lineQty[idDetalle] ?? ''}
                            onChange={(e) => {
                              const maxQty = Number(item.cantidad || 0);
                              const parsed = Number.parseInt(String(e.target.value ?? ''), 10);
                              const next = Number.isInteger(parsed) && parsed > 0
                                ? Math.min(parsed, maxQty)
                                : 0;
                              setLineQty((prev) => ({ ...prev, [idDetalle]: next }));
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {reversionResult ? (
            <div className="alert alert-success mt-3 mb-0">
              <div>
                Reversión registrada: <strong>{reversionResult.codigo_reversion}</strong> sobre{' '}
                <strong>{reversionResult.codigo_venta || `VTA-${String(reversionResult.id_factura_original || '').padStart(5, '0')}`}</strong>.
              </div>
              <div>
                Monto reversado: <strong>L {Number(reversionResult.monto_reversado || 0).toFixed(2)}</strong>
              </div>
            </div>
          ) : null}

          {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}
        </div>

        <footer className="ventas-reversion-modal__footer">
          <div className="ventas-reversion-modal__footer-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={close} disabled={saving}>
              Cancelar
            </button>

            {reversionResult ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowTicketPreview((prev) => !prev)}
                >
                  {showTicketPreview ? 'Ocultar comprobante REV' : 'Ver comprobante REV'}
                </button>
                <select
                  className="form-select form-select-sm"
                  value={ticketWidthMm}
                  onChange={(event) => setTicketWidthMm(Number(event.target.value) === 58 ? 58 : 80)}
                  aria-label="Ancho de comprobante de reversión"
                  style={{ maxWidth: 110 }}
                >
                  <option value={80}>80mm</option>
                  <option value={58}>58mm</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={handlePrintTicket}>
                  <i className="bi bi-printer" /> Imprimir comprobante REV
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleSubmit}
                disabled={saving || !venta}
              >
                {saving ? 'Registrando...' : 'Registrar reversión'}
              </button>
            )}
          </div>
        </footer>

        {reversionResult ? (
          <VentaReversionTicketPrint
            reversion={reversionResult}
            venta={venta}
            paperWidth={ticketWidthMm}
            preview={showTicketPreview}
          />
        ) : null}
      </section>
    </div>
  );
}

