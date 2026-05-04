import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../../../hooks/useAuth';
import { usePermisos } from '../../../../../context/PermisosContext';
import sucursalesService from '../../../../../services/sucursalesService';
import { normalizeRoles, PERMISSIONS } from '../../../../../utils/permissions';
import VentasToast from '../VentasToast';
import { useCierresCaja } from '../../hooks/useCierresCaja';
import { matchesCajaSession } from '../../utils/cajasHelpers';
import CierresCajaOverview from './CierresCajaOverview';
import CierresCajaList from './CierresCajaList';
import CierreCajaDetalleModal from './CierreCajaDetalleModal';
import CierreCajaAbrirModal from './CierreCajaAbrirModal';
import CierreCajaArqueoModal from './CierreCajaArqueoModal';
import CierreCajaCerrarModal from './CierreCajaCerrarModal';
import '../../../fidelizacion/styles/fidelizacion.css';
import '../../styles/cierres-caja.css';

const buildScopeQuery = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? { id_sucursal: parsed } : {};
};

const isTruthyState = (value) =>
  value === true || value === 'true' || value === 1 || value === '1';

export default function CierresCajaView() {
  const { user } = useAuth();
  const { canAny, isSuperAdmin } = usePermisos();
  const {
    catalogos,
    sesionActiva,
    sesiones,
    stats,
    loadingCatalogos,
    loadingSesiones,
    detailLoading,
    saving,
    error,
    toast,
    closeToast,
    loadCatalogos,
    loadSesionActiva,
    loadSesiones,
    getSesionDetalle,
    openSesion,
    createCajaCatalogo,
    closeSesion,
    createArqueo,
    listUsuariosOperativos,
    listCajaCatalogo
  } = useCierresCaja();

  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    id_estado_sesion_caja: '',
    fecha_desde: '',
    fecha_hasta: ''
  });
  const [selectedSesion, setSelectedSesion] = useState(null);
  const [selectedDetalle, setSelectedDetalle] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [openCajaOpen, setOpenCajaOpen] = useState(false);
  const [openCajaMode, setOpenCajaMode] = useState('existente');
  const [arqueoOpen, setArqueoOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [usuariosOperativos, setUsuariosOperativos] = useState([]);
  const [loadingUsuariosOperativos, setLoadingUsuariosOperativos] = useState(false);
  const [cajasOperativas, setCajasOperativas] = useState([]);
  const [loadingCajasOperativas, setLoadingCajasOperativas] = useState(false);
  const usuariosRequestIdRef = useRef(0);
  const cajasRequestIdRef = useRef(0);
  const usuariosBySucursalRef = useRef(new Map());
  const cajasBySucursalRef = useRef(new Map());

  const userSucursalId = Number.parseInt(String(user?.id_sucursal ?? ''), 10);
  const roleSet = useMemo(() => new Set(normalizeRoles(user?.roles)), [user?.roles]);

  const canSelectSucursal =
    isSuperAdmin || canAny([PERMISSIONS.VENTAS_CAJAS_MULTISUCURSAL_VER]);
  const canViewDetail = canAny([
    PERMISSIONS.VENTAS_CAJAS_DETALLE_VER,
    PERMISSIONS.VENTAS_CAJAS_REPORTE_VER
  ]);
  const canCloseSession = canAny([PERMISSIONS.VENTAS_CAJAS_SESION_CERRAR]);
  const canRegisterArqueo = canAny([PERMISSIONS.VENTAS_CAJAS_ARQUEO_REGISTRAR]);
  const canOpenSession = canAny([PERMISSIONS.VENTAS_CAJAS_SESION_ABRIR]);
  const canCreateCajaCatalog =
    canAny([PERMISSIONS.VENTAS_CAJAS_PARTICIPANTES_GESTIONAR])
    && (isSuperAdmin || roleSet.has('ADMIN') || roleSet.has('ADMINISTRADOR') || roleSet.has('SUPER_ADMIN'));
  const canResolveDifference = canAny([PERMISSIONS.VENTAS_CAJAS_DIFERENCIA_RESOLVER]);
  const canUseCloseFlow =
    isSuperAdmin || roleSet.has('ADMIN') || roleSet.has('ADMINISTRADOR') || roleSet.has('SUPER_ADMIN');

  const deferredSearch = useDeferredValue(filters.search);
  const scopeQuery = useMemo(() => buildScopeQuery(selectedSucursalId), [selectedSucursalId]);

  const visibleSesiones = useMemo(
    () => sesiones.filter((session) => matchesCajaSession(session, deferredSearch)),
    [deferredSearch, sesiones]
  );

  useEffect(() => {
    if (scopeInitialized) return;
    if (Number.isInteger(userSucursalId) && userSucursalId > 0) {
      setSelectedSucursalId(String(userSucursalId));
      setScopeInitialized(true);
      return;
    }
    setScopeInitialized(true);
  }, [scopeInitialized, userSucursalId]);

  useEffect(() => {
    if (!canSelectSucursal) return undefined;

    let ignore = false;
    const loadBranchCatalog = async () => {
      setLoadingSucursales(true);
      try {
        const response = await sucursalesService.getAll();
        if (ignore) return;
        const rows = (Array.isArray(response) ? response : [])
          .filter((row) => isTruthyState(row?.estado))
          .map((row) => ({
            id_sucursal: Number(row?.id_sucursal ?? 0) || null,
            nombre_sucursal: String(row?.nombre_sucursal ?? '').trim()
          }))
          .filter((row) => row.id_sucursal && row.nombre_sucursal)
          .sort((a, b) =>
            a.nombre_sucursal.localeCompare(b.nombre_sucursal, 'es', { sensitivity: 'base' })
          );
        setSucursales(rows);
      } catch {
        if (!ignore) {
          // El hook principal ya cubre toasts de negocio; esta carga solo afecta filtros.
        }
      } finally {
        if (!ignore) setLoadingSucursales(false);
      }
    };

    void loadBranchCatalog();
    return () => {
      ignore = true;
    };
  }, [canSelectSucursal]);

  useEffect(() => {
    const hasOverlay = detailOpen || openCajaOpen || arqueoOpen || closeOpen;
    if (!hasOverlay) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [arqueoOpen, closeOpen, detailOpen, openCajaOpen]);

  useEffect(() => {
    if (!scopeInitialized) return;

    void Promise.all([loadCatalogos(scopeQuery), loadSesionActiva(scopeQuery)]);
  }, [loadCatalogos, loadSesionActiva, scopeInitialized, scopeQuery]);

  useEffect(() => {
    if (!scopeInitialized) return;

    const query = {
      ...scopeQuery,
      ...(filters.id_estado_sesion_caja ? { id_estado_sesion_caja: filters.id_estado_sesion_caja } : {}),
      ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
      ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {})
    };

    void loadSesiones(query);
  }, [
    filters.fecha_desde,
    filters.fecha_hasta,
    filters.id_estado_sesion_caja,
    loadSesiones,
    scopeInitialized,
    scopeQuery
  ]);

  const ensureDetalle = async (sesion) => {
    const targetSession = sesion || selectedSesion;
    if (!targetSession?.id_sesion_caja) return null;
    const detail = await getSesionDetalle(targetSession.id_sesion_caja);
    setSelectedDetalle(detail);
    return detail;
  };

  const refreshCurrentScope = async () => {
    const query = {
      ...scopeQuery,
      ...(filters.id_estado_sesion_caja ? { id_estado_sesion_caja: filters.id_estado_sesion_caja } : {}),
      ...(filters.fecha_desde ? { fecha_desde: filters.fecha_desde } : {}),
      ...(filters.fecha_hasta ? { fecha_hasta: filters.fecha_hasta } : {})
    };

    await Promise.all([
      loadSesionActiva(scopeQuery),
      loadSesiones(query)
    ]);
  };

  const openDetalle = async (sesion) => {
    setSelectedSesion(sesion);
    setSelectedDetalle(null);
    setDetailOpen(true);

    try {
      await ensureDetalle(sesion);
    } catch {
      setDetailOpen(false);
      setSelectedSesion(null);
      setSelectedDetalle(null);
    }
  };

  const openArqueo = async (sesion) => {
    setSelectedSesion(sesion);
    setArqueoOpen(true);

    if (!selectedDetalle || selectedDetalle?.sesion?.id_sesion_caja !== sesion?.id_sesion_caja) {
      try {
        await ensureDetalle(sesion);
      } catch {
        setArqueoOpen(false);
      }
    }
  };

  const openCerrar = async (sesion) => {
    setSelectedSesion(sesion);
    setCloseOpen(true);

    if (!selectedDetalle || selectedDetalle?.sesion?.id_sesion_caja !== sesion?.id_sesion_caja) {
      try {
        await ensureDetalle(sesion);
      } catch {
        setCloseOpen(false);
      }
    }
  };

  const handleSubmitArqueo = async (payload) => {
    if (!selectedSesion?.id_sesion_caja) return;
    await createArqueo(selectedSesion.id_sesion_caja, payload);
    const [, detail] = await Promise.all([refreshCurrentScope(), ensureDetalle(selectedSesion)]);
    setArqueoOpen(false);

    const selectedType = (catalogos.tipos_arqueo || []).find(
      (item) => Number(item?.id_tipo_arqueo_caja) === Number(payload?.id_tipo_arqueo_caja)
    );
    const isClosingArqueo = String(selectedType?.codigo || '').trim().toUpperCase() === 'CIERRE';
    if (isClosingArqueo) {
      setSelectedDetalle(detail || selectedDetalle);
      setCloseOpen(true);
    }
  };

  const handleSubmitClose = async (payload) => {
    if (!selectedSesion?.id_sesion_caja) return;
    await closeSesion(selectedSesion.id_sesion_caja, payload);
    await Promise.all([refreshCurrentScope(), ensureDetalle(selectedSesion)]);
    setCloseOpen(false);
  };

  const handleSubmitOpenSession = async (payload) => {
    try {
      await openSesion(payload);
      await refreshCurrentScope();
      setOpenCajaOpen(false);
    } catch {
      // El hook muestra toast; evitamos uncaught promise en el modal.
    }
  };

  const handleSubmitCreateCaja = async (payload) => {
    try {
      await createCajaCatalogo(payload);
      await Promise.all([
        loadCatalogos(scopeQuery),
        refreshCurrentScope()
      ]);
      setOpenCajaOpen(false);
    } catch {
      // El hook muestra toast; evitamos uncaught promise en el modal.
    }
  };

  const handleRequestUsuarios = useCallback(async (idSucursal, rolOperativo = 'AUXILIAR') => {
    const idSucursalParsed = Number.parseInt(String(idSucursal || ''), 10);
    const rolOperativoNormalized = String(rolOperativo || 'AUXILIAR').trim().toUpperCase() || 'AUXILIAR';
    if (!Number.isInteger(idSucursalParsed) || idSucursalParsed <= 0) {
      setUsuariosOperativos([]);
      setLoadingUsuariosOperativos(false);
      return;
    }

    const cacheKey = `${idSucursalParsed}:${rolOperativoNormalized}`;
    const cached = usuariosBySucursalRef.current.get(cacheKey);
    if (cached) {
      setUsuariosOperativos(cached);
      setLoadingUsuariosOperativos(false);
      return;
    }

    const requestId = usuariosRequestIdRef.current + 1;
    usuariosRequestIdRef.current = requestId;
    setLoadingUsuariosOperativos(true);
    try {
      const response = await listUsuariosOperativos({
        id_sucursal: idSucursalParsed,
        rol_operativo: rolOperativoNormalized
      });
      if (usuariosRequestIdRef.current !== requestId) return;
      const rows = Array.isArray(response) ? response : [];
      usuariosBySucursalRef.current.set(cacheKey, rows);
      setUsuariosOperativos(rows);
    } catch {
      if (usuariosRequestIdRef.current !== requestId) return;
      setUsuariosOperativos([]);
    } finally {
      if (usuariosRequestIdRef.current === requestId) {
        setLoadingUsuariosOperativos(false);
      }
    }
  }, [listUsuariosOperativos]);

  const handleRequestCajas = useCallback(async (idSucursal) => {
    const idSucursalParsed = Number.parseInt(String(idSucursal || ''), 10);
    if (!Number.isInteger(idSucursalParsed) || idSucursalParsed <= 0) {
      setCajasOperativas([]);
      setLoadingCajasOperativas(false);
      return;
    }

    const cached = cajasBySucursalRef.current.get(idSucursalParsed);
    if (cached) {
      setCajasOperativas(cached);
      setLoadingCajasOperativas(false);
      return;
    }

    const requestId = cajasRequestIdRef.current + 1;
    cajasRequestIdRef.current = requestId;
    setLoadingCajasOperativas(true);
    try {
      const response = await listCajaCatalogo({ id_sucursal: idSucursalParsed });
      if (cajasRequestIdRef.current !== requestId) return;
      const rows = (Array.isArray(response) ? response : []).filter(
        (row) => row && row.id_caja && row.estado !== false
      );
      cajasBySucursalRef.current.set(idSucursalParsed, rows);
      setCajasOperativas(rows);
    } catch {
      if (cajasRequestIdRef.current !== requestId) return;
      setCajasOperativas([]);
    } finally {
      if (cajasRequestIdRef.current === requestId) {
        setLoadingCajasOperativas(false);
      }
    }
  }, [listCajaCatalogo]);

  useEffect(() => {
    if (openCajaOpen) return;
    usuariosRequestIdRef.current += 1;
    cajasRequestIdRef.current += 1;
    setLoadingUsuariosOperativos(false);
    setLoadingCajasOperativas(false);
    setUsuariosOperativos([]);
    setCajasOperativas([]);
  }, [openCajaOpen]);

  return (
    <>
      <div className="cierres-caja-page ventas-page d-flex flex-column gap-3 h-100 min-h-0">
        <CierresCajaOverview
          stats={stats}
          sesionActiva={sesionActiva}
          loading={loadingCatalogos || loadingSesiones}
          canSelectSucursal={canSelectSucursal}
          selectedSucursalId={selectedSucursalId}
          sucursales={sucursales}
          loadingSucursales={loadingSucursales}
          estadosSesion={catalogos.estados_sesion}
          filters={filters}
          onFiltersChange={setFilters}
          onSucursalChange={setSelectedSucursalId}
          onRefresh={refreshCurrentScope}
          canOpenSession={canOpenSession}
          supportsCajaCatalogCreate={canCreateCajaCatalog}
          onOpenAbrirSesion={() => {
            setOpenCajaMode('existente');
            setOpenCajaOpen(true);
          }}
          onOpenNuevaCaja={() => {
            setOpenCajaMode('nueva');
            setOpenCajaOpen(true);
          }}
        />

        <CierresCajaList
          sesiones={visibleSesiones}
          loading={loadingSesiones}
          error={error}
          canViewDetail={canViewDetail}
          canCloseSession={canCloseSession}
          canRegisterArqueo={canRegisterArqueo}
          canUseCloseFlow={canUseCloseFlow}
          onOpenDetalle={openDetalle}
          onOpenArqueo={openArqueo}
          onOpenCerrar={openCerrar}
        />
      </div>

      <CierreCajaDetalleModal
        open={detailOpen}
        detalle={selectedDetalle}
        loading={detailLoading}
        canRegisterArqueo={canRegisterArqueo}
        canCloseSession={canCloseSession}
        canUseCloseFlow={canUseCloseFlow}
        onClose={() => {
          setDetailOpen(false);
          setSelectedSesion(null);
          setSelectedDetalle(null);
        }}
        onOpenArqueo={openArqueo}
        onOpenCerrar={openCerrar}
      />

      <CierreCajaAbrirModal
        key={openCajaOpen ? 'abrir-caja-open' : 'abrir-caja-closed'}
        open={openCajaOpen}
        mode={openCajaMode}
        cajasDisponibles={cajasOperativas}
        loadingCajas={loadingCajasOperativas}
        saving={saving}
        canSelectSucursal={canSelectSucursal}
        selectedSucursalId={selectedSucursalId}
        sucursales={sucursales}
        usuariosDisponibles={usuariosOperativos}
        loadingUsuarios={loadingUsuariosOperativos}
        onRequestCajas={handleRequestCajas}
        onRequestUsuarios={handleRequestUsuarios}
        onClose={() => setOpenCajaOpen(false)}
        onSubmitOpenSesion={handleSubmitOpenSession}
        onSubmitCreateCaja={handleSubmitCreateCaja}
      />

      <CierreCajaArqueoModal
        key={arqueoOpen ? `arqueo-${selectedSesion?.id_sesion_caja || 'none'}` : 'arqueo-closed'}
        open={arqueoOpen}
        sesion={selectedSesion}
        detalle={selectedDetalle}
        tiposArqueo={catalogos.tipos_arqueo}
        saving={saving}
        onClose={() => setArqueoOpen(false)}
        onSubmit={handleSubmitArqueo}
      />

      <CierreCajaCerrarModal
        key={closeOpen ? `cierre-${selectedSesion?.id_sesion_caja || 'none'}` : 'cierre-closed'}
        open={closeOpen}
        sesion={selectedSesion}
        detalle={selectedDetalle}
        resoluciones={catalogos.resoluciones_cierre}
        saving={saving}
        canResolveDifference={canResolveDifference}
        onClose={() => setCloseOpen(false)}
        onSubmit={handleSubmitClose}
      />

      <VentasToast toast={toast} onClose={closeToast} />
    </>
  );
}
