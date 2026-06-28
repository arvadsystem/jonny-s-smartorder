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
  const fiscal = data?.fiscal || {};
  const showFiscal = opciones.mostrar_datos_fiscales !== false;
  const showCai = showFiscal && Boolean(fiscal?.habilitado) && opciones.mostrar_cai_ticket && fiscal?.cai;
  const showNumeroFiscal = showFiscal
    && Boolean(fiscal?.habilitado)
    && opciones.mostrar_numero_fiscal_ticket
    && fiscal?.numero_factura_fiscal;
  const showInternalCode = opciones.mostrar_codigo_interno_ticket !== false;
  const showFiscalBlock = Boolean(showCai || showNumeroFiscal || showInternalCode);
  const showTaxes = Boolean(opciones.mostrar_impuestos_ticket);

  return createPortal(
    <>
      <div
        className="inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop show"
        role="presentation"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="inv-prod-drawer inv-cat-v2__drawer suc-filters-drawer suc-facturacion-drawer suc-facturacion-preview-drawer show"
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        <div className="inv-prod-drawer-head">
          <i className="bi bi-eye inv-cat-v2__drawer-mark" aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">Vista previa</div>
            <div className="inv-prod-drawer-sub">{sucursalNombre || 'Sucursal'}</div>
          </div>
          <button type="button" className="inv-prod-drawer-close" onClick={onClose} title="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="inv-prod-drawer-body inv-cat-v2__drawer-body suc-facturacion-drawer__body">
          {loading ? (
            <div className="inv-catpro-loading my-3" role="status" aria-live="polite">
              <span className="spinner-border spinner-border-sm me-2" />
              Cargando vista previa...
            </div>
          ) : (
            <div className="suc-fac-preview">
              <div className="text-center border-bottom pb-2 mb-2">
                {opciones.mostrar_logo_ticket && emisor.logo_url ? (
                  <img className="suc-fac-preview__logo" src={emisor.logo_url} alt="Logo de facturacion" />
                ) : null}
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
              {showFiscalBlock ? (
                <div className="small text-muted mb-2">
                  {showCai ? <div>CAI: {fiscal.cai}</div> : null}
                  {showNumeroFiscal ? <div>Numero fiscal: {fiscal.numero_factura_fiscal}</div> : null}
                  {showInternalCode ? <div>Codigo interno: {documento.numero_ejemplo || 'VTA-00001'}</div> : null}
                </div>
              ) : null}
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
                {showTaxes ? <div className="d-flex justify-content-between"><span>Impuesto</span><span>{formatMoney(totales.impuesto)}</span></div> : null}
                {opciones.mostrar_descuento_total !== false ? <div className="d-flex justify-content-between"><span>Descuento</span><span>{formatMoney(totales.descuento)}</span></div> : null}
                <div className="d-flex justify-content-between fw-semibold"><span>Total</span><span>{formatMoney(totales.total)}</span></div>
              </div>
              {textos.pie ? <div className="text-center mt-3 small text-muted">{textos.pie}</div> : null}
            </div>
          )}
        </div>

        <div className="inv-prod-drawer-actions inv-cat-v2__drawer-actions suc-facturacion-drawer__actions suc-facturacion-preview-drawer__actions">
          <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose}>Cerrar</button>
        </div>
      </aside>
    </>,
    document.body
  );
}
