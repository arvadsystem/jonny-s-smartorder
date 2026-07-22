import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SinPermiso from '../../../components/common/SinPermiso';
import { usePermisos } from '../../../context/PermisosContext';
import { useAuth } from '../../../hooks/useAuth';
import { normalizeCierresCajaTab } from '../../../utils/cierresCajaRouting';
import CajaView from './components/CajaView';
import DescuentosView from './components/DescuentosView';
import PedidosView from './components/PedidosView';
import VentaDetalleModal from './components/VentaDetalleModal';
import EnviarComandaCocinaModal from './components/EnviarComandaCocinaModal';
import VentaOverviewView from './components/VentaOverviewView';
import VentaReversionModal from './components/VentaReversionModal';
import VentasToast from './components/VentasToast';
import { useVentas } from './hooks/useVentas';
import { normalizeVentaDetail } from './utils/ventasHelpers';
import ventasService from '../../../services/ventasService';
import printerDeviceDetectionService from '../../../services/printerDeviceDetectionService';
import { isAgentPrintMode } from '../../../services/printModeService';
import {
  openPrintWindow,
  printComandaCocinaInWindow,
  printComandaCocinaWithQz,
  printVentaTicketPdf,
  printVentaTicketWithQz
} from './utils/ventaPrintUtils';
import { validateComandaForPrint } from './utils/buildComandaCocinaHtml';
import {
  createClosedComandaPrompt,
  createComandaPrompt,
  enqueueAgentPrintAction,
  getSafePrintErrorContext,
  prepareComandaPrintWindow
} from './utils/ventasPrintActions';
import {
  getAllowedTabs,
  MODULE_PRIMARY_PERMISSION,
  PERMISSIONS,
  normalizeRoles,
  resolveVentasStatsVisibility
} from '../../../utils/permissions';
import './styles/ventas.css';

const VENTAS_TABS = new Set(['ventas', 'caja', 'pedidos', 'descuentos']);

const hasCreateVentaDetailPayload = (response) =>
  response?.ticket_ready === true &&
  Number(response?.id_factura || 0) > 0 &&
  Array.isArray(response?.items) &&
  response.items.length > 0;

const QZ_PRINT_MODES = new Set(['QZ_HTML', 'QZ_RAW']);
const AGENT_PRINT_MODE = isAgentPrintMode();

const resolvePrinterByType = (configPayload, printerType) =>
  (Array.isArray(configPayload?.impresoras) ? configPayload.impresoras : [])
    .find((item) => String(item?.tipo_impresora || '').trim().toUpperCase() === String(printerType || '').trim().toUpperCase()) || null;

const isQzMode = (printerConfig) =>
  QZ_PRINT_MODES.has(String(printerConfig?.modo_impresion || '').trim().toUpperCase());

const resolvePrintWidthMm = (...values) =>
  values.some((value) => Number(value) === 58) ? 58 : 80;

export default function VentasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAny, isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();
  const requestedVentasTab = String(
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') || '' : ''
  ).trim().toLowerCase();
  const {
    ventas,
    summary,
    pagination,
    scopeInfo,
    ventasFilters,
    ventasCurrentDay,
    sucursales,
    categorias,
    productos,
    recetas,
    descuentosCatalogo,
    tiposDepartamento,
    clientes,
    clientesMeta,
    loading,
    catalogLoading,
    bootstrapLoading,
    recipesLoading,
    productsLoading,
    clientsLoading,
    discountsLoading,
    catalogStatuses,
    cajaBootstrapData,
    recipeCatalogState,
    saving,
    detailLoading,
    error,
    catalogErrors,
    toast,
    openToast,
    closeToast,
    setVentasSearch,
    setVentasPage,
    setVentasPageSize,
    setVentasFilterPatch,
    clearVentasFilters,
    createVenta,
    createPedidoPendiente,
    registrarPagoPedido,
    getVentaDetail,
    refreshVentas,
    loadCajaBootstrap,
    loadCajaCatalog,
    loadCajaRecipesDepartment,
    refreshClientesCatalog,
    upsertClienteCatalog
  } = useVentas({
    activeTab: requestedVentasTab,
    initialSucursalId: user?.id_sucursal,
    isSuperAdmin,
    userId: user?.id_usuario
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [detailOpen, setDetailOpen] = useState(false);
  const [reversionOpen, setReversionOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [selectedVentaReversion, setSelectedVentaReversion] = useState(null);
  const [comandaPrompt, setComandaPrompt] = useState(createClosedComandaPrompt);
  const detailRequestRef = useRef(0);
  const printerConfigCacheRef = useRef(new Map());

  const isCajeroOnly = useMemo(() => {
    const roles = normalizeRoles(user?.roles);
    const hasAdminRole = roles.some((role) =>
      ['ADMIN', 'ADMINISTRADOR', 'SUPER_ADMIN'].includes(role)
    );
    return roles.includes('CAJERO') && !isSuperAdmin && !hasAdminRole;
  }, [isSuperAdmin, user?.roles]);
  const allowedTabs = useMemo(() => {
    const tabs = getAllowedTabs('ventas', permisos, { isSuperAdmin }).map((tab) => tab.key);
    return isCajeroOnly ? tabs.filter((tab) => tab !== 'descuentos') : tabs;
  }, [isCajeroOnly, isSuperAdmin, permisos]);
  const fallbackTab = allowedTabs[0] || null;
  const canCreateVenta = canAny([PERMISSIONS.VENTAS_CREAR]);
  const canApplyDiscount = canAny([PERMISSIONS.VENTAS_DESCUENTO_APLICAR]);
  const canExportVenta = canAny([PERMISSIONS.VENTAS_EXPORTAR]);
  const canPrintVenta = canAny([PERMISSIONS.VENTAS_IMPRIMIR]);
  const canViewDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_VER]);
  const canManageReversionByRole = useMemo(() => {
    const roles = normalizeRoles(user?.roles);
    return isSuperAdmin || roles.some((role) =>
      ['ADMIN', 'ADMINISTRADOR', 'SUPER_ADMIN'].includes(role)
    );
  }, [isSuperAdmin, user?.roles]);
  const canCreateReversion = canManageReversionByRole && canAny(['VENTAS_REVERSION_CREAR']);
  const canCreateDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_CREAR]);
  const canEditDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_EDITAR]);
  const canToggleDescuentos = canAny([PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_ESTADO_CAMBIAR]);
  const userSucursalId = Number.parseInt(
    String(scopeInfo?.userSucursalId ?? user?.id_sucursal ?? ''),
    10
  );
  const statsVisibility = useMemo(
    () => resolveVentasStatsVisibility(user?.roles, { isSuperAdmin }),
    [isSuperAdmin, user?.roles]
  );

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const tab = String(searchParams.get('tab') || fallbackTab).toLowerCase();
    return allowedTabs.includes(tab) ? tab : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  useEffect(() => {
    const rawTab = String(searchParams.get('tab') || '');
    const normalizedRawTab = rawTab
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-');
    if (!normalizedRawTab || VENTAS_TABS.has(normalizedRawTab)) return;

    const cierresTab = normalizeCierresCajaTab(normalizedRawTab);
    if (!cierresTab) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', cierresTab);
    navigate(`/dashboard/cierres-caja?${nextParams.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  useEffect(() => {
    if (permisosLoading || !fallbackTab) return;
    const rawTab = String(searchParams.get('tab') || '').toLowerCase();
    if (rawTab && allowedTabs.includes(rawTab)) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', fallbackTab);
    setSearchParams(nextParams, { replace: true });
  }, [allowedTabs, fallbackTab, permisosLoading, searchParams, setSearchParams]);

  useEffect(() => {
    if (!detailOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailOpen]);

  const goToTab = (tabKey) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tabKey);
    setSearchParams(nextParams);
  };

  const getRuntimePrinterConfig = async ({ idSucursal, idCaja = null, forceRefresh = false } = {}) => {
    const sucursalId = Number.parseInt(String(idSucursal ?? ''), 10);
    const cajaId = Number.parseInt(String(idCaja ?? ''), 10);
    if (!Number.isInteger(sucursalId) || sucursalId <= 0) {
      throw new Error('No se pudo resolver la sucursal para configuracion de impresion.');
    }

    const cacheKey = `${sucursalId}:${Number.isInteger(cajaId) && cajaId > 0 ? cajaId : 'none'}`;
    if (!forceRefresh && printerConfigCacheRef.current.has(cacheKey)) {
      return printerConfigCacheRef.current.get(cacheKey);
    }

    const response = await ventasService.getPrintRuntimeConfig({
      id_sucursal: sucursalId,
      ...(Number.isInteger(cajaId) && cajaId > 0 ? { id_caja: cajaId } : {})
    });
    printerConfigCacheRef.current.set(cacheKey, response);
    return response;
  };

  const runPrinterDetectionIfNeeded = async ({
    idSucursal,
    idCaja,
    idSesionCaja,
    origen = 'PRIMERA_VENTA',
    notifyOnChange = false
  } = {}) => {
    try {
      const result = await printerDeviceDetectionService.detectPrintersForCaja({
        idSucursal,
        idCaja,
        idSesionCaja,
        origen
      });
      if (notifyOnChange && !result?.skipped && result?.message) {
        const title = result.status === 'REQUIERE_CONFIGURACION_ADMIN'
          ? 'IMPRESORAS'
          : result.status === 'NO_DETECTADO'
            ? 'IMPRESORAS'
            : 'IMPRESORAS';
        const variant = result.status === 'CONFIGURADO' || result.status === 'YA_CONFIGURADO'
          ? 'success'
          : 'warning';
        openToast(title, result.message, variant);
      }
      return result;
    } catch (error) {
      console.warn('[Ventas] No se pudo ejecutar la deteccion operativa de impresoras.', {
        status: error?.status,
        code: error?.code,
        message: error?.message
      });
      if (notifyOnChange) {
        openToast(
          'IMPRESORAS',
          'No se pudo validar la impresora automática. Puedes continuar, pero revisa que QZ Tray esté abierto.',
          'warning'
        );
      }
      return null;
    }
  };

  const monitorAgentPrintJob = (jobId, label = 'IMPRESION') => {
    const normalizedId = Number(jobId || 0);
    if (!AGENT_PRINT_MODE || !normalizedId || typeof window === 'undefined') return;
    const poll = async (attempt = 1) => {
      try {
        const response = await ventasService.getPrintJob(normalizedId);
        const state = String(response?.job?.estado || '').toLowerCase();
        if (state === 'impreso') {
          openToast(label, 'Documento impreso correctamente por el agente de la sucursal.', 'success');
          return;
        }
        if (['fallido', 'cancelado'].includes(state)) {
          openToast(label, 'El agente reporto un error de impresion. La venta permanece registrada.', 'warning');
          return;
        }
      } catch {
        // El monitoreo es informativo y nunca altera la venta confirmada.
      }
      if (attempt < 10) window.setTimeout(() => void poll(attempt + 1), 3000);
    };
    window.setTimeout(() => void poll(), 1500);
  };

  const printFacturaAfterSuccessfulPayment = async ({
    response,
    payload = null,
    ventaDetail: providedVentaDetail = null,
    facturaPrintWindow = AGENT_PRINT_MODE ? null : openPrintWindow('Preparando factura'),
    origin = 'POST_PAYMENT',
    failureMessage = 'La venta se creo, pero no se pudo imprimir la factura automaticamente ni abrir la impresion manual.',
    qzFallbackMessage = 'La factura no se pudo imprimir automaticamente con QZ Tray, pero se abrio la impresion manual.',
    browserFailureMessage = 'La venta se creo, pero no se pudo abrir la factura para imprimir.'
  } = {}) => {
    const idFactura = Number(response?.id_factura || providedVentaDetail?.id_factura || 0) || null;
    if (!idFactura) {
      if (facturaPrintWindow) facturaPrintWindow.close();
      return { ok: false, ventaDetail: providedVentaDetail };
    }

    let ventaDetail = providedVentaDetail || normalizeVentaDetail(response);

    if (!providedVentaDetail && !hasCreateVentaDetailPayload(response)) {
      try {
        ventaDetail = await getVentaDetail(idFactura);
      } catch {
        // El detalle completo mejora el ticket, pero la impresion puede resolverse por id_factura.
      }
    }

    if (AGENT_PRINT_MODE) {
      if (facturaPrintWindow && !facturaPrintWindow.closed) facturaPrintWindow.close();
      try {
        const queued = await ventasService.enqueuePrintJob(
          idFactura,
          { tipo_documento: 'factura', es_reimpresion: false },
          `factura:${idFactura}:inicial`
        );
        openToast('IMPRESION FACTURA', 'Venta confirmada y enviada a la cola de impresion.', 'success');
        monitorAgentPrintJob(queued?.job?.id_trabajo, 'IMPRESION FACTURA');
        return { ok: true, queued: true, printJob: queued?.job || null, ventaDetail };
      } catch (error) {
        openToast('IMPRESION PENDIENTE', 'La venta se registro, pero no se pudo enviar a impresion. Puede reintentarse desde el detalle.', 'warning');
        return { ok: false, queued: false, ventaDetail, error };
      }
    }

    const resolvedSucursalId = Number.parseInt(
      String(ventaDetail?.id_sucursal ?? response?.id_sucursal ?? payload?.id_sucursal ?? ''),
      10
    );
    const resolvedCajaId = Number.parseInt(
      String(ventaDetail?.id_caja ?? response?.id_caja ?? payload?.id_caja ?? ''),
      10
    );
    const resolvedSesionCajaId = Number.parseInt(
      String(ventaDetail?.id_sesion_caja ?? response?.id_sesion_caja ?? payload?.id_sesion_caja ?? ''),
      10
    );
    const detectionResult = Number.isInteger(resolvedSucursalId)
      && resolvedSucursalId > 0
      && Number.isInteger(resolvedCajaId)
      && resolvedCajaId > 0
      && Number.isInteger(resolvedSesionCajaId)
      && resolvedSesionCajaId > 0
      ? await runPrinterDetectionIfNeeded({
        idSucursal: resolvedSucursalId,
        idCaja: resolvedCajaId,
        idSesionCaja: resolvedSesionCajaId,
        origen: 'PRIMERA_VENTA',
        notifyOnChange: false
      })
      : null;
    const runtimePrinterConfig = Number.isInteger(resolvedSucursalId) && resolvedSucursalId > 0
      ? await getRuntimePrinterConfig({
        idSucursal: resolvedSucursalId,
        idCaja: Number.isInteger(resolvedCajaId) && resolvedCajaId > 0 ? resolvedCajaId : null,
        forceRefresh: Boolean(detectionResult && !detectionResult.skipped)
      }).catch(() => null)
      : null;
    const facturaPrinterConfig = resolvePrinterByType(runtimePrinterConfig, 'FACTURA');
    const facturaWidthMm = resolvePrintWidthMm(
      facturaPrinterConfig?.ancho_mm,
      ventaDetail?.facturacion?.ticket?.ancho_ticket_mm
    );
    const attemptedQzMode = isQzMode(facturaPrinterConfig)
      ? String(facturaPrinterConfig?.modo_impresion || 'QZ_HTML').trim().toUpperCase()
      : null;
    const canUseQzFactura = Boolean(
      facturaPrinterConfig?.activa !== false
      && attemptedQzMode
      && String(facturaPrinterConfig?.nombre_impresora_sistema || '').trim()
    );

    try {
      if (canUseQzFactura) {
        await printVentaTicketWithQz(idFactura, facturaPrinterConfig, {
          idSucursal: resolvedSucursalId
        });
        if (facturaPrintWindow && !facturaPrintWindow.closed) facturaPrintWindow.close();
      } else {
        await printVentaTicketPdf(idFactura, facturaPrintWindow);
      }
      void ventasService.registerPrintEvent(idFactura, {
        tipo_documento: 'FACTURA',
        estado: 'GENERADA',
        nombre_logico: 'FACTURA',
        id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
        nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
        ancho_mm: facturaWidthMm,
        metadata: {
          origin,
          printMode: canUseQzFactura ? attemptedQzMode : 'BROWSER',
          logicalPrinterName: 'FACTURA',
          printerType: 'FACTURA',
          fallbackUsed: false
        }
      }).catch(() => undefined);
      return { ok: true, ventaDetail };
    } catch (error) {
      const printErrorMessage = error?.message || 'No se pudo abrir la factura para imprimir.';

      if (attemptedQzMode && canUseQzFactura) {
        void ventasService.registerPrintEvent(idFactura, {
          tipo_documento: 'FACTURA',
          estado: 'ERROR',
          nombre_logico: 'FACTURA',
          id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
          nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
          ancho_mm: facturaWidthMm,
          detalle_error: printErrorMessage,
          metadata: {
            origin,
            printMode: attemptedQzMode,
            logicalPrinterName: 'FACTURA',
            printerType: 'FACTURA',
            fallbackPlanned: 'BROWSER'
          }
        }).catch(() => undefined);

        try {
          await printVentaTicketPdf(idFactura, facturaPrintWindow);
          openToast('IMPRESION FACTURA', qzFallbackMessage, 'warning');
          void ventasService.registerPrintEvent(idFactura, {
            tipo_documento: 'FACTURA',
            estado: 'GENERADA',
            nombre_logico: 'FACTURA',
            id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
            nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
            ancho_mm: facturaWidthMm,
            metadata: {
              origin,
              printMode: 'BROWSER',
              logicalPrinterName: 'FACTURA',
              printerType: 'FACTURA',
              fallbackUsed: true,
              fallbackFrom: attemptedQzMode,
              qzError: printErrorMessage
            }
          }).catch(() => undefined);
          return { ok: true, ventaDetail, fallbackUsed: true };
        } catch (fallbackError) {
          if (facturaPrintWindow) facturaPrintWindow.close();
          console.error(
            '[Ventas] No se pudo imprimir la factura ni con QZ ni con el navegador.',
            getSafePrintErrorContext('factura', fallbackError)
          );
          openToast('IMPRESION FACTURA', failureMessage, 'warning');
          void ventasService.registerPrintEvent(idFactura, {
            tipo_documento: 'FACTURA',
            estado: 'ERROR',
            nombre_logico: 'FACTURA',
            id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
            nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
            ancho_mm: facturaWidthMm,
            detalle_error: fallbackError?.message || printErrorMessage,
            metadata: {
              origin,
              printMode: 'BROWSER',
              logicalPrinterName: 'FACTURA',
              printerType: 'FACTURA',
              fallbackAttempted: true,
              fallbackFrom: attemptedQzMode,
              qzError: printErrorMessage
            }
          }).catch(() => undefined);
          return { ok: false, ventaDetail, error: fallbackError };
        }
      }

      if (facturaPrintWindow) facturaPrintWindow.close();
      console.error(
        '[Ventas] No se pudo abrir la factura para impresion.',
        getSafePrintErrorContext('factura', error)
      );
      openToast('IMPRESION FACTURA', browserFailureMessage, 'warning');
      void ventasService.registerPrintEvent(idFactura, {
        tipo_documento: 'FACTURA',
        estado: 'ERROR',
        nombre_logico: 'FACTURA',
        id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
        nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
        ancho_mm: facturaWidthMm,
        detalle_error: printErrorMessage,
        metadata: {
          origin,
          printMode: 'BROWSER',
          logicalPrinterName: 'FACTURA',
          printerType: 'FACTURA',
          fallbackUsed: false
        }
      }).catch(() => undefined);
      return { ok: false, ventaDetail, error };
    }
  };

  const openDetail = async (venta) => {
    if (!venta?.id_factura) return;

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setSelectedVenta(venta);
    setDetailOpen(true);

    try {
      const detail = await getVentaDetail(venta.id_factura);
      if (detailRequestRef.current !== requestId) return;
      setSelectedVenta(detail);
    } catch {
      // El hook ya expone el feedback visual.
    }
  };

  const openReversionFromDetail = async (ventaBase) => {
    if (!canCreateReversion || !ventaBase?.id_factura) return;
    try {
      const detail = await getVentaDetail(ventaBase.id_factura);
      setSelectedVentaReversion(detail);
      setReversionOpen(true);
    } catch {
      // El hook ya muestra error.
    }
  };

  const handleCreateVenta = async (payload, options) => {
    const facturaPrintWindow = AGENT_PRINT_MODE ? null : openPrintWindow();
    let response;
    try {
      response = await createVenta(payload, options);
    } catch (error) {
      if (facturaPrintWindow) facturaPrintWindow.close();
      throw error;
    }

    if (response?.id_factura) {
      goToTab('ventas');

      let ventaDetail = hasCreateVentaDetailPayload(response)
        ? normalizeVentaDetail(response)
        : normalizeVentaDetail(response);

      if (hasCreateVentaDetailPayload(response)) {
        detailRequestRef.current += 1;
      } else {
        try {
          ventaDetail = await getVentaDetail(response.id_factura);
        } catch {
          // El hook ya muestra el error del detalle; seguimos con el flujo post-venta.
        }
      }

      const printResult = await printFacturaAfterSuccessfulPayment({
        response,
        payload,
        ventaDetail,
        facturaPrintWindow,
        origin: 'DIRECT_SALE'
      });
      ventaDetail = printResult.ventaDetail || ventaDetail;
      ventaDetail = {
        ...ventaDetail,
        requiere_cocina: response?.requiere_cocina === true,
        requiere_revision: response?.requiere_revision === true,
        accion_operativa: response?.accion_operativa || null,
        lineas_invalidas: Array.isArray(response?.lineas_invalidas) ? response.lineas_invalidas : []
      };

      if (ventaDetail.requiere_revision) {
        openToast('PEDIDO REQUIERE REVISION', 'El pedido contiene lineas invalidas y no fue enviado a cocina.', 'warning');
        await openDetail(ventaDetail);
      } else if (ventaDetail.requiere_cocina) {
        setComandaPrompt(createComandaPrompt({
          venta: ventaDetail,
          sourceType: 'factura',
          action: 'initial',
          origin: 'post-sale'
        }));
      } else {
        await openDetail(ventaDetail);
      }
    } else if (facturaPrintWindow) {
      facturaPrintWindow.close();
    }

    return response;
  };

  const handlePendingOrderCreatedPrintPrompt = (comanda) => {
    if (comanda?.requiere_revision === true) {
      openToast('PEDIDO REQUIERE REVISION', 'El pedido contiene lineas invalidas y no fue enviado a cocina.', 'warning');
      return;
    }
    if (comanda?.requiere_cocina !== true) return;
    setComandaPrompt(createComandaPrompt({
      venta: comanda,
      sourceType: 'pedido',
      action: 'initial',
      origin: 'pending-order'
    }));
  };

  const handleSuccessfulPendingOrderPaymentPrint = async (response, options = {}) => {
    const printResult = await printFacturaAfterSuccessfulPayment({
      response,
      payload: options?.payload || null,
      ventaDetail: null,
      origin: options?.origin || 'PENDING_ORDER_PAYMENT',
      failureMessage: 'El pago se registro correctamente, pero la factura no pudo imprimirse',
      qzFallbackMessage: 'El pago se registro correctamente. La factura no se pudo imprimir automaticamente con QZ Tray, pero se abrio la impresion manual.',
      browserFailureMessage: 'El pago se registro correctamente, pero la factura no pudo imprimirse'
    });
    return printResult;
  };

  const closeComandaPrompt = async ({ markAsCancelled = true } = {}) => {
    const venta = comandaPrompt.venta;
    const { sourceType, action, origin } = comandaPrompt;
    if (markAsCancelled && venta?.id_factura) {
      void ventasService.registerPrintEvent(venta.id_factura, {
        tipo_documento: 'COMANDA',
        estado: 'CANCELADA',
        nombre_logico: 'COCINA',
        ancho_mm: 80,
        metadata: {
          promptSourceType: sourceType,
          promptAction: action,
          promptOrigin: origin,
          printMode: 'BROWSER',
          logicalPrinterName: 'COCINA'
        }
      }).catch(() => undefined);
    }
    setComandaPrompt(createClosedComandaPrompt());
    if (origin === 'post-sale' && venta?.id_factura) {
      await openDetail(venta);
    }
  };

  const handleDetailFacturaPrint = async (venta, options = {}) => {
    if (!venta?.id_factura) return;

    if (AGENT_PRINT_MODE) {
      try {
        const { response: queued } = await enqueueAgentPrintAction({
          ventasApi: ventasService,
          documentType: 'factura',
          venta,
          action: 'reprint',
          motivo: options?.motivo
        });
        openToast('REIMPRESION FACTURA', 'Reimpresion enviada a la cola de la sucursal.', 'success');
        monitorAgentPrintJob(queued?.job?.id_trabajo, 'REIMPRESION FACTURA');
      } catch (error) {
        console.error('[Ventas] Fallo la reimpresion de factura.', getSafePrintErrorContext('factura', error));
        openToast('REIMPRESION FACTURA', 'No se pudo enviar la factura a impresión.', 'warning');
        const publicError = new Error('No se pudo enviar la factura a impresión.');
        publicError.publicMessage = publicError.message;
        throw publicError;
      }
      return;
    }

    const facturaPrintWindow = openPrintWindow('Preparando factura');
    const resolvedSucursalId = Number.parseInt(String(venta?.id_sucursal ?? ''), 10);
    const resolvedCajaId = Number.parseInt(String(venta?.id_caja ?? ''), 10);
    const runtimePrinterConfig = Number.isInteger(resolvedSucursalId) && resolvedSucursalId > 0
      ? await getRuntimePrinterConfig({
        idSucursal: resolvedSucursalId,
        idCaja: Number.isInteger(resolvedCajaId) && resolvedCajaId > 0 ? resolvedCajaId : null
      }).catch(() => null)
      : null;
    const facturaPrinterConfig = resolvePrinterByType(runtimePrinterConfig, 'FACTURA');
    const facturaWidthMm = resolvePrintWidthMm(
      facturaPrinterConfig?.ancho_mm,
      options?.ticketWidthMm
    );
    const attemptedQzMode = isQzMode(facturaPrinterConfig)
      ? String(facturaPrinterConfig?.modo_impresion || 'QZ_HTML').trim().toUpperCase()
      : null;
    const canUseQzFactura = Boolean(
      facturaPrinterConfig?.activa !== false
      && attemptedQzMode
      && String(facturaPrinterConfig?.nombre_impresora_sistema || '').trim()
    );

    try {
      if (canUseQzFactura) {
        await printVentaTicketWithQz(venta.id_factura, facturaPrinterConfig, {
          idSucursal: resolvedSucursalId
        });
        if (facturaPrintWindow && !facturaPrintWindow.closed) facturaPrintWindow.close();
      } else {
        await printVentaTicketPdf(venta.id_factura, facturaPrintWindow);
      }
      void ventasService.registerPrintEvent(venta.id_factura, {
        tipo_documento: 'FACTURA',
        estado: 'GENERADA',
        nombre_logico: 'FACTURA',
        id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
        nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
        ancho_mm: facturaWidthMm,
        metadata: {
          origin: 'DETAIL_REPRINT',
          printMode: canUseQzFactura ? attemptedQzMode : 'BROWSER',
          logicalPrinterName: 'FACTURA',
          printerType: 'FACTURA',
          fallbackUsed: false
        }
      }).catch(() => undefined);

    } catch (error) {
      const printErrorMessage = error?.message || 'No se pudo abrir la factura para imprimir.';

      if (attemptedQzMode && canUseQzFactura) {
        void ventasService.registerPrintEvent(venta.id_factura, {
          tipo_documento: 'FACTURA',
          estado: 'ERROR',
          nombre_logico: 'FACTURA',
          id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
          nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
          ancho_mm: facturaWidthMm,
          detalle_error: printErrorMessage,
          metadata: {
            origin: 'DETAIL_REPRINT',
            printMode: attemptedQzMode,
            logicalPrinterName: 'FACTURA',
            printerType: 'FACTURA',
            fallbackPlanned: 'BROWSER'
          }
        }).catch(() => undefined);

        try {
          await printVentaTicketPdf(venta.id_factura, facturaPrintWindow);
          openToast(
            'REIMPRESION FACTURA',
            'No se pudo imprimir automaticamente con QZ Tray, pero se abrio la impresion manual.',
            'warning'
          );
          void ventasService.registerPrintEvent(venta.id_factura, {
            tipo_documento: 'FACTURA',
            estado: 'GENERADA',
            nombre_logico: 'FACTURA',
            id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
            nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
            ancho_mm: facturaWidthMm,
            metadata: {
              origin: 'DETAIL_REPRINT',
              printMode: 'BROWSER',
              logicalPrinterName: 'FACTURA',
              printerType: 'FACTURA',
              fallbackUsed: true,
              fallbackFrom: attemptedQzMode,
              qzError: printErrorMessage
            }
          }).catch(() => undefined);

          return;
        } catch (fallbackError) {
          if (facturaPrintWindow) facturaPrintWindow.close();
          console.error(
            '[Ventas] No se pudo reimprimir la factura ni con QZ ni con el navegador.',
            getSafePrintErrorContext('factura', fallbackError)
          );
          openToast(
            'REIMPRESION FACTURA',
            'No se pudo imprimir la factura automaticamente ni abrir la impresion manual.',
            'warning'
          );
          void ventasService.registerPrintEvent(venta.id_factura, {
            tipo_documento: 'FACTURA',
            estado: 'ERROR',
            nombre_logico: 'FACTURA',
            id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
            nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
            ancho_mm: facturaWidthMm,
            detalle_error: fallbackError?.message || printErrorMessage,
            metadata: {
              origin: 'DETAIL_REPRINT',
              printMode: 'BROWSER',
              logicalPrinterName: 'FACTURA',
              printerType: 'FACTURA',
              fallbackAttempted: true,
              fallbackFrom: attemptedQzMode,
              qzError: printErrorMessage
            }
          }).catch(() => undefined);
        }
      } else {
        if (facturaPrintWindow) facturaPrintWindow.close();
        console.error(
          '[Ventas] No se pudo abrir la factura para reimpresion.',
          getSafePrintErrorContext('factura', error)
        );
        openToast(
          'REIMPRESION FACTURA',
          'No se pudo abrir la factura para imprimir.',
          'warning'
        );
        void ventasService.registerPrintEvent(venta.id_factura, {
          tipo_documento: 'FACTURA',
          estado: 'ERROR',
          nombre_logico: 'FACTURA',
          id_impresora: Number(facturaPrinterConfig?.id_impresora || 0) || null,
          nombre_impresora_snapshot: facturaPrinterConfig?.nombre_impresora_sistema || null,
          ancho_mm: facturaWidthMm,
          detalle_error: printErrorMessage,
          metadata: {
            origin: 'DETAIL_REPRINT',
            printMode: 'BROWSER',
            logicalPrinterName: 'FACTURA',
            printerType: 'FACTURA',
            fallbackUsed: false
          }
        }).catch(() => undefined);
      }

      const publicError = new Error('No se pudo enviar la factura a impresión.');
      publicError.publicMessage = publicError.message;
      throw publicError;
    }
  };

  const executeComandaPrint = async (printContext, {
    usePromptState = true,
    closePromptOnSuccess = true
  } = {}) => {
    const venta = printContext.venta;
    const { sourceType, action, origin } = printContext;
    const isPendingOrderComanda = sourceType === 'pedido';
    const isReprint = action === 'reprint';
    const failPrint = (message, cause = null) => {
      if (usePromptState) {
        setComandaPrompt((current) => ({ ...current, loading: false, error: message }));
        return;
      }
      const publicError = new Error(message);
      publicError.publicMessage = message;
      publicError.code = String(cause?.code || cause?.data?.code || '').trim() || undefined;
      publicError.status = Number(cause?.status || cause?.data?.status || 0) || undefined;
      throw publicError;
    };
    if ((isPendingOrderComanda ? !venta?.id_pedido : !venta?.id_factura)
      || (usePromptState && printContext.loading)) return;

    const comandaPrintWindow = prepareComandaPrintWindow({
      agentPrintMode: AGENT_PRINT_MODE,
      sourceType,
      openWindow: openPrintWindow
    });

    if (usePromptState) {
      setComandaPrompt((current) => ({
        ...current,
        loading: true,
        error: ''
      }));
    }

    if (!isReprint && venta?.requiere_cocina === true) {
      try {
        await ventasService.updatePedidoEstado(venta.id_pedido, 'EN_COCINA');
      } catch (error) {
        if (comandaPrintWindow) comandaPrintWindow.close();
        failPrint('No se pudo enviar el pedido a cocina.', error);
        return;
      }
    }

    if (AGENT_PRINT_MODE) {
      try {
        const { response: queued } = await enqueueAgentPrintAction({
          ventasApi: ventasService,
          documentType: 'comanda',
          venta,
          sourceType,
          action
        });
        const monitorLabel = isReprint ? 'REIMPRESION COMANDA' : 'COMANDA COCINA';
        openToast(monitorLabel, isReprint ? 'Comanda enviada a reimpresion.' : 'Comanda enviada a la cola de impresion.', 'success');
        monitorAgentPrintJob(queued?.job?.id_trabajo, monitorLabel);
        if (closePromptOnSuccess) await closeComandaPrompt({ markAsCancelled: false });
      } catch (error) {
        console.error('[Ventas] Fallo la impresion de comanda con agente.', getSafePrintErrorContext('comanda', error));
        const message = isPendingOrderComanda && isReprint
          ? 'No se pudo reimprimir la comanda del pedido.'
          : 'No se pudo enviar la comanda a impresión.';
        failPrint(message, error);
      }
      return;
    }

    let comandaForPrint = venta;
    let cocinaPrinterConfig = null;
    let cocinaWidthMm = 80;
    let attemptedQzMode = null;
    let canUseQzComanda = false;

    try {
      const comanda = isPendingOrderComanda
        ? await ventasService.getPedidoComanda(venta.id_pedido)
        : venta;
      comandaForPrint = comanda;

      const resolvedSucursalId = Number.parseInt(String(comanda?.id_sucursal ?? ''), 10);
      const resolvedCajaId = Number.parseInt(String(comanda?.id_caja ?? ''), 10);
      const runtimePrinterConfig = Number.isInteger(resolvedSucursalId) && resolvedSucursalId > 0
        ? await getRuntimePrinterConfig({
          idSucursal: resolvedSucursalId,
          idCaja: Number.isInteger(resolvedCajaId) && resolvedCajaId > 0 ? resolvedCajaId : null
        }).catch(() => null)
        : null;
      cocinaPrinterConfig = resolvePrinterByType(runtimePrinterConfig, 'COCINA');
      cocinaWidthMm = resolvePrintWidthMm(cocinaPrinterConfig?.ancho_mm);
      attemptedQzMode = isQzMode(cocinaPrinterConfig)
        ? String(cocinaPrinterConfig?.modo_impresion || 'QZ_HTML').trim().toUpperCase()
        : null;
      canUseQzComanda = Boolean(
        cocinaPrinterConfig?.activa !== false
        && attemptedQzMode
        && String(cocinaPrinterConfig?.nombre_impresora_sistema || '').trim()
      );

      const validation = validateComandaForPrint(comanda);
      if (!validation.ok) throw new Error(validation.message);
      if (isPendingOrderComanda && !canUseQzComanda) {
        throw new Error('El pedido fue creado, pero la comanda no se imprimio. Revisa la impresora logica COCINA en QZ Tray.');
      }

      if (canUseQzComanda) {
        await printComandaCocinaWithQz(comanda, cocinaPrinterConfig, {
          idSucursal: resolvedSucursalId
        });
        if (comandaPrintWindow && !comandaPrintWindow.closed) comandaPrintWindow.close();
      } else {
        await printComandaCocinaInWindow(comanda, comandaPrintWindow, { widthMm: cocinaWidthMm });
      }

      if (venta.id_factura) {
        void ventasService.registerPrintEvent(venta.id_factura, {
          tipo_documento: 'COMANDA',
          estado: 'ENVIADA',
          nombre_logico: 'COCINA',
          id_impresora: Number(cocinaPrinterConfig?.id_impresora || 0) || null,
          nombre_impresora_snapshot: cocinaPrinterConfig?.nombre_impresora_sistema || null,
          ancho_mm: cocinaWidthMm,
          metadata: {
            promptSourceType: sourceType,
            promptAction: action,
            promptOrigin: origin,
            printMode: canUseQzComanda ? attemptedQzMode : 'BROWSER',
            logicalPrinterName: 'COCINA',
            printerType: 'COCINA',
            fallbackUsed: false
          }
        }).catch(() => undefined);
      }
      openToast(isReprint ? 'REIMPRESION COMANDA' : 'COMANDA COCINA', 'Comanda enviada a impresion.', 'success');
      if (closePromptOnSuccess) await closeComandaPrompt({ markAsCancelled: false });
    } catch (error) {
      const printErrorMessage = error?.message || 'No se pudo imprimir la comanda de cocina.';

      if (isPendingOrderComanda) {
        if (comandaPrintWindow) comandaPrintWindow.close();
        console.error(
          '[Ventas] No se pudo imprimir la comanda del pedido pendiente.',
          getSafePrintErrorContext('comanda', error)
        );
        const pendingOrderErrorMessage = isReprint
          ? 'No se pudo reimprimir la comanda del pedido.'
          : comandaForPrint === venta
            ? 'El pedido fue creado, pero no se pudo cargar la comanda para imprimir'
            : 'El pedido fue creado, pero la comanda no se imprimio.';
        openToast('COMANDA COCINA', pendingOrderErrorMessage, 'warning');
        failPrint(
          isReprint || comandaForPrint === venta
            ? pendingOrderErrorMessage
            : `${pendingOrderErrorMessage} ${printErrorMessage}`.trim(),
          error
        );
        return;
      }

      if (attemptedQzMode && canUseQzComanda) {
        if (venta.id_factura) {
          void ventasService.registerPrintEvent(venta.id_factura, {
            tipo_documento: 'COMANDA',
            estado: 'ERROR',
            nombre_logico: 'COCINA',
            id_impresora: Number(cocinaPrinterConfig?.id_impresora || 0) || null,
            nombre_impresora_snapshot: cocinaPrinterConfig?.nombre_impresora_sistema || null,
            ancho_mm: cocinaWidthMm,
            detalle_error: printErrorMessage,
            metadata: {
              promptSourceType: sourceType,
              promptAction: action,
              promptOrigin: origin,
              printMode: attemptedQzMode,
              logicalPrinterName: 'COCINA',
              printerType: 'COCINA',
              fallbackPlanned: 'BROWSER'
            }
          }).catch(() => undefined);
        }

        try {
          await printComandaCocinaInWindow(comandaForPrint, comandaPrintWindow, { widthMm: cocinaWidthMm });
          openToast(
            'COMANDA COCINA',
            'La comanda no se pudo imprimir automaticamente con QZ Tray, pero se abrio la impresion manual.',
            'warning'
          );
          if (venta.id_factura) {
            void ventasService.registerPrintEvent(venta.id_factura, {
              tipo_documento: 'COMANDA',
              estado: 'ENVIADA',
              nombre_logico: 'COCINA',
              id_impresora: Number(cocinaPrinterConfig?.id_impresora || 0) || null,
              nombre_impresora_snapshot: cocinaPrinterConfig?.nombre_impresora_sistema || null,
              ancho_mm: cocinaWidthMm,
              metadata: {
                promptSourceType: sourceType,
                promptAction: action,
                promptOrigin: origin,
                printMode: 'BROWSER',
                logicalPrinterName: 'COCINA',
                printerType: 'COCINA',
                fallbackUsed: true,
                fallbackFrom: attemptedQzMode,
                qzError: printErrorMessage
              }
            }).catch(() => undefined);
          }
          if (closePromptOnSuccess) await closeComandaPrompt({ markAsCancelled: false });
          return;
        } catch (fallbackError) {
          if (comandaPrintWindow) comandaPrintWindow.close();
          console.error(
            '[Ventas] No se pudo imprimir la comanda ni con QZ ni con el navegador.',
            getSafePrintErrorContext('comanda', fallbackError)
          );
          if (venta.id_factura) {
            void ventasService.registerPrintEvent(venta.id_factura, {
              tipo_documento: 'COMANDA',
              estado: 'ERROR',
              nombre_logico: 'COCINA',
              id_impresora: Number(cocinaPrinterConfig?.id_impresora || 0) || null,
              nombre_impresora_snapshot: cocinaPrinterConfig?.nombre_impresora_sistema || null,
              ancho_mm: cocinaWidthMm,
              detalle_error: fallbackError?.message || printErrorMessage,
              metadata: {
                promptSourceType: sourceType,
                promptAction: action,
                promptOrigin: origin,
                printMode: 'BROWSER',
                logicalPrinterName: 'COCINA',
                printerType: 'COCINA',
                fallbackAttempted: true,
                fallbackFrom: attemptedQzMode,
                qzError: printErrorMessage
              }
            }).catch(() => undefined);
          }
          failPrint('No se pudo enviar la comanda a impresión.');
          return;
        }
      }

      if (comandaPrintWindow) comandaPrintWindow.close();
      console.error(
        '[Ventas] No se pudo imprimir la comanda de cocina.',
        getSafePrintErrorContext('comanda', error)
      );
      if (venta.id_factura) {
        void ventasService.registerPrintEvent(venta.id_factura, {
          tipo_documento: 'COMANDA',
          estado: 'ERROR',
          nombre_logico: 'COCINA',
          id_impresora: Number(cocinaPrinterConfig?.id_impresora || 0) || null,
          nombre_impresora_snapshot: cocinaPrinterConfig?.nombre_impresora_sistema || null,
          ancho_mm: cocinaWidthMm,
          detalle_error: printErrorMessage,
          metadata: {
            promptSourceType: sourceType,
            promptAction: action,
            promptOrigin: origin,
            printMode: 'BROWSER',
            logicalPrinterName: 'COCINA',
            printerType: 'COCINA',
            fallbackUsed: false
          }
        }).catch(() => undefined);
      }
      failPrint(isReprint ? 'No se pudo enviar la comanda a impresión.' : printErrorMessage, error);
    }
  };

  const openComandaReprintFromDetail = async (venta, { sourceType = 'factura' } = {}) => {
    const printContext = createComandaPrompt({
      venta,
      sourceType,
      action: 'reprint',
      origin: 'detail',
      open: false
    });
    setComandaPrompt(printContext);
    try {
      await executeComandaPrint(printContext, {
        usePromptState: false,
        closePromptOnSuccess: false
      });
    } finally {
      setComandaPrompt(createClosedComandaPrompt());
    }
  };

  const handleAcceptComanda = async () => {
    await executeComandaPrint(comandaPrompt);
  };

  if (permisosLoading) return null;
  if (!activeTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.ventas}
        detalle="No tienes acceso a ningun submodulo de Ventas."
      />
    );
  }

  return (
    <>
      {activeTab === 'ventas' ? (
        <VentaOverviewView
          ventas={ventas}
          summary={summary}
          pagination={pagination}
          scopeInfo={scopeInfo}
          ventasFilters={ventasFilters}
          ventasCurrentDay={ventasCurrentDay}
          sucursales={sucursales}
          loading={loading}
          error={error}
          statsVisibility={statsVisibility}
          onSearchChange={setVentasSearch}
          onPageChange={setVentasPage}
          onPageSizeChange={setVentasPageSize}
          onFiltersChange={setVentasFilterPatch}
          onClearFilters={clearVentasFilters}
          onOpenDetail={openDetail}
          onGoToCaja={() => goToTab('caja')}
          canCreate={canCreateVenta}
          onOpenReversion={() => {
            if (!canCreateReversion) return;
            setSelectedVentaReversion(null);
            setReversionOpen(true);
          }}
          canReversion={canCreateReversion}
        />
      ) : null}

      {activeTab === 'caja' ? (
        <CajaView
          sucursales={sucursales}
          isSuperAdmin={isSuperAdmin}
          userId={user?.id_usuario}
          defaultSucursalId={!isSuperAdmin && Number.isInteger(userSucursalId) && userSucursalId > 0 ? userSucursalId : null}
          productos={productos}
          categorias={categorias}
          tiposDepartamento={tiposDepartamento}
          clientes={clientes}
          clientesMeta={clientesMeta}
          recetas={recetas}
          descuentosCatalogo={descuentosCatalogo}
          canApplyDiscount={canApplyDiscount}
          catalogLoading={catalogLoading}
          catalogLoadingStates={{
            bootstrapLoading,
            recipesLoading,
            productsLoading,
            clientsLoading,
            discountsLoading
          }}
          catalogStatuses={catalogStatuses}
          cajaBootstrapData={cajaBootstrapData}
          recipeCatalogState={recipeCatalogState}
          catalogErrors={catalogErrors}
          saving={saving}
          onSubmit={handleCreateVenta}
          onCreatePedidoPendiente={createPedidoPendiente}
          onRegistrarPagoPedido={registrarPagoPedido}
          onPedidoPendienteCreated={handlePendingOrderCreatedPrintPrompt}
          onSuccessfulPendingOrderPaymentPrint={handleSuccessfulPendingOrderPaymentPrint}
          onCatalogSucursalChange={loadCajaBootstrap}
          onCatalogDemand={loadCajaCatalog}
          onRecipesDepartmentDemand={loadCajaRecipesDepartment}
          onClientesRefresh={refreshClientesCatalog}
          onClienteCatalogUpsert={upsertClienteCatalog}
          onNotify={openToast}
        />
      ) : null}

      {activeTab === 'pedidos' ? (
        <PedidosView
          isSuperAdmin={isSuperAdmin}
          sucursales={sucursales}
          defaultSucursalId={Number.isInteger(userSucursalId) && userSucursalId > 0 ? userSucursalId : null}
          scopeInfo={scopeInfo}
          canPrintVenta={canPrintVenta}
          onPrintFactura={handleDetailFacturaPrint}
          onPrintComanda={openComandaReprintFromDetail}
          onSuccessfulPendingOrderPaymentPrint={handleSuccessfulPendingOrderPaymentPrint}
        />
      ) : null}
      {activeTab === 'descuentos' ? (
        <DescuentosView
          canView={canViewDescuentos}
          canCreate={canCreateDescuentos}
          canEdit={canEditDescuentos}
          canToggle={canToggleDescuentos}
          productos={productos}
          recetas={recetas}
          sucursales={sucursales}
          isSuperAdmin={isSuperAdmin}
          defaultSucursalId={Number.isInteger(userSucursalId) && userSucursalId > 0 ? userSucursalId : null}
        />
      ) : null}

      <VentaDetalleModal
        open={detailOpen}
        venta={selectedVenta}
        loading={detailLoading}
        canReversion={canCreateReversion}
        onOpenReversion={(ventaDetail) => {
          if (!canCreateReversion) return;
          openReversionFromDetail(ventaDetail);
        }}
        canExport={canExportVenta}
        canPrint={canPrintVenta}
        printSourceType="factura"
        onPrintFactura={handleDetailFacturaPrint}
        onPrintComanda={openComandaReprintFromDetail}
        onClose={() => {
          detailRequestRef.current += 1;
          setDetailOpen(false);
        }}
      />

      <EnviarComandaCocinaModal
        open={comandaPrompt.open}
        venta={comandaPrompt.venta}
        loading={comandaPrompt.loading}
        error={comandaPrompt.error}
        sourceType={comandaPrompt.sourceType}
        action={comandaPrompt.action}
        origin={comandaPrompt.origin}
        onAccept={handleAcceptComanda}
        onCancel={() => {
          void closeComandaPrompt();
        }}
      />

      {canCreateReversion ? (
        <VentaReversionModal
          open={reversionOpen}
          onClose={() => {
            setReversionOpen(false);
            setSelectedVentaReversion(null);
          }}
          getVentaDetail={getVentaDetail}
          scopeInfo={scopeInfo}
          sucursales={sucursales}
          selectedVenta={selectedVentaReversion}
          onSuccess={(result, refreshedDetail) => {
            void refreshVentas?.({ suppressErrors: true });
            if (refreshedDetail?.id_factura) {
              setSelectedVenta(refreshedDetail);
              setSelectedVentaReversion(refreshedDetail);
              return;
            }
            const idFactura =
              result?.id_factura_original ||
              result?.id_factura ||
              selectedVentaReversion?.id_factura ||
              selectedVenta?.id_factura;
            if (idFactura) {
              void getVentaDetail(idFactura)
                .then((detail) => {
                  setSelectedVenta(detail);
                  setSelectedVentaReversion(detail);
                })
                .catch(() => undefined);
            }
          }}
        />
      ) : null}

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
