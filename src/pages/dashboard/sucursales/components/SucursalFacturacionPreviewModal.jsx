import { createPortal } from 'react-dom';

const formatMoney = (value) =>
  Number(value ?? 0).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SucursalFacturacionPreviewModal({
  open,
  loading = false,
  data = null,
  sucursalNombre = '',
  onClose
}) {
  if (!open) return null;

  const emisor = data?.emisor || {};
  const documento = data?.documento || {};
  const item = Array.isArray(data?.items) ? data.items[0] : null;
  const totales = data?.totales || {};
  const opciones = data?.opciones || {};
  const textos = data?.textos || {};

  return createPortal(
    <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
        <div className="inv-pro-confirm-head">
          <div className="inv-pro-confirm-head-main">
            <div className="inv-pro-confirm-head-icon"><i className="bi bi-eye" /></div>
            <div className="inv-pro-confirm-head-copy">
              <div className="inv-pro-confirm-kicker">Vista previa</div>
              <div className="inv-pro-confirm-title">{sucursalNombre || 'Sucursal'}</div>
              <div className="inv-pro-confirm-sub">Simulación de ticket con configuración actual.</div>
            </div>
          </div>
          <button type="button" className="inv-pro-confirm-close" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </div>

        <div className="inv-pro-confirm-body">
          {loading ? (
            <div className="inv-catpro-loading my-3" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm me-2" />
              Cargando vista previa...
            </div>
          ) : (
            <div className="suc-fac-preview">
              <div className="text-center border-bottom pb-2 mb-2">
                <strong>{emisor.nombre || 'EMISOR'}</strong>
                {opciones.mostrar_rtn && emisor.rtn ? <div>RTN: {emisor.rtn}</div> : null}
                {opciones.mostrar_direccion && emisor.direccion ? <div>{emisor.direccion}</div> : null}
                {opciones.mostrar_telefono && emisor.telefono ? <div>Tel: {emisor.telefono}</div> : null}
                {opciones.mostrar_correo && emisor.correo ? <div>{emisor.correo}</div> : null}
              </div>
              <div className="d-flex justify-content-between small mb-2">
                <span>{documento.tipo || 'TICKET'}</span>
                <span>{documento.numero_ejemplo || 'VTA-00001'}</span>
              </div>
              <div className="small text-muted mb-2">
                <div>CAI: 0</div>
                <div>Numero fiscal: 0</div>
              </div>
              {item ? (
                <div className="small border-bottom pb-2 mb-2">
                  <div className="d-flex justify-content-between">
                    <span>{item.descripcion}</span>
                    <span>{formatMoney(item.total)}</span>
                  </div>
                  <div className="text-muted">Cant: {item.cantidad} x {formatMoney(item.precio_unitario)}</div>
                </div>
              ) : null}
              <div className="small">
                <div className="d-flex justify-content-between"><span>Subtotal</span><span>{formatMoney(totales.subtotal)}</span></div>
                <div className="d-flex justify-content-between"><span>Impuesto</span><span>{formatMoney(totales.impuesto)}</span></div>
                <div className="d-flex justify-content-between"><span>Descuento</span><span>{formatMoney(totales.descuento)}</span></div>
                <div className="d-flex justify-content-between fw-semibold"><span>Total</span><span>{formatMoney(totales.total)}</span></div>
              </div>
              {textos.pie ? <div className="text-center mt-3 small text-muted">{textos.pie}</div> : null}
            </div>
          )}
        </div>

        <div className="inv-pro-confirm-footer">
          <button type="button" className="btn inv-pro-btn-cancel" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
