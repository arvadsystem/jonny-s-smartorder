import { useCallback, useEffect, useMemo, useState } from 'react';
import { sucursalesFacturacionApi } from '../services/sucursalesFacturacionApi';
import SucursalFacturacionConfigDrawer from './SucursalFacturacionConfigDrawer';
import SucursalFacturacionPreviewModal from './SucursalFacturacionPreviewModal';

const normalizeConfig = (config = {}) => ({
  id_config: config?.id_config ?? null,
  id_sucursal: config?.id_sucursal ?? null,
  nombre_emisor: String(config?.nombre_emisor || ''),
  rtn_emisor: String(config?.rtn_emisor || ''),
  direccion_emisor: String(config?.direccion_emisor || ''),
  telefono_emisor: String(config?.telefono_emisor || ''),
  correo_emisor: String(config?.correo_emisor || ''),
  texto_encabezado_ticket: String(config?.texto_encabezado_ticket || ''),
  texto_pie_ticket: String(config?.texto_pie_ticket || ''),
  ancho_ticket_mm: Number(config?.ancho_ticket_mm ?? 80),
  prefijo_venta: String(config?.prefijo_venta || 'VTA'),
  prefijo_reversion: String(config?.prefijo_reversion || 'REV'),
  longitud_correlativo: Number(config?.longitud_correlativo ?? 5),
  reinicio_diario: Boolean(config?.reinicio_diario),
  modo_fiscal: String(config?.modo_fiscal || 'INTERNO'),
  mostrar_logo_ticket: Boolean(config?.mostrar_logo_ticket),
  mostrar_rtn: Boolean(config?.mostrar_rtn),
  mostrar_direccion: Boolean(config?.mostrar_direccion),
  mostrar_telefono: Boolean(config?.mostrar_telefono),
  mostrar_correo: Boolean(config?.mostrar_correo),
  activo: config?.activo !== false,
  actualizado_en: config?.actualizado_en || null
});

const formatDateTime = (value) => {
  if (!value) return 'No disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible';
  return date.toLocaleString('es-HN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const resolveFacturacionErrorMessage = (error) => {
  const status = Number(error?.status ?? 0);
  if (status === 403) return 'No tienes permisos para ver la configuracion de facturacion.';
  if (status === 404) return 'La ruta de configuracion no esta disponible.';
  if (status === 0 || /failed to fetch|fetch error|networkerror/i.test(String(error?.message || ''))) {
    return 'No se pudo conectar con el servidor.';
  }
  return 'No fue posible cargar la configuracion de facturacion.';
};

const presentModoFiscal = (modoFiscalRaw) => {
  const modo = String(modoFiscalRaw || '').trim().toUpperCase();
  if (modo === 'INTERNO') return 'Interno';
  return 'No integrado';
};

export default function SucursalFacturacionTab({
  sucursales = [],
  canConfigurar = false,
  canVerPreview = false,
  onToast
}) {
  const [loading, setLoading] = useState(true);
  const [loadingBySucursal, setLoadingBySucursal] = useState({});
  const [error, setError] = useState('');
  const [configBySucursal, setConfigBySucursal] = useState({});

  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [selectedSucursal, setSelectedSucursal] = useState(null);
  const [configForm, setConfigForm] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewSucursalNombre, setPreviewSucursalNombre] = useState('');

  const sucursalesSorted = useMemo(
    () => [...(Array.isArray(sucursales) ? sucursales : [])].sort((a, b) => Number(a?.id_sucursal ?? 0) - Number(b?.id_sucursal ?? 0)),
    [sucursales]
  );

  const notify = useCallback((title, message, variant = 'info') => {
    if (typeof onToast === 'function') onToast(title, message, variant);
  }, [onToast]);

  const fetchConfigBySucursal = useCallback(async (idSucursal) => {
    const id = Number(idSucursal ?? 0);
    if (!id) return null;
    setLoadingBySucursal((prev) => ({ ...prev, [id]: true }));
    try {
      const config = await sucursalesFacturacionApi.obtenerFacturacionSucursal(id);
      const normalized = normalizeConfig(config || {});
      setConfigBySucursal((prev) => ({ ...prev, [id]: normalized }));
      return normalized;
    } finally {
      setLoadingBySucursal((prev) => ({ ...prev, [id]: false }));
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      setLoading(true);
      setError('');
      try {
        const ids = sucursalesSorted.map((item) => Number(item?.id_sucursal ?? 0)).filter(Boolean);
        const results = await Promise.allSettled(ids.map((id) => fetchConfigBySucursal(id)));
        const failed = results.find((item) => item.status === 'rejected');
        if (!ignore && failed?.reason) {
          const msg = resolveFacturacionErrorMessage(failed.reason);
          setError(msg);
          notify('ERROR', msg, 'danger');
        }
      } catch (err) {
        if (!ignore) {
          const msg = resolveFacturacionErrorMessage(err);
          setError(msg);
          notify('ERROR', msg, 'danger');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    loadAll();
    return () => { ignore = true; };
  }, [fetchConfigBySucursal, notify, sucursalesSorted]);

  const onChangeConfigForm = (field, value) => {
    setConfigForm((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const onOpenConfig = (sucursal) => {
    if (!canConfigurar) return;
    const id = Number(sucursal?.id_sucursal ?? 0);
    if (!id) return;
    const current = configBySucursal[id] || normalizeConfig({ id_sucursal: id });
    setSelectedSucursal(sucursal);
    setConfigForm(current);
    setConfigDrawerOpen(true);
  };

  const onSaveConfig = async (payload) => {
    const id = Number(selectedSucursal?.id_sucursal ?? 0);
    if (!id) return;
    setConfigSaving(true);
    try {
      const updated = await sucursalesFacturacionApi.guardarFacturacionSucursal(id, payload);
      setConfigBySucursal((prev) => ({ ...prev, [id]: normalizeConfig(updated || {}) }));
      setConfigDrawerOpen(false);
      notify('FACTURACION', 'Configuracion de facturacion actualizada correctamente.', 'success');
    } catch (err) {
      const msg = resolveFacturacionErrorMessage(err);
      notify('ERROR', msg, 'danger');
    } finally {
      setConfigSaving(false);
    }
  };

  const onOpenPreview = async (sucursal) => {
    if (!canVerPreview) return;
    const id = Number(sucursal?.id_sucursal ?? 0);
    if (!id) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewSucursalNombre(String(sucursal?.nombre_sucursal || 'Sucursal'));
    try {
      const data = await sucursalesFacturacionApi.obtenerPreviewFacturacionSucursal(id);
      setPreviewData(data || null);
    } catch (err) {
      const msg = resolveFacturacionErrorMessage(err);
      notify('ERROR', msg, 'danger');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="inv-catpro-card inv-prod-card inv-cat-v2 mb-3">
      <div className="inv-catpro-head inv-cat-v2__head">
        <div>
          <h5 className="mb-1">Configuracion de facturacion por sucursal</h5>
          <p className="text-muted mb-0">
            Desde esta seccion se configura como se visualizan los tickets y facturas en cada sucursal.
          </p>
        </div>
      </div>

      <div className="inv-catpro-body inv-prod-body p-3">
        {loading ? (
          <div className="inv-catpro-loading" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm me-2" />
            Cargando configuracion de facturacion...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="alert alert-danger mb-3" role="alert">{error}</div>
        ) : null}

        {!loading && !error && sucursalesSorted.length === 0 ? (
          <div className="alert alert-info mb-0">No hay sucursales disponibles para configurar.</div>
        ) : null}

        {!loading && !error && sucursalesSorted.length > 0 ? (
          <div className="row g-3">
            {sucursalesSorted.map((sucursal) => {
              const id = Number(sucursal?.id_sucursal ?? 0);
              const config = configBySucursal[id] || null;
              const loadingItem = Boolean(loadingBySucursal[id]);
              const isConfigured = Boolean(config?.id_config) && Boolean(config?.activo);

              return (
                <div className="col-12 col-md-6 col-xl-4" key={id}>
                  <article className="card h-100 border-0 shadow-sm">
                    <div className="card-body d-flex flex-column gap-2">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <h6 className="mb-0">{String(sucursal?.nombre_sucursal || 'Sucursal')}</h6>
                        <span className={`badge text-bg-${isConfigured ? 'success' : 'warning'}`}>
                          {isConfigured ? 'Configurada' : 'Pendiente'}
                        </span>
                      </div>

                      {loadingItem ? (
                        <div className="text-muted small">Cargando datos...</div>
                      ) : (
                        <>
                          <div className="small text-muted">Ticket: {config?.ancho_ticket_mm ? `${config.ancho_ticket_mm}mm` : 'Sin definir'}</div>
                          <div className="small text-muted">Prefijo venta: {config?.prefijo_venta || 'Sin definir'}</div>
                          <div className="small text-muted">Modo fiscal: {presentModoFiscal(config?.modo_fiscal)}</div>
                          <div className="small text-muted">Actualizacion: {formatDateTime(config?.actualizado_en)}</div>
                        </>
                      )}

                      <div className="d-flex flex-wrap gap-2 mt-auto">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onOpenConfig(sucursal)} disabled={!canConfigurar || loadingItem}>
                          <i className="bi bi-sliders2 me-1" />
                          Configurar
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onOpenPreview(sucursal)} disabled={!canVerPreview || loadingItem}>
                          <i className="bi bi-eye me-1" />
                          Vista previa
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <SucursalFacturacionConfigDrawer
        open={configDrawerOpen}
        sucursalNombre={selectedSucursal?.nombre_sucursal || ''}
        form={configForm || normalizeConfig()}
        saving={configSaving}
        onClose={() => !configSaving && setConfigDrawerOpen(false)}
        onChange={onChangeConfigForm}
        onSubmit={onSaveConfig}
      />

      <SucursalFacturacionPreviewModal
        open={previewOpen}
        loading={previewLoading}
        data={previewData}
        sucursalNombre={previewSucursalNombre}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
