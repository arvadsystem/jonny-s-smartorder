import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { personaService } from '../../../../services/personasService';

const DEFAULT_LIMIT = 9;
const DEFAULT_SELECTOR_LIMIT = 20;

const normalizeText = (value) => String(value ?? '').trim();

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) return { items: resp, total: resp.length, totalPages: 1, summary: null };
  const items =
    (resp && (resp.items || resp.data || resp.rows || resp.resultados || resp.usuarios || [])) || [];
  const total = Number(resp?.total || resp?.totalItems || resp?.count || resp?.total_count || items.length || 0);
  const totalPages = Number(resp?.totalPages || 0) || Math.max(1, Math.ceil(total / (Number(resp?.limit || 0) || items.length || 1)));
  return {
    items: Array.isArray(items) ? items : [],
    total,
    totalPages,
    summary: resp?.summary || null,
  };
};

const normalizeEmployeeRow = (row) => ({
  id: String(row?.id ?? row?.id_empleado ?? ''),
  nombre: normalizeText(row?.nombre),
  apellido: normalizeText(row?.apellido),
  nombre_completo: normalizeText(row?.nombre_completo) || 'Empleado sin nombre',
  dni: normalizeText(row?.dni),
  correo: normalizeText(row?.correo),
  telefono: normalizeText(row?.telefono),
  sucursal_nombre: normalizeText(row?.sucursal_nombre),
  has_usuario: Boolean(row?.has_usuario),
});

const normalizeClienteRow = (row) => ({
  id: String(row?.id ?? row?.id_cliente ?? ''),
  nombre: normalizeText(row?.nombre),
  apellido: normalizeText(row?.apellido),
  nombre_completo: normalizeText(row?.nombre_completo) || 'Cliente sin nombre',
  nombre_empresa: normalizeText(row?.nombre_empresa),
  dni: normalizeText(row?.dni),
  correo: normalizeText(row?.correo),
  telefono: normalizeText(row?.telefono),
  has_usuario: Boolean(row?.has_usuario),
});

const toDisplayValue = (value, fallback = 'No registrado') => {
  const text = normalizeText(value);
  return text || fallback;
};

const buildEmpleadoOptionLabel = (empleado) => {
  const nombreCompleto = toDisplayValue(empleado?.nombre_completo, 'Empleado sin nombre');
  const dni = toDisplayValue(empleado?.dni, 'N/D');
  const correo = toDisplayValue(empleado?.correo, 'Sin correo');
  return `${nombreCompleto} | DNI: ${dni} | ${correo}${empleado?.has_usuario ? ' (ya tiene usuario)' : ''}`;
};

const buildClienteOptionLabel = (cliente) => {
  const nombreCompleto = toDisplayValue(cliente?.nombre_completo, 'Cliente sin nombre');
  const dni = toDisplayValue(cliente?.dni, 'N/D');
  const correo = toDisplayValue(cliente?.correo, 'Sin correo');
  return `${nombreCompleto} | DNI: ${dni} | ${correo}${cliente?.has_usuario ? ' (ya tiene usuario)' : ''}`;
};

const buildEmpleadoOption = (empleado) => ({
  value: String(empleado.id),
  label: buildEmpleadoOptionLabel(empleado),
  isDisabled: Boolean(empleado?.has_usuario),
  meta: empleado,
});

const buildClienteOption = (cliente) => ({
  value: String(cliente.id),
  label: buildClienteOptionLabel(cliente),
  isDisabled: Boolean(cliente?.has_usuario),
  meta: cliente,
});

const readViewMode = (key) => {
  if (typeof window === 'undefined') return 'cards';
  try {
    return window.localStorage.getItem(key) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
};

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

export default function useUsuariosAdmin({
  canListUsuarios,
  canReadRolesCatalog,
  safeToast,
}) {
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const empleadosCacheRef = useRef(new Map());
  const clientesCacheRef = useRef(new Map());
  const photoOverridesRef = useRef(new Map());

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(Boolean(canListUsuarios));
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [estadoFiltro, setEstadoFiltro] = useState('activo');
  const [sortBy, setSortBy] = useState('recientes');
  const [viewMode, setViewMode] = useState(() => readViewMode('usuariosViewMode'));
  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );
  const [rolesCatalogo, setRolesCatalogo] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(Boolean(canReadRolesCatalog));
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [employeeDefaultOptions, setEmployeeDefaultOptions] = useState([]);
  const [clienteDefaultOptions, setClienteDefaultOptions] = useState([]);
  const [summary, setSummary] = useState({ total: 0, activas: 0, inactivas: 0 });

  const limit = DEFAULT_LIMIT;

  const applyUsuarioPhotoOverride = useCallback((usuario) => {
    const idUsuario = String(usuario?.id_usuario ?? '').trim();
    if (!idUsuario || !photoOverridesRef.current.has(idUsuario)) return usuario;
    const nextPhoto = normalizeText(photoOverridesRef.current.get(idUsuario));
    return {
      ...usuario,
      foto_perfil: nextPhoto,
      foto_perfil_url: nextPhoto,
      foto_url: nextPhoto,
      imagen_url: nextPhoto,
    };
  }, []);

  const rememberPhotoOverride = useCallback((idUsuario, photoValue) => {
    const key = String(idUsuario ?? '').trim();
    if (!key) return;
    photoOverridesRef.current.set(key, normalizeText(photoValue));
  }, []);

  const cacheEmpleado = useCallback((row) => {
    const normalized = normalizeEmployeeRow(row);
    if (!normalized.id) return null;
    empleadosCacheRef.current.set(normalized.id, normalized);
    return normalized;
  }, []);

  const cacheCliente = useCallback((row) => {
    const normalized = normalizeClienteRow(row);
    if (!normalized.id) return null;
    clientesCacheRef.current.set(normalized.id, normalized);
    return normalized;
  }, []);

  const loadRolesCatalog = useCallback(async () => {
    if (!canReadRolesCatalog) {
      if (mountedRef.current) setRolesLoading(false);
      return;
    }
    setRolesLoading(true);
    try {
      const rolesResp = await personaService.getRolesUsuariosV2();
      if (!mountedRef.current) return;
      const rolesItems = Array.isArray(rolesResp)
        ? rolesResp
        : normalizeListResponse(rolesResp).items;
      setRolesCatalogo(
        rolesItems
          .map((role) => ({
            id_rol: String(role?.id_rol ?? ''),
            nombre: normalizeText(role?.nombre),
          }))
          .filter((role) => role.id_rol && role.nombre)
      );
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudo cargar el catalogo de roles', 'danger');
    } finally {
      if (mountedRef.current) setRolesLoading(false);
    }
  }, [canReadRolesCatalog, safeToast]);

  const loadEmployeeOptions = useCallback(async (inputValue = '') => {
    const resp = await personaService.searchUsuariosEmpleadosCatalogV2({
      page: 1,
      limit: DEFAULT_SELECTOR_LIMIT,
      q: inputValue,
    });
    const { items } = normalizeListResponse(resp);
    return items
      .map(cacheEmpleado)
      .filter(Boolean)
      .map(buildEmpleadoOption);
  }, [cacheEmpleado]);

  const loadClienteOptions = useCallback(async (inputValue = '') => {
    const resp = await personaService.searchUsuariosClientesCatalogV2({
      page: 1,
      limit: DEFAULT_SELECTOR_LIMIT,
      q: inputValue,
    });
    const { items } = normalizeListResponse(resp);
    return items
      .map(cacheCliente)
      .filter(Boolean)
      .map(buildClienteOption);
  }, [cacheCliente]);

  const warmUpCatalogs = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [empleadosOptions, clientesOptions] = await Promise.all([
        loadEmployeeOptions(''),
        loadClienteOptions(''),
      ]);
      if (!mountedRef.current) return;
      setEmployeeDefaultOptions(empleadosOptions);
      setClienteDefaultOptions(clientesOptions);
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudieron cargar catalogos', 'danger');
    } finally {
      if (mountedRef.current) setCatalogLoading(false);
    }
  }, [loadClienteOptions, loadEmployeeOptions, safeToast]);

  const cargarUsuarios = useCallback(async () => {
    if (!canListUsuarios) {
      if (mountedRef.current) {
        setUsuarios([]);
        setTotal(0);
        setTotalPages(1);
        setSummary({ total: 0, activas: 0, inactivas: 0 });
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const reqId = ++requestIdRef.current;

    try {
      const response = await personaService.getUsuariosV2({
        page,
        limit,
        q: debouncedSearch,
        estado: estadoFiltro === 'activo' ? true : false,
        sort: sortBy,
      });

      if (!mountedRef.current || reqId !== requestIdRef.current) return;

      const { items, total: totalResp, totalPages: totalPagesResp, summary: summaryResp } = normalizeListResponse(response);
      const withPhotoOverrides = items.map((item) => applyUsuarioPhotoOverride(item));
      setUsuarios(withPhotoOverrides);
      setTotal(totalResp);
      setTotalPages(totalPagesResp);
      if (summaryResp && typeof summaryResp === 'object') {
        setSummary({
          total: Number(summaryResp.total) || 0,
          activas: Number(summaryResp.activas) || 0,
          inactivas: Number(summaryResp.inactivas) || 0,
        });
      } else {
        setSummary({
          total: totalResp,
          activas: withPhotoOverrides.filter((item) => Boolean(item?.estado)).length,
          inactivas: Math.max(0, totalResp - withPhotoOverrides.filter((item) => Boolean(item?.estado)).length),
        });
      }
    } catch (error) {
      if (!mountedRef.current || reqId !== requestIdRef.current) return;
      setUsuarios([]);
      setTotal(0);
      setTotalPages(1);
      safeToast('ERROR', error.message || 'No se pudo cargar usuarios', 'danger');
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) setLoading(false);
    }
  }, [applyUsuarioPhotoOverride, canListUsuarios, debouncedSearch, estadoFiltro, limit, page, safeToast, sortBy]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextSearch = normalizeText(search);
      setDebouncedSearch((prev) => (prev === nextSearch ? prev : nextSearch));
    }, 300);

    return () => window.clearTimeout(timerId);
  }, [search]);

  useEffect(() => {
    try {
      window.localStorage.setItem('usuariosViewMode', viewMode);
    } catch {
      // ignore storage errors
    }
  }, [viewMode]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, estadoFiltro, sortBy]);

  useEffect(() => {
    void cargarUsuarios();
  }, [cargarUsuarios]);

  useEffect(() => {
    void Promise.all([
      warmUpCatalogs(),
      loadRolesCatalog(),
    ]);
  }, [loadRolesCatalog, warmUpCatalogs]);

  const selectedEmpleadoById = useCallback((id) => {
    const key = String(id ?? '').trim();
    if (!key) return null;
    return empleadosCacheRef.current.get(key) || null;
  }, []);

  const selectedClienteById = useCallback((id) => {
    const key = String(id ?? '').trim();
    if (!key) return null;
    return clientesCacheRef.current.get(key) || null;
  }, []);

  const usernamesInUse = useMemo(() => {
    const set = new Set();
    usuarios.forEach((u) => {
      const name = normalizeText(u?.nombre_usuario)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
      if (name) set.add(name);
    });
    return set;
  }, [usuarios]);

  return {
    usuarios,
    loading,
    search,
    setSearch,
    debouncedSearch,
    page,
    setPage,
    limit,
    total,
    totalPages,
    estadoFiltro,
    setEstadoFiltro,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    cardsPerPage,
    rolesCatalogo,
    rolesLoading,
    catalogLoading,
    employeeDefaultOptions,
    clienteDefaultOptions,
    loadEmployeeOptions,
    loadClienteOptions,
    selectedEmpleadoById,
    selectedClienteById,
    cacheEmpleado,
    cacheCliente,
    rememberPhotoOverride,
    cargarUsuarios,
    usernamesInUse,
    stats: summary,
  };
}
