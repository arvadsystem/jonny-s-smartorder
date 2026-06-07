import { useCallback, useEffect, useMemo, useState } from 'react';
import { sucursalesFacturacionApi } from '../services/sucursalesFacturacionApi';
import SucursalFacturacionConfigDrawer from './SucursalFacturacionConfigDrawer';
import SucursalFacturacionPreviewModal from './SucursalFacturacionPreviewModal';

const TICKET_FLAG_DEFAULTS = {
  mostrar_datos_fiscales: true,
  mostrar_cai_ticket: true,
  mostrar_numero_fiscal_ticket: true,
  mostrar_codigo_interno_ticket: true,
  aplicar_impuestos: false,
  mostrar_impuestos_ticket: false,
  mostrar_importe_exento: false,
  mostrar_importe_gravado_15: false,
  mostrar_isv_15: false,
  mostrar_importe_gravado_18: false,
  mostrar_isv_18: false,
  mostrar_total_isv: false,
  mostrar_descuento_linea: true,
  mostrar_descuento_porcentaje_linea: true,
  mostrar_descuento_total: true,
  imprimir_comprobante_reversion: true,
  mostrar_venta_original_reversion: true,
  mostrar_codigo_reversion: true,
  mostrar_usuario_reversion: true,
  mostrar_caja_sesion_reversion: true,
  mostrar_motivo_reversion: true,
  mostrar_detalle_reversion: true,
  mostrar_total_reversion: true
};
const FACTURACION_LOGO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FACTURACION_LOGO_MAX_BYTES = 10 * 1024 * 1024;

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
  reader.readAsDataURL(file);
});

const getLogoFileError = (file) => {
  if (!file) return 'Selecciona una imagen válida.';
  const mimeType = String(file.type || '').trim().toLowerCase();
  if (!FACTURACION_LOGO_ALLOWED_TYPES.has(mimeType)) {
    return 'Selecciona una imagen válida (JPG, PNG o WEBP).';
  }
  if (Number(file.size || 0) > FACTURACION_LOGO_MAX_BYTES) {
    return 'La imagen supera el límite de 10 MB.';
  }
  return '';
};

const normalizeConfig = (config = {}) => ({
  id_config: config?.id_config ?? null,
  id_sucursal: config?.id_sucursal ?? null,
  nombre_emisor: String(config?.nombre_emisor || ''),
  rtn_emisor: String(config?.rtn_emisor || ''),
  direccion_emisor: String(config?.direccion_emisor || ''),
  telefono_emisor: String(config?.telefono_emisor || ''),
  correo_emisor: String(config?.correo_emisor || ''),
  logo_url: String(config?.logo_url || ''),
  id_archivo_logo: Number(config?.id_archivo_logo ?? 0) || null,
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
  ...Object.entries(TICKET_FLAG_DEFAULTS).reduce((acc, [field, fallback]) => ({
    ...acc,
    [field]: config?.[field] === undefined || config?.[field] === null
      ? fallback
      : Boolean(config[field])
  }), {}),
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
  if (status === 403) return 'No tienes permisos para ver la configuración de facturación.';
  if (status === 404) return 'La ruta de configuración no está disponible.';
  if (status === 0 || /failed to fetch|fetch error|networkerror/i.test(String(error?.message || ''))) {
    return 'No se pudo conectar con el servidor.';
  }
  return 'No fue posible cargar la configuración de facturación.';
};

const presentModoFiscal = (modoFiscalRaw) => {
  const modo = String(modoFiscalRaw || '').trim().toUpperCase();
  if (modo === 'INTERNO') return 'Interno';
  return 'No integrado';
};

const resolveSucursalImage = (sucursal) => String(
  sucursal?.imagen_url_publica ||
  sucursal?.url_publica ||
  sucursal?.url_imagen ||
  ''
).trim();

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
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [pendingLogoArchivoId, setPendingLogoArchivoId] = useState(null);

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

  const cleanupLogoArchivo = useCallback(async (idArchivo) => {
    const id = Number(idArchivo || 0);
    if (!id) return;
    try {
      await sucursalesFacturacionApi.eliminarArchivo(id);
    } catch {
      // La limpieza puede quedar bloqueada si el archivo ya fue vinculado.
    }
  }, []);

  const loadLogoPreview = useCallback(async (idArchivo) => {
    const id = Number(idArchivo || 0);
    setLogoPreviewUrl('');
    if (!id) return;
    try {
      const response = await sucursalesFacturacionApi.obtenerUrlArchivo(id);
      setLogoPreviewUrl(String(response?.url || ''));
    } catch {
      setLogoPreviewUrl('');
    }
  }, []);

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
    setLogoError('');
    setPendingLogoArchivoId(null);
    void loadLogoPreview(current?.id_archivo_logo);
    setConfigDrawerOpen(true);
  };

  const onCloseConfig = () => {
    if (configSaving || logoUploading) return;
    const pendingId = pendingLogoArchivoId;
    setPendingLogoArchivoId(null);
    setLogoPreviewUrl('');
    setLogoError('');
    setConfigDrawerOpen(false);
    if (pendingId) void cleanupLogoArchivo(pendingId);
  };

  const onLogoFileChange = async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    const fileError = getLogoFileError(file);
    if (fileError) {
      setLogoError(fileError);
      return;
    }

    setLogoUploading(true);
    setLogoError('');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await sucursalesFacturacionApi.subirLogoFacturacion({
        data_url: dataUrl,
        mime_type: file.type,
        nombre_original: file.name
      });
      const archivoId = Number(response?.id_archivo ?? 0) || null;
      if (!archivoId) throw new Error('No se pudo registrar la imagen.');

      const previousPendingId = pendingLogoArchivoId;
      setPendingLogoArchivoId(archivoId);
      setConfigForm((prev) => ({
        ...(prev || {}),
        id_archivo_logo: archivoId,
        logo_url: String(response?.storage_path || '')
      }));
      setLogoPreviewUrl(dataUrl);
      if (previousPendingId) void cleanupLogoArchivo(previousPendingId);
    } catch (err) {
      setLogoError(err?.message || 'No se pudo subir la imagen.');
    } finally {
      setLogoUploading(false);
    }
  };

  const onLogoRemove = () => {
    const pendingId = pendingLogoArchivoId;
    setPendingLogoArchivoId(null);
    setLogoPreviewUrl('');
    setLogoError('');
    setConfigForm((prev) => ({
      ...(prev || {}),
      id_archivo_logo: null,
      logo_url: ''
    }));
    if (pendingId) void cleanupLogoArchivo(pendingId);
  };

  const onSaveConfig = async (payload) => {
    const id = Number(selectedSucursal?.id_sucursal ?? 0);
    if (!id) return;
    setConfigSaving(true);
    try {
      const updated = await sucursalesFacturacionApi.guardarFacturacionSucursal(id, payload);
      setConfigBySucursal((prev) => ({ ...prev, [id]: normalizeConfig(updated || {}) }));
      setPendingLogoArchivoId(null);
      setConfigDrawerOpen(false);
      notify('FACTURACIÓN', 'Configuración de facturación actualizada correctamente.', 'success');
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
          <h5 className="mb-1">Configuración de facturación por sucursal</h5>
          <p className="text-muted mb-0">
            Desde esta sección se configura cómo se visualizan los tickets y facturas en cada sucursal.
          </p>
        </div>
      </div>

      <div className="inv-catpro-body inv-prod-body p-3">
        {loading ? (
          <div className="inv-catpro-loading" role="status" aria-live="polite">
            <span className="spinner-border spinner-border-sm me-2" />
            Cargando configuración de facturación...
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
              const dotClass = loadingItem ? 'is-low' : isConfigured ? 'is-ok' : 'is-empty';
              const imageUrl = resolveSucursalImage(sucursal);
              const cardTitle = String(sucursal?.nombre_sucursal || 'Sucursal');

              return (
                <div className="col-12 col-md-6 col-xl-4 suc-facturacion-card-col" key={id}>
                  <article
                    className={`inv-prod-catalog-card suc-card suc-fact-card inv-anim-in ${dotClass}`}
                    style={{ animationDelay: `${Math.min(id * 24, 220)}ms` }}
                  >
                    <div className="inv-prod-thumb-wrap suc-card__thumb-wrap suc-fact-card__thumb-wrap">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={cardTitle}
                          className="inv-prod-thumb suc-card__thumb-img"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="inv-prod-thumb placeholder suc-card__thumb-placeholder suc-fact-card__thumb-placeholder">
                          <i className="bi bi-receipt-cutoff" />
                          <span>Facturacion</span>
                        </div>
                      )}
                      <span className={`inv-prod-card-state ${dotClass}`}>
                        {loadingItem ? 'CARGANDO' : isConfigured ? 'CONFIGURADA' : 'PENDIENTE'}
                      </span>
                    </div>

                    <div className="inv-prod-card-body suc-card__body suc-fact-card__body">
                      <div className="inv-prod-card-bg-icon suc-card__bg-icon" aria-hidden="true">
                        <i className="bi bi-receipt" />
                      </div>

                      <div className="inv-prod-card-name">{cardTitle}</div>
                      <div className="inv-prod-card-category">
                        {config?.nombre_emisor || 'Sin emisor configurado'}
                      </div>

                      <div className="inv-prod-card-metrics suc-card__meta">
                        <div>
                          <div className="inv-prod-card-label">Ticket</div>
                          <div className="inv-prod-card-value">{config?.ancho_ticket_mm ? `${config.ancho_ticket_mm}mm` : 'Sin definir'}</div>
                        </div>
                        <div>
                          <div className="inv-prod-card-label">Prefijo</div>
                          <div className="inv-prod-card-value suc-card__truncate">{config?.prefijo_venta || 'Sin definir'}</div>
                        </div>
                      </div>

                      <div className="inv-prod-stock-line suc-card__footer-line">
                        <div className="inv-prod-stock-meta">
                          <div className="inv-prod-stock-ring" style={{ '--stock-ratio': isConfigured ? 0.85 : 0.35 }} />
                          <div className="inv-prod-stock-copy">
                            <span>{loadingItem ? 'Cargando datos...' : `Modo fiscal: ${presentModoFiscal(config?.modo_fiscal)}`}</span>
                          </div>
                        </div>
                      </div>

                      <div className="suc-card__row suc-fact-card__row">
                        <i className="bi bi-clock-history" />
                        <span>Actualizacion: {formatDateTime(config?.actualizado_en)}</span>
                      </div>

                      <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions suc-card__actions">
                        <button
                          type="button"
                          className="btn inv-prod-card-action inv-prod-card-action-compact"
                          onClick={() => onOpenConfig(sucursal)}
                          title="Configurar"
                          disabled={!canConfigurar || loadingItem}
                          aria-label={`Configurar facturación de ${cardTitle}`}
                        >
                          <i className="bi bi-sliders2" />
                          <span className="inv-prod-card-action-label">Configurar</span>
                        </button>
                        <button
                          type="button"
                          className="btn inv-prod-card-action inv-prod-card-action-compact"
                          onClick={() => onOpenPreview(sucursal)}
                          title="Vista previa"
                          disabled={!canVerPreview || loadingItem}
                          aria-label={`Ver vista previa de facturación de ${cardTitle}`}
                        >
                          <i className="bi bi-eye" />
                          <span className="inv-prod-card-action-label">Vista previa</span>
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
        logoPreviewUrl={logoPreviewUrl}
        logoUploading={logoUploading}
        logoError={logoError}
        onLogoFileChange={onLogoFileChange}
        onLogoRemove={onLogoRemove}
        onClose={onCloseConfig}
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
