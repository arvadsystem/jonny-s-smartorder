
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { personaService } from '../../../services/personasService';
import EntityTable from '../../../components/ui/EntityTable';
import HeaderModulo from './components/common/HeaderModulo';
import ModuleFiltros from './components/common/ModuleFiltros';
import ModuleKPICards from './components/common/ModuleKPICards';
import UsuarioCard from './components/usuarios/UsuarioCard';
import UsuarioDetailModal from './components/usuarios/UsuarioDetailModal';
import UsuarioModal from './components/usuarios/UsuarioModal';
import SearchSuggestionsDropdown from './components/common/SearchSuggestionsDropdown';
import useSearchSuggestionsDropdown, {
  MIN_CHARS_FOR_SUGGESTIONS,
  normalizeSearchText,
} from './components/common/useSearchSuggestionsDropdown';
import { buildPageRangeLabel, buildVisiblePageNumbers } from './components/common/paginationWindow';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import {
  isUsuarioDataImageUrl,
  isUsuarioRenderableImageValue,
  isUsuarioUploadsImageUrl,
} from './components/usuarios/imageSourcePolicy';

const emptyForm = {
  tipo_objetivo: 'EMPLEADO',
  id_empleado: '',
  id_cliente: '',
  id_rol: '',
  id_roles: [],
  estado: true,
};

const createInitialFiltersDraft = () => ({
  estadoFiltro: 'activo',
  sortBy: 'recientes',
});

const IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const GLOBAL_STATS_FETCH_LIMIT = 1;
const FOTO_PERFIL_MAX_LENGTH = 500;
const FOTO_PERFIL_TOO_LARGE_MESSAGE = 'La imagen supera el limite de 20 MB.';
const FOTO_PERFIL_URL_TOO_LARGE_MESSAGE = 'URL de imagen demasiado larga. Maximo 500 caracteres.';
const FOTO_PERFIL_INVALID_MESSAGE = 'Solo se permiten imagenes JPG, PNG o WEBP.';
const FOTO_PERFIL_INVALID_URL_MESSAGE = 'URL de imagen no valida. Use una ruta /uploads/...';
const FOTO_PERFIL_PROCESSING_MESSAGE = 'Procesando imagen... espere un momento.';
const FOTO_PERFIL_PROCESS_ERROR = 'No se pudo procesar la imagen seleccionada.';

const createImageDraftState = (previewUrl = '') => ({
  previewUrl: String(previewUrl || ''),
  loading: false,
  error: '',
});

const validatePhotoUrlValue = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return { ok: true, value: '' };
  if (normalized.length > FOTO_PERFIL_MAX_LENGTH) {
    return { ok: false, message: FOTO_PERFIL_URL_TOO_LARGE_MESSAGE };
  }
  if (isUsuarioUploadsImageUrl(normalized)) {
    return { ok: true, value: normalized };
  }
  return { ok: false, message: FOTO_PERFIL_INVALID_URL_MESSAGE };
};

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) return { items: resp, total: resp.length };
  const items =
    (resp && (resp.items || resp.data || resp.rows || resp.resultados || resp.usuarios || [])) || [];
  const total = Number(resp?.total || resp?.totalItems || resp?.count || resp?.total_count || items.length || 0);
  return { items: Array.isArray(items) ? items : [], total };
};

const normalizeText = (value) => String(value ?? '').trim();
const toDisplayValue = (value, fallback = 'No registrado') => normalizeText(value) || fallback;
const toImageValue = (value) => normalizeText(value);
const normalizeRoleIds = (value) => {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(source.map((item) => String(item ?? '').trim()).filter(Boolean))]
    .sort((left, right) => Number(left) - Number(right));
};
const getUsuarioRoles = (usuario) => {
  if (Array.isArray(usuario?.roles) && usuario.roles.length > 0) {
    return usuario.roles
      .map((role) => ({
        id_rol: String(role?.id_rol ?? '').trim(),
        nombre: normalizeText(role?.nombre),
      }))
      .filter((role) => role.id_rol && role.nombre);
  }

  const fallbackId = String(usuario?.rol?.id_rol ?? '').trim();
  const fallbackNombre = normalizeText(usuario?.rol?.nombre || usuario?.rol_nombre || usuario?.nombre_rol);
  if (!fallbackId || !fallbackNombre) return [];

  return [{ id_rol: fallbackId, nombre: fallbackNombre }];
};
const sameRoleSelection = (left, right) => {
  const leftIds = normalizeRoleIds(left);
  const rightIds = normalizeRoleIds(right);
  if (leftIds.length !== rightIds.length) return false;
  return leftIds.every((value, index) => value === rightIds[index]);
};

const toUpperNoAccents = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const sanitizeToken = (value) => toUpperNoAccents(value).replace(/[^A-Z0-9]/g, '');
const splitWords = (value) => normalizeText(value).split(/\s+/).map(sanitizeToken).filter(Boolean);

const buildUsernamePreview = (empleado, usedSet) => {
  if (!empleado) return '';
  const nombres = splitWords(empleado.nombre || empleado.nombre_completo || '');
  const apellidos = splitWords(empleado.apellido || empleado.nombre_completo || '');
  const base1 = sanitizeToken(`${(nombres[0] || '').slice(0, 1)}${apellidos[0] || ''}`) || `USR${empleado.id}`;
  const base2 = nombres[1]
    ? sanitizeToken(`${(nombres[0] || '').slice(0, 1)}${nombres[1].slice(0, 1)}${apellidos[0] || ''}`)
    : base1;

  if (!usedSet.has(base1)) return base1;
  if (base2 !== base1 && !usedSet.has(base2)) return base2;

  let i = 2;
  while (i <= 9999) {
    const candidate = `${base2}${i}`;
    if (!usedSet.has(candidate)) return candidate;
    i += 1;
  }
  return `${base2}9999`;
};

const parseBooleanField = (row) => {
  if (Object.prototype.hasOwnProperty.call(row || {}, 'estado')) return Boolean(row.estado);
  if (Object.prototype.hasOwnProperty.call(row || {}, 'activo')) return Boolean(row.activo);
  if (Object.prototype.hasOwnProperty.call(row || {}, 'habilitado')) return Boolean(row.habilitado);
  return true;
};

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

const readViewMode = (key) => {
  if (typeof window === 'undefined') return 'cards';
  try {
    return window.localStorage.getItem(key) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
};

const formatDateLabel = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-HN', { year: 'numeric', month: 'short', day: '2-digit' });
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });

const isValidUrlPhoto = (value) => isUsuarioUploadsImageUrl(value);
const SUGGESTION_LIMIT = 8;

export default function UsuariosTab({ openToast }) {
  const { canAny } = usePermisos();
  const canListUsuarios = canAny([PERMISSIONS.USUARIOS_LISTADO_VER, PERMISSIONS.USUARIOS_VER]);
  const canCreateUsuario = canAny([PERMISSIONS.USUARIOS_CREAR]);
  const canEditUsuario = canAny([PERMISSIONS.USUARIOS_EDITAR]);
  const canDeleteUsuario = canAny([PERMISSIONS.USUARIOS_ELIMINAR]);
  const canResetPassword = canAny([PERMISSIONS.USUARIOS_PASSWORD_RESETEAR]);
  const canReadRolesCatalog = canAny([
    PERMISSIONS.USUARIOS_ROL_ASIGNAR,
    PERMISSIONS.USUARIOS_CREAR,
    PERMISSIONS.USUARIOS_EDITAR
  ]);
  const canEditFotoUsuario = canAny([
    PERMISSIONS.USUARIOS_IMAGEN_SUBIR,
    PERMISSIONS.USUARIOS_IMAGEN_ELIMINAR
  ]);
  const canVerDetalleUsuario = canAny([PERMISSIONS.USUARIOS_DETALLE_VER, PERMISSIONS.USUARIOS_VER]);

  const safeToast = useCallback((title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  }, [openToast]);

  const [usuarios, setUsuarios] = useState([]);
  const [empleadosCatalogo, setEmpleadosCatalogo] = useState([]);
  const [clientesCatalogo, setClientesCatalogo] = useState([]);
  const [rolesCatalogo, setRolesCatalogo] = useState([]);

  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => readViewMode('usuariosViewMode'));

  const [estadoFiltro, setEstadoFiltro] = useState('activo');
  const [sortBy, setSortBy] = useState('recientes');
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const isTableView = viewMode === "table";
  const limit = isTableView ? 10 : 9;
  const [total, setTotal] = useState(0);
  const [globalStats, setGlobalStats] = useState({ total: 0, activas: 0, inactivas: 0 });

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formImage, setFormImage] = useState(() => createImageDraftState());
  const [formImageUrl, setFormImageUrl] = useState('');
  const [imageDirty, setImageDirty] = useState(false);

  const [detailUsuario, setDetailUsuario] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, idToDelete: null, nombre: '' });
  const [photoErrorModal, setPhotoErrorModal] = useState({ show: false, message: '' });
  const [createCredentialsResult, setCreateCredentialsResult] = useState(null);
  const [tempPasswordModal, setTempPasswordModal] = useState({
    show: false,
    title: '',
    password: '',
    username: '',
    revealed: false,
  });
  const closePhotoErrorModal = useCallback(() => setPhotoErrorModal({ show: false, message: '' }), []);
  const closeTempPasswordModal = useCallback(
    () => setTempPasswordModal({ show: false, title: '', password: '', username: '', revealed: false }),
    []
  );
  const openPhotoErrorModal = useCallback((message) => {
    setPhotoErrorModal({
      show: true,
      message: message || FOTO_PERFIL_TOO_LARGE_MESSAGE,
    });
  }, []);

  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const globalStatsRequestIdRef = useRef(0);
  const catalogLoadedRef = useRef(false);
  const panelRef = useRef(null);
  const imageInputRef = useRef(null);

  const getNombreCompleto = useCallback((u) =>
    normalizeText(u?.nombre_completo || u?.empleado?.nombre_completo || u?.cliente?.nombre_completo) || normalizeText(u?.nombre_usuario) || 'No registrado',
  []);
  const getSucursalNombre = useCallback((u) => normalizeText(u?.empleado?.sucursal_nombre || u?.sucursal_nombre) || 'No registrado', []);
  const getDni = useCallback((u) => normalizeText(u?.dni || u?.empleado?.dni || u?.cliente?.dni), []);
  const getTelefono = useCallback((u) => normalizeText(u?.telefono || u?.empleado?.telefono || u?.cliente?.telefono), []);
  const getCorreo = useCallback((u) => normalizeText(u?.correo || u?.empleado?.correo || u?.cliente?.correo), []);
  const getRolNombre = useCallback((u) => {
    const roles = getUsuarioRoles(u);
    if (roles.length > 0) {
      return roles.map((role) => role.nombre).join(', ');
    }
    return normalizeText(u?.rol?.nombre || u?.rol_nombre || u?.nombre_rol);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const visiblePageNumbers = useMemo(() => buildVisiblePageNumbers(page, totalPages), [page, totalPages]);
  const drawerMode = editId ? 'edit' : 'create';
  const isAnyDrawerOpen = showModal || filtersOpen;

  const empleadosConUsuario = useMemo(() => {
    const ids = new Set();
    usuarios.forEach((u) => {
      const idEmp = String(u?.id_empleado || u?.empleado?.id_empleado || '');
      if (idEmp) ids.add(idEmp);
    });
    return ids;
  }, [usuarios]);
  const clientesConUsuario = useMemo(() => {
    const ids = new Set();
    usuarios.forEach((u) => {
      const idCli = String(u?.id_cliente || u?.cliente?.id_cliente || '');
      if (idCli) ids.add(idCli);
    });
    return ids;
  }, [usuarios]);

  const usernamesInUse = useMemo(() => {
    const set = new Set();
    usuarios.forEach((u) => {
      const name = sanitizeToken(u?.nombre_usuario);
      if (name) set.add(name);
    });
    return set;
  }, [usuarios]);

  const selectedEmpleado = useMemo(
    () => empleadosCatalogo.find((e) => e.id === String(form.id_empleado)) || null,
    [empleadosCatalogo, form.id_empleado]
  );
  const selectedCliente = useMemo(
    () => clientesCatalogo.find((c) => c.id === String(form.id_cliente)) || null,
    [clientesCatalogo, form.id_cliente]
  );
  const targetType = String(form?.tipo_objetivo || 'EMPLEADO').toUpperCase() === 'CLIENTE' ? 'CLIENTE' : 'EMPLEADO';

  const generatedUsernamePreview = useMemo(() => {
    if (drawerMode !== 'create') return '';
    if (targetType === 'CLIENTE') {
      if (!selectedCliente) return '';
      return buildUsernamePreview(selectedCliente, usernamesInUse);
    }
    if (!selectedEmpleado) return '';
    return buildUsernamePreview(selectedEmpleado, usernamesInUse);
  }, [drawerMode, targetType, selectedCliente, selectedEmpleado, usernamesInUse]);

  const filteredEmpleadoOptions = useMemo(() => empleadosCatalogo, [empleadosCatalogo]);
  const filteredClienteOptions = useMemo(() => clientesCatalogo, [clientesCatalogo]);

  const sortedRoles = useMemo(
    () =>
      [...rolesCatalogo].sort((a, b) => Number(a?.id_rol ?? 0) - Number(b?.id_rol ?? 0)),
    [rolesCatalogo]
  );

  const clearImagePicker = useCallback(() => {
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, []);

  const cargarCatalogos = useCallback(async ({ force = false } = {}) => {
    if (catalogLoadedRef.current && !force) return;

    setCatalogLoading(true);
    setRolesLoading(true);
    try {
      const [empleadosResp, personasResp, clientesResp] = await Promise.all([
        personaService.getEmpleados({ page: 1, limit: 100 }),
        personaService.getPersonasDetalle({ page: 1, limit: 100 }),
        personaService.getClientes({ page: 1, limit: 200 })
      ]);

      let rolesItems = [];
      if (canReadRolesCatalog) {
        try {
          const rolesResp = await personaService.getRolesUsuariosV2();
          rolesItems = Array.isArray(rolesResp)
            ? rolesResp
            : normalizeListResponse(rolesResp).items;
        } catch (error) {
          safeToast('ERROR', error.message || 'No se pudo cargar el catalogo de roles', 'danger');
        }
      }

      if (!mountedRef.current) return;

      const empleados = normalizeListResponse(empleadosResp).items;
      const clientes = normalizeListResponse(clientesResp).items;
      const personas = normalizeListResponse(personasResp).items;
      const personaMap = new Map(personas.map((p) => [String(p?.id_persona ?? ''), p]));

      const options = empleados.map((e) => {
        const persona = personaMap.get(String(e?.id_persona ?? '')) || null;
        const nombre = normalizeText(e?.persona_nombre || persona?.nombre);
        const apellido = normalizeText(e?.persona_apellido || persona?.apellido);
        const nombreCompleto =
          normalizeText(e?.persona_nombre_completo)
          || `${nombre} ${apellido}`.trim()
          || "Empleado sin nombre";

        return {
          id: String(e?.id_empleado ?? ''),
          nombre,
          apellido,
          nombre_completo: nombreCompleto,
          correo: normalizeText(persona?.direccion_correo || persona?.correo || persona?.email),
          telefono: normalizeText(persona?.telefono || e?.telefono),
          dni: normalizeText(e?.persona_dni || persona?.dni || e?.dni),
          sucursal_nombre: normalizeText(e?.sucursal_nombre || e?.nombre_sucursal || e?.sucursal),
        };
      }).filter((row) => row.id);

      const parsedRoles = rolesItems
        .map((role) => ({
          id_rol: String(role?.id_rol ?? ''),
          nombre: normalizeText(role?.nombre),
        }))
        .filter((role) => role.id_rol && role.nombre);

      setEmpleadosCatalogo(options);
      setClientesCatalogo(
        clientes.map((c) => {
          const nombreCompleto = normalizeText(
            c?.nombre_completo
            || c?.persona_nombre_completo
            || c?.nombre_principal
            || `${c?.persona_nombre || ''} ${c?.persona_apellido || ''}`
          ) || "Cliente sin nombre";
          return {
            id: String(c?.id_cliente ?? ''),
            nombre_completo: nombreCompleto,
            nombre: normalizeText(c?.persona_nombre || c?.nombre),
            apellido: normalizeText(c?.persona_apellido || c?.apellido),
            dni: normalizeText(c?.dni || c?.persona_dni || c?.documento_valor),
            correo: normalizeText(c?.correo || c?.direccion_correo || c?.email),
            telefono: normalizeText(c?.telefono),
          };
        }).filter((row) => row.id)
      );
      setRolesCatalogo(parsedRoles);
      catalogLoadedRef.current = true;
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudieron cargar catalogos', 'danger');
    } finally {
      if (mountedRef.current) setCatalogLoading(false);
      if (mountedRef.current) setRolesLoading(false);
    }
  }, [canReadRolesCatalog, safeToast]);

  const cargarUsuarios = useCallback(async () => {
    if (!canListUsuarios) {
      if (mountedRef.current) {
        setUsuarios([]);
        setTotal(0);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    const reqId = ++requestIdRef.current;

    try {
      const estadoQuery = estadoFiltro === 'inactivo' ? false : true;
      const response = await personaService.getUsuariosV2({
        page,
        limit,
        q: debouncedSearch || '',
        estado: estadoQuery,
      });
      if (!mountedRef.current || reqId !== requestIdRef.current) return;

      const { items, total: totalResp } = normalizeListResponse(response);
      setUsuarios(items);
      setTotal(totalResp);
    } catch (error) {
      if (!mountedRef.current) return;
      setUsuarios([]);
      setTotal(0);
      safeToast('ERROR', error.message || 'No se pudo cargar usuarios', 'danger');
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) setLoading(false);
    }
  }, [canListUsuarios, page, limit, debouncedSearch, estadoFiltro, safeToast]);

  const cargarUsuariosGlobalStats = useCallback(async () => {
    if (!canListUsuarios) {
      if (mountedRef.current) {
        setGlobalStats({ total: 0, activas: 0, inactivas: 0 });
      }
      return;
    }

    const reqId = ++globalStatsRequestIdRef.current;
    try {
      const [activosResp, inactivosResp] = await Promise.all([
        personaService.getUsuariosV2({
          page: 1,
          limit: GLOBAL_STATS_FETCH_LIMIT,
          estado: true,
        }),
        personaService.getUsuariosV2({
          page: 1,
          limit: GLOBAL_STATS_FETCH_LIMIT,
          estado: false,
        }),
      ]);

      if (!mountedRef.current || reqId !== globalStatsRequestIdRef.current) return;

      const activosTotal = Math.max(0, Number(normalizeListResponse(activosResp).total) || 0);
      const inactivosTotal = Math.max(0, Number(normalizeListResponse(inactivosResp).total) || 0);
      setGlobalStats({
        total: activosTotal + inactivosTotal,
        activas: activosTotal,
        inactivas: inactivosTotal,
      });
    } catch {
      // Keep current KPI values when the stats refresh fails.
    }
  }, [canListUsuarios]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearImagePicker();
    };
  }, [clearImagePicker]);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  useEffect(() => {
    void cargarUsuariosGlobalStats();
  }, [cargarUsuariosGlobalStats]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const nextSearch = normalizeSearchText(search);
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
    if (!showModal || !editId) return;
    const current = usuarios.find((item) => String(item.id_usuario) === String(editId));
    if (!current) return;
    const currentRoles = getUsuarioRoles(current).map((role) => role.id_rol);

    setForm({
      tipo_objetivo: String(current?.id_cliente || current?.cliente?.id_cliente || '').trim() ? 'CLIENTE' : 'EMPLEADO',
      id_empleado: String(current?.id_empleado || current?.empleado?.id_empleado || ''),
      id_cliente: String(current?.id_cliente || current?.cliente?.id_cliente || ''),
      id_rol: currentRoles[0] || '',
      id_roles: currentRoles,
      estado: parseBooleanField(current),
    });
    const photoValue = toImageValue(current?.foto_perfil);
    const safePhotoValue = isUsuarioRenderableImageValue(photoValue) ? photoValue : '';
    setFormImage(createImageDraftState(safePhotoValue));
    setFormImageUrl(isValidUrlPhoto(photoValue) ? photoValue : '');
    setImageDirty(false);
    clearImagePicker();
  }, [showModal, editId, usuarios, clearImagePicker]);

  const resetFormState = useCallback(() => {
    setEditId(null);
    setForm(emptyForm);
    setErrors({});
    setFormImage(createImageDraftState(''));
    setFormImageUrl('');
    setImageDirty(false);
    setPhotoErrorModal({ show: false, message: '' });
    setCreateCredentialsResult(null);
    setTempPasswordModal({ show: false, title: '', password: '', username: '', revealed: false });
    clearImagePicker();
  }, [clearImagePicker]);

  const validateCreate = useCallback(() => {
    const currentErrors = {};
    if (targetType === 'CLIENTE') {
      if (!form.id_cliente) currentErrors.id_cliente = 'Seleccione un cliente';
      if (selectedCliente && clientesConUsuario.has(selectedCliente.id)) {
        currentErrors.id_cliente = 'Cliente ya tiene usuario';
      }
    } else {
      if (!form.id_empleado) currentErrors.id_empleado = 'Seleccione un empleado';
      if (normalizeRoleIds(form.id_roles).length === 0) currentErrors.id_roles = 'Seleccione al menos un rol';
      if (selectedEmpleado && empleadosConUsuario.has(selectedEmpleado.id)) {
        currentErrors.id_empleado = 'Empleado ya tiene usuario';
      }
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  }, [targetType, form.id_cliente, form.id_empleado, form.id_roles, selectedCliente, selectedEmpleado, clientesConUsuario, empleadosConUsuario]);

  const onFormImageChange = useCallback(async (event) => {
    if (!canEditFotoUsuario) return;
    const input = event.target;
    const file = input?.files?.[0];
    if (!file) return;

    if (!IMAGE_ALLOWED_TYPES.has(file.type)) {
      setFormImage({ previewUrl: '', loading: false, error: FOTO_PERFIL_INVALID_MESSAGE });
      setFormImageUrl('');
      setImageDirty(true);
      if (input) input.value = '';
      return;
    }

    if (file.size > IMAGE_MAX_BYTES) {
      setFormImage({ previewUrl: '', loading: false, error: FOTO_PERFIL_TOO_LARGE_MESSAGE });
      setFormImageUrl('');
      setImageDirty(true);
      if (input) input.value = '';
      return;
    }

    setFormImage((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const previewUrl = await readFileAsDataUrl(file);
      if (!previewUrl) throw new Error('EMPTY_IMAGE_PREVIEW');
      setFormImage(createImageDraftState(previewUrl));
      setFormImageUrl('');
      setImageDirty(true);
    } catch {
      setFormImage({ previewUrl: '', loading: false, error: FOTO_PERFIL_PROCESS_ERROR });
      setFormImageUrl('');
      setImageDirty(true);
    } finally {
      if (input) input.value = '';
    }
  }, [canEditFotoUsuario]);

  const onFormImageUrlChange = useCallback((event) => {
    if (!canEditFotoUsuario) return;
    const value = toImageValue(event.target.value);
    const previousUrl = formImageUrl;
    setFormImageUrl(value);
    const validation = validatePhotoUrlValue(value);

    if (!validation.ok) {
      setFormImage((prev) => ({ ...prev, loading: false, error: validation.message }));
      setImageDirty(true);
      return;
    }

    setFormImage((prev) => {
      if (validation.value) return createImageDraftState(validation.value);
      const currentPreview = toImageValue(prev.previewUrl);
      if (previousUrl && currentPreview === previousUrl) return createImageDraftState('');
      return { ...prev, error: '' };
    });
    setImageDirty(true);
  }, [canEditFotoUsuario, formImageUrl]);

  const removeFormImage = useCallback(() => {
    if (!canEditFotoUsuario) return;
    clearImagePicker();
    setFormImage(createImageDraftState(''));
    setFormImageUrl('');
    setImageDirty(true);
  }, [canEditFotoUsuario, clearImagePicker]);

  const buildPhotoChangePlan = useCallback((originalPhoto = '') => {
    if (!canEditFotoUsuario) {
      return { ok: true, shouldSend: false, value: null };
    }

    const urlValidation = validatePhotoUrlValue(formImageUrl);
    if (!urlValidation.ok) {
      return { ok: false, message: urlValidation.message };
    }

    if (formImage.loading) {
      return { ok: false, message: FOTO_PERFIL_PROCESSING_MESSAGE };
    }

    if (formImage.error) {
      return { ok: false, message: formImage.error };
    }

    if (!imageDirty) {
      return { ok: true, shouldSend: false, value: null };
    }

    const currentValue = toImageValue(originalPhoto);
    const previewValue = toImageValue(formImage.previewUrl);
    const nextValue = urlValidation.value || previewValue;

    if (nextValue && !(isUsuarioUploadsImageUrl(nextValue) || isUsuarioDataImageUrl(nextValue))) {
      return { ok: false, message: FOTO_PERFIL_INVALID_URL_MESSAGE };
    }

    if (nextValue === currentValue) {
      return { ok: true, shouldSend: false, value: null };
    }

    return { ok: true, shouldSend: true, value: nextValue || null };
  }, [canEditFotoUsuario, formImageUrl, formImage.loading, formImage.error, formImage.previewUrl, imageDirty]);

  const copiarTempPassword = useCallback(async () => {
    const text = normalizeText(tempPasswordModal.password);
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      safeToast('OK', 'Contraseña temporal copiada');
    } catch {
      safeToast('ERROR', 'No se pudo copiar la contraseña temporal', 'danger');
    }
  }, [tempPasswordModal.password, safeToast]);

  const copiarUsernameTemporal = useCallback(async () => {
    const text = normalizeText(tempPasswordModal.username);
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      safeToast('OK', 'Usuario copiado');
    } catch {
      safeToast('ERROR', 'No se pudo copiar el usuario', 'danger');
    }
  }, [tempPasswordModal.username, safeToast]);

  const toggleTempPasswordReveal = useCallback(() => {
    setTempPasswordModal((prev) => ({ ...prev, revealed: !prev.revealed }));
  }, []);

  const guardar = async (event) => {
    event.preventDefault();
    if (actionLoading) return;
    if (drawerMode === 'create' && !canCreateUsuario) return;
    if (drawerMode === 'edit' && !canEditUsuario) return;
    setActionLoading(true);

    try {
      if (drawerMode === 'create') {
        if (!validateCreate()) return;

        const photoPlan = buildPhotoChangePlan('');
        if (!photoPlan.ok) {
          setFormImage((prev) => ({ ...prev, error: photoPlan.message, loading: false }));
          openPhotoErrorModal(photoPlan.message);
          return;
        }

        const response = await personaService.generateUsuarioCredencialesV2({
          tipo_objetivo: targetType,
          id_empleado: targetType === 'EMPLEADO' ? Number.parseInt(String(form.id_empleado), 10) : undefined,
          id_cliente: targetType === 'CLIENTE' ? Number.parseInt(String(form.id_cliente), 10) : undefined,
          id_roles: targetType === 'CLIENTE'
            ? undefined
            : normalizeRoleIds(form.id_roles).map((value) => Number.parseInt(value, 10)),
        });

        if (photoPlan.shouldSend && response?.usuario?.id_usuario) {
          await personaService.updateUsuarioFotoV2(response.usuario.id_usuario, { foto_perfil: photoPlan.value });
        }

        setCreateCredentialsResult({
          nombre_usuario: response?.usuario?.nombre_usuario || generatedUsernamePreview,
        });
        const tempPassword = normalizeText(response?.temp_password);
        if (tempPassword) {
          setTempPasswordModal({
            show: true,
            title: 'Credenciales temporales',
            password: tempPassword,
            username: normalizeText(response?.usuario?.nombre_usuario || generatedUsernamePreview),
            revealed: false,
          });
        }
        setImageDirty(false);

        safeToast('OK', 'Usuario generado correctamente');

        await cargarUsuarios();
        await cargarUsuariosGlobalStats();
      } else {
        const original = usuarios.find((item) => String(item.id_usuario) === String(editId));
        if (!original) {
          safeToast('ERROR', 'No se encontro el usuario a editar', 'danger');
          await cargarUsuarios();
          return;
        }

        const photoPlan = buildPhotoChangePlan(original?.foto_perfil);
        if (!photoPlan.ok) {
          setFormImage((prev) => ({ ...prev, error: photoPlan.message, loading: false }));
          openPhotoErrorModal(photoPlan.message);
          return;
        }

        const tasks = [];
        const updatePayload = {};
        const currentRoleIds = getUsuarioRoles(original).map((role) => role.id_rol);
        const nextRoleIds = normalizeRoleIds(form.id_roles);

        if (Boolean(form.estado) !== Boolean(parseBooleanField(original))) {
          updatePayload.estado = Boolean(form.estado);
        }

        if (targetType !== 'CLIENTE' && !sameRoleSelection(nextRoleIds, currentRoleIds)) {
          updatePayload.id_roles = nextRoleIds.map((value) => Number.parseInt(value, 10));
        }

        if (Object.keys(updatePayload).length) {
          tasks.push(personaService.updateUsuarioV2(editId, updatePayload));
        }

        if (photoPlan.shouldSend) {
          tasks.push(personaService.updateUsuarioFotoV2(editId, { foto_perfil: photoPlan.value }));
        }

        if (tasks.length) {
          await Promise.all(tasks);
          safeToast('OK', 'Usuario actualizado');
        } else {
          safeToast('INFO', 'No hay cambios para guardar', 'info');
        }

        setShowModal(false);
        resetFormState();
        await cargarUsuarios();
        await cargarUsuariosGlobalStats();
      }
    } catch (error) {
      const errorMessage = String(error?.message || 'No se pudo guardar');
      const statusCode = Number(error?.status);
      const backendMessage = errorMessage.trim();
      const isSizeLimitError =
        /supera el limite de\s*20\s*MB/i.test(backendMessage) ||
        /request entity too large/i.test(backendMessage);

      if (statusCode === 413) {
        const targetMessage = isSizeLimitError
          ? FOTO_PERFIL_TOO_LARGE_MESSAGE
          : (backendMessage || 'No se pudo guardar la foto de perfil.');
        setFormImage((prev) => ({ ...prev, error: targetMessage, loading: false }));
        openPhotoErrorModal(targetMessage);
        safeToast('ERROR', targetMessage, 'danger');
      } else {
        safeToast('ERROR', backendMessage || 'No se pudo guardar', 'danger');
      }
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const resetearPasswordTemporal = useCallback(async () => {
    if (!canResetPassword) return;
    if (!editId || drawerMode !== 'edit' || resetPasswordLoading || actionLoading) return;
    setResetPasswordLoading(true);

    try {
      const response = await personaService.resetPasswordUsuarioV2(editId);
      const tempPassword = normalizeText(response?.temp_password);
      if (!tempPassword) {
        safeToast('ERROR', 'No se recibio la contraseña temporal', 'danger');
      } else {
        const fallbackUsername =
          normalizeText(
            usuarios.find((item) => String(item.id_usuario) === String(editId))?.nombre_usuario
          );
        setTempPasswordModal({
          show: true,
          title: 'Contraseña temporal regenerada',
          password: tempPassword,
          username: normalizeText(response?.nombre_usuario) || fallbackUsername,
          revealed: false,
        });
        safeToast('OK', 'Contraseña temporal regenerada');
      }
    } catch (error) {
      safeToast('ERROR', error?.message || 'No se pudo resetear la contraseña temporal', 'danger');
    } finally {
      if (mountedRef.current) setResetPasswordLoading(false);
    }
  }, [canResetPassword, editId, drawerMode, resetPasswordLoading, actionLoading, safeToast, usuarios]);

  const iniciarEdicion = (usuario) => {
    if (!canEditUsuario) return;
    setFiltersOpen(false);
    setDetailUsuario(null);
    setEditId(usuario?.id_usuario ?? null);
    setErrors({});
    setCreateCredentialsResult(null);
    setShowModal(true);
  };

  const openDetalle = (usuario) => {
    if (!canVerDetalleUsuario) return;
    setDetailUsuario(usuario);
  };

  const openCreate = () => {
    if (!canCreateUsuario) return;
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setDetailUsuario(null);
    resetFormState();
    setShowModal(true);
  };

  const openCreateEmpleadoForm = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open('/dashboard/personas?tab=empleados&create=1', '_blank', 'noopener,noreferrer');
    }
  }, []);

  const openCreateClienteForm = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.open('/dashboard/personas?tab=clientes&create=1', '_blank', 'noopener,noreferrer');
    }
  }, []);

  const refreshUsuariosCatalogs = useCallback(async () => {
    catalogLoadedRef.current = false;
    await cargarCatalogos({ force: true });
  }, [cargarCatalogos]);

  const openConfirmDelete = (usuario) => {
    if (!canDeleteUsuario) return;
    setDetailUsuario(null);
    setConfirmModal({
      show: true,
      idToDelete: usuario?.id_usuario ?? null,
      nombre: getNombreCompleto(usuario),
    });
  };

  const closeConfirmDelete = () => setConfirmModal({ show: false, idToDelete: null, nombre: '' });

  const eliminarConfirmado = async () => {
    if (!canDeleteUsuario) return;
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.updateUsuarioV2(id, { estado: false });
      if (String(editId) === String(id)) {
        setShowModal(false);
        resetFormState();
      }
      if (String(detailUsuario?.id_usuario) === String(id)) setDetailUsuario(null);

      const emptyPage = usuarios.length === 1 && page > 1;
      if (emptyPage) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarUsuarios();
      }

      safeToast('OK', 'Usuario inactivado');
      closeConfirmDelete();
      await cargarUsuariosGlobalStats();
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudo inactivar', 'danger');
      await cargarUsuarios();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const usuariosFiltrados = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const list = [...(Array.isArray(usuarios) ? usuarios : [])];

    const filtered = list.filter((usuario) => {
      const active = parseBooleanField(usuario);
      const matchEstado = estadoFiltro === 'todos' ? true : estadoFiltro === 'activo' ? active : !active;
      if (!matchEstado) return false;

      if (!needle) return true;

      const hay = [
        getNombreCompleto(usuario),
        getSucursalNombre(usuario),
        getDni(usuario),
        getTelefono(usuario),
        getCorreo(usuario),
        getRolNombre(usuario),
        usuario?.nombre_usuario,
        usuario?.fecha_creacion,
      ].filter(Boolean).join(' ').toLowerCase();

      return hay.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === 'nombre_asc') return getNombreCompleto(a).localeCompare(getNombreCompleto(b), 'es', { sensitivity: 'base' });
      if (sortBy === 'nombre_desc') return getNombreCompleto(b).localeCompare(getNombreCompleto(a), 'es', { sensitivity: 'base' });
      return Number(b?.id_usuario ?? 0) - Number(a?.id_usuario ?? 0);
    });

    return filtered;
  }, [usuarios, search, estadoFiltro, sortBy, getNombreCompleto, getSucursalNombre, getDni, getTelefono, getCorreo, getRolNombre]);
  const pageWindowLabel = useMemo(
    () => buildPageRangeLabel({ page, limit, total, currentLength: usuariosFiltrados.length }),
    [limit, page, total, usuariosFiltrados.length]
  );

  const predictiveSuggestions = useMemo(() => {
    const searchTerm = normalizeSearchText(search).toLowerCase();
    if (searchTerm.length < MIN_CHARS_FOR_SUGGESTIONS) return [];

    const source = Array.isArray(usuarios) ? usuarios : [];
    const suggestions = [];
    const seen = new Set();

    for (const usuario of source) {
      const active = parseBooleanField(usuario);
      const matchEstado = estadoFiltro === 'todos' ? true : estadoFiltro === 'activo' ? active : !active;
      if (!matchEstado) continue;

      const nombre = toDisplayValue(getNombreCompleto(usuario), 'Usuario sin nombre');
      const dni = toDisplayValue(getDni(usuario), '');
      const correo = toDisplayValue(getCorreo(usuario), '');
      const username = toDisplayValue(usuario?.nombre_usuario, '');
      const rol = toDisplayValue(getRolNombre(usuario), '');
      const haystack = [nombre, dni, correo, username, rol].join(' ').toLowerCase();
      if (!haystack.includes(searchTerm)) continue;

      const dedupeKey = normalizeText(nombre).toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const detailParts = [];
      if (dni && dni !== 'No registrado') detailParts.push(`DNI: ${dni}`);
      if (correo && correo !== 'No registrado') detailParts.push(correo);
      if (username && username !== 'No registrado') detailParts.push(`Usuario: ${username}`);

      suggestions.push({
        id: `usr-${usuario?.id_usuario ?? dedupeKey}`,
        value: nombre,
        label: nombre,
        detail: detailParts.join(' | ') || rol || 'Usuario registrado',
      });

      if (suggestions.length >= SUGGESTION_LIMIT) break;
    }

    return suggestions;
  }, [estadoFiltro, getCorreo, getDni, getNombreCompleto, getRolNombre, search, usuarios]);

  const handleSearchUpdate = useCallback((value, { source } = {}) => {
    const normalized = normalizeSearchText(value);
    setPage((prev) => (prev === 1 ? prev : 1));
    if (!normalized) {
      setDebouncedSearch('');
      return;
    }
    if (source === 'suggestion') {
      setDebouncedSearch((prev) => (prev === normalized ? prev : normalized));
    }
  }, []);

  const {
    handleSearchInputChange,
    searchDropdownRef,
    isSearchDropdownMounted,
    isSearchDropdownVisible,
    searchDropdownStyle,
    searchDropdownTitle,
    isPredictiveSearch,
    searchSuggestionItems,
    activeSuggestionIndex,
    applySearchSuggestion,
    removeRecentSearch,
    clearRecentSearches,
    recentSearchesCount,
  } = useSearchSuggestionsDropdown({
    panelRef,
    search,
    setSearch,
    committedSearch: debouncedSearch,
    onSearchUpdate: handleSearchUpdate,
    predictiveSuggestions,
    recentStorageKey: 'usuariosRecentSearchesV1',
  });

  const stats = useMemo(
    () => ({
      total: globalStats.total,
      activas: globalStats.activas,
      inactivas: globalStats.inactivas,
    }),
    [globalStats]
  );

  const hasActiveFilters = search.trim() !== '' || estadoFiltro !== 'activo' || sortBy !== 'recientes';
  const colsClass = cardsPerPage >= 6 ? 'cols-3' : cardsPerPage >= 4 ? 'cols-2' : 'cols-1';

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    setShowModal(false);
    setDetailUsuario(null);
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro === 'inactivo' ? 'inactivo' : 'activo');
    setSortBy(filtersDraft.sortBy || 'recientes');
    setFiltersOpen(false);
  };

  const clearVisualFilters = useCallback(() => {
    setEstadoFiltro('activo');
    setSortBy('recientes');
    setFiltersDraft(createInitialFiltersDraft());
  }, []);

  const closeAnyDrawer = () => {
    if (actionLoading) return;
    setShowModal(false);
    setFiltersOpen(false);
  };

  const selectedUser = usuarios.find((item) => String(item.id_usuario) === String(editId)) || null;
  const clearAllFilters = useCallback(() => {
    handleSearchInputChange('');
    clearVisualFilters();
    setFiltersOpen(false);
  }, [clearVisualFilters, handleSearchInputChange]);

  return (
    <div className="personas-page personas-page--usuarios">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3" ref={panelRef}>
        <HeaderModulo iconClass="bi bi-people-fill" title="Usuarios" subtitle="Gestion visual de usuarios" search={search}
          onSearchChange={handleSearchInputChange}
          searchPlaceholder="Buscar por nombre, usuario, sucursal, DNI, telefono o correo..."
          searchAriaLabel="Buscar usuarios" filtersOpen={filtersOpen} onOpenFilters={openFiltersDrawer}
          createOpen={showModal} onOpenCreate={openCreate} createLabel="Nuevo" canCreate={canCreateUsuario}
          filtersControlsId="usr-filtros-drawer" formControlsId="usr-form-drawer"
          viewMode={viewMode} onViewModeChange={setViewMode} />

        <SearchSuggestionsDropdown
          mounted={isSearchDropdownMounted}
          visible={isSearchDropdownVisible}
          dropdownRef={searchDropdownRef}
          dropdownStyle={searchDropdownStyle}
          title={searchDropdownTitle}
          isPredictiveSearch={isPredictiveSearch}
          recentCount={recentSearchesCount}
          items={searchSuggestionItems}
          activeIndex={activeSuggestionIndex}
          searchValue={search}
          onApplySuggestion={applySearchSuggestion}
          onRemoveRecent={removeRecentSearch}
          onClearRecent={clearRecentSearches}
        />

        <ModuleKPICards stats={stats} totalLabel="Total de usuarios" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>{loading ? 'Cargando usuarios...' : `${usuariosFiltrados.length} resultados`}</span>
            <span>{loading ? '' : `Total: ${total}`}</span>
            <label className="form-check form-switch mb-0 personas-page__inactive-toggle inv-catpro-inline-toggle">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                checked={estadoFiltro === 'inactivo'}
                onChange={(event) => {
                  const nextEstado = event.target.checked ? 'inactivo' : 'activo';
                  setEstadoFiltro(nextEstado);
                  setFiltersDraft((state) => ({ ...state, estadoFiltro: nextEstado }));
                  setPage((prev) => (prev === 1 ? prev : 1));
                }}
                aria-label="Ver inactivos"
              />
              <span className="form-check-label">Ver inactivos</span>
            </label>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? 'drawer-open' : ''}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite"><span className="spinner-border spinner-border-sm" aria-hidden="true" /><span>Cargando usuarios...</span></div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="inv-catpro-empty"><div className="inv-catpro-empty-icon"><i className="bi bi-people" /></div><div className="inv-catpro-empty-title">No hay usuarios para mostrar</div><div className="inv-catpro-empty-sub">{hasActiveFilters ? 'Prueba limpiar filtros o crea un nuevo usuario.' : 'Crea tu primer usuario.'}</div><div className="d-flex gap-2 justify-content-center flex-wrap">{hasActiveFilters ? <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>Limpiar filtros</button> : null}{canCreateUsuario ? <button type="button" className="btn btn-primary" onClick={openCreate}>Nuevo usuario</button> : null}</div></div>
            ) : viewMode === 'table' ? (
              <EntityTable>
                <table className="table personas-page__table">
                  <thead><tr><th scope="col">Usuario</th><th scope="col">Sucursal</th><th scope="col">DNI</th><th scope="col">Telefono</th><th scope="col">Nombre usuario</th><th scope="col">Fecha creacion</th><th scope="col">Estado</th><th scope="col">Codigo</th><th scope="col" className="text-end">Acciones</th></tr></thead>
                  <tbody>{usuariosFiltrados.map((usuario, idx) => { const active = parseBooleanField(usuario); const idUsuario = usuario?.id_usuario; const deleting = deletingId === idUsuario; const tableIndex = (page - 1) * limit + idx; return (<tr key={usuario?.id_usuario ?? idx} className={active ? '' : 'is-inactive-state'}><td><strong>{tableIndex + 1}. {toDisplayValue(getNombreCompleto(usuario), 'Usuario sin nombre')}</strong></td><td>{toDisplayValue(getSucursalNombre(usuario))}</td><td>{toDisplayValue(getDni(usuario), 'N/D')}</td><td>{toDisplayValue(getTelefono(usuario), 'Sin telefono')}</td><td>{toDisplayValue(usuario?.nombre_usuario, 'Sin usuario')}</td><td>{formatDateLabel(usuario?.fecha_creacion)}</td><td><span className={`inv-ins-card__badge ${active ? 'is-ok' : 'is-inactive'}`}>{active ? 'ACTIVO' : 'INACTIVO'}</span></td><td><div className="inv-catpro-code-wrap personas-page__table-code-wrap"><span className={`inv-catpro-state-dot ${active ? 'ok' : 'off'}`} /><span className="inv-catpro-code">USR-{String(idUsuario ?? '-')}</span></div></td><td className="text-end"><div className="personas-page__table-actions"><button type="button" className="inv-catpro-action inv-catpro-action-compact" onClick={() => openDetalle(usuario)} title="Ver detalle" disabled={actionLoading || deleting || !canVerDetalleUsuario}><i className="bi bi-eye" /><span className="inv-catpro-action-label">Detalle</span></button><button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => iniciarEdicion(usuario)} title="Editar" disabled={actionLoading || deleting || !canEditUsuario}><i className="bi bi-pencil-square" /><span className="inv-catpro-action-label">Editar</span></button><button type="button" className="inv-catpro-action danger inv-catpro-action-compact" onClick={() => openConfirmDelete(usuario)} title={active ? 'Inactivar' : 'Inactivo'} disabled={actionLoading || deleting || !canDeleteUsuario || !active}><i className={`bi ${deleting ? 'bi-hourglass-split' : 'bi-slash-circle'}`} /><span className="inv-catpro-action-label">{deleting ? 'Inactivando...' : 'Inactivar'}</span></button></div></td></tr>); })}</tbody>
                </table>
              </EntityTable>
            ) : (
              <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                {usuariosFiltrados.map((usuario, idx) => (
                  <UsuarioCard key={usuario?.id_usuario ?? idx} usuario={usuario} index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion} onOpenDelete={openConfirmDelete} onOpenDetail={openDetalle} canEdit={canEditUsuario} canDelete={canDeleteUsuario} canViewDetail={canVerDetalleUsuario}
                    actionLoading={actionLoading} deletingId={deletingId} />
                ))}
              </div>
            )}
          </div>

          <div className="inv-warehouse-moves__pagination inv-ins-pagination">
            <div className="inv-warehouse-moves__pagination-meta inv-ins-pagination__page">
              {`Mostrando ${pageWindowLabel} de ${total}`}
            </div>
            <div className="inv-warehouse-moves__pagination-controls">
              <button
                type="button"
                className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading || actionLoading || !!deletingId}
                aria-label="Pagina anterior"
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
                <span>Anterior</span>
              </button>

              <div className="inv-warehouse-moves__pagination-pages">
                {visiblePageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    className={`inv-warehouse-moves__page-number ${pageNumber === page ? 'is-active' : ''}`.trim()}
                    onClick={() => setPage(pageNumber)}
                    aria-label={`Ir a la pagina ${pageNumber}`}
                    aria-current={pageNumber === page ? 'page' : undefined}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>

              <div className="inv-warehouse-moves__pagination-status inv-ins-pagination__page">
                {`Pagina ${page} de ${totalPages}`}
              </div>

              <button
                type="button"
                className="inv-prod-toolbar-btn inv-warehouse-moves__page-btn"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading || actionLoading || !!deletingId}
                aria-label="Pagina siguiente"
              >
                <span>Siguiente</span>
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? 'is-hidden' : ''}`} onClick={openCreate} title="Nuevo" disabled={actionLoading || !!deletingId || !canCreateUsuario}><i className="bi bi-plus" /></button>
      <div className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`} onClick={closeAnyDrawer} aria-hidden={!isAnyDrawerOpen} />

      <ModuleFiltros open={filtersOpen} drawerId="usr-filtros-drawer" iconClass="bi bi-people-fill" title="Filtros de usuarios" subtitle="Estado y orden visual del listado" draft={filtersDraft}
        onChangeDraft={setFiltersDraft} onClose={() => setFiltersOpen(false)} onApply={applyFiltersDrawer} onClear={clearVisualFilters}
        allowAll={false} activeLabel="Activos" inactiveLabel="Inactivos" />

      <UsuarioModal
        open={showModal}
        mode={drawerMode}
        form={form}
        errors={errors}
        onFieldChange={(field, value) => {
          setForm((prev) => {
            if (field === 'tipo_objetivo') {
              const nextType = String(value || 'EMPLEADO').toUpperCase() === 'CLIENTE' ? 'CLIENTE' : 'EMPLEADO';
              return {
                ...prev,
                tipo_objetivo: nextType,
                id_empleado: nextType === 'CLIENTE' ? '' : prev.id_empleado,
                id_cliente: nextType === 'EMPLEADO' ? '' : prev.id_cliente,
                id_roles: nextType === 'CLIENTE' ? [] : prev.id_roles,
                id_rol: nextType === 'CLIENTE' ? '' : prev.id_rol
              };
            }
            if (field === 'id_roles') {
              const nextRoleIds = normalizeRoleIds(value);
              return { ...prev, id_roles: nextRoleIds, id_rol: nextRoleIds[0] || '' };
            }

            if (field === 'id_rol') {
              const nextRoleIds = normalizeRoleIds(value);
              return { ...prev, id_rol: nextRoleIds[0] || '', id_roles: nextRoleIds };
            }

            if (field === 'id_empleado') {
              return { ...prev, id_empleado: value, id_cliente: '' };
            }
            if (field === 'id_cliente') {
              return { ...prev, id_cliente: value, id_empleado: '' };
            }

            return { ...prev, [field]: value };
          });
          setErrors((prev) => ({
            ...prev,
            [field]: undefined,
            id_roles: field === 'id_roles' || field === 'id_rol' || field === 'tipo_objetivo' ? undefined : prev.id_roles,
            id_empleado: field === 'tipo_objetivo' || field === 'id_cliente' ? undefined : prev.id_empleado,
            id_cliente: field === 'tipo_objetivo' || field === 'id_empleado' ? undefined : prev.id_cliente
          }));
          if (drawerMode === 'create' && (field === 'tipo_objetivo' || field === 'id_empleado' || field === 'id_cliente' || field === 'id_rol' || field === 'id_roles')) {
            setCreateCredentialsResult(null);
            setTempPasswordModal({ show: false, title: '', password: '', username: '', revealed: false });
          }
        }}
        onSubmit={guardar}
        onResetPassword={resetearPasswordTemporal}
        onClose={() => { setShowModal(false); resetFormState(); }}
        createCredentialsResult={createCredentialsResult}
        actionLoading={actionLoading}
        resetPasswordLoading={resetPasswordLoading}
        deletingId={deletingId}
        catalogLoading={catalogLoading}
        rolesLoading={rolesLoading}
        filteredEmpleadoOptions={filteredEmpleadoOptions}
        filteredClienteOptions={filteredClienteOptions}
        empleadosConUsuario={empleadosConUsuario}
        clientesConUsuario={clientesConUsuario}
        targetType={targetType}
        generatedUsernamePreview={generatedUsernamePreview}
        empleadoDisplayName={toDisplayValue(selectedEmpleado?.nombre_completo || getNombreCompleto(selectedUser), 'No registrado')}
        clienteDisplayName={toDisplayValue(selectedCliente?.nombre_completo || getNombreCompleto(selectedUser), 'No registrado')}
        usernameDisplay={toDisplayValue(selectedUser?.nombre_usuario, 'Sin usuario')}
        sortedRoles={sortedRoles}
        formImage={formImage}
        formImageUrl={formImageUrl}
        imageInputRef={imageInputRef}
        onFormImageChange={onFormImageChange}
        onFormImageUrlChange={onFormImageUrlChange}
        onRemoveImage={removeFormImage}
        canCreate={canCreateUsuario}
        canEdit={canEditUsuario}
        canResetPassword={canResetPassword}
        canEditPhoto={canEditFotoUsuario}
        onOpenCreateEmpleado={openCreateEmpleadoForm}
        onOpenCreateCliente={openCreateClienteForm}
        onRefreshCatalogs={refreshUsuariosCatalogs}
      />

      <UsuarioDetailModal open={Boolean(detailUsuario)} usuario={detailUsuario} onClose={() => setDetailUsuario(null)} />

      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}><div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}><div className="inv-pro-confirm-head"><div className="inv-pro-confirm-head-icon"><i className="bi bi-exclamation-triangle-fill" /></div><div><div className="inv-pro-confirm-title">CONFIRMAR INACTIVACION</div><div className="inv-pro-confirm-sub">El usuario se ocultara del listado activo</div></div><button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar"><i className="bi bi-x-lg" /></button></div><div className="inv-pro-confirm-body"><div className="inv-pro-confirm-question">Deseas inactivar este usuario?</div><div className="inv-pro-confirm-name"><i className="bi bi-person-badge" /><span>{confirmModal.nombre || 'Usuario seleccionado'}</span></div></div><div className="inv-pro-confirm-footer"><button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>Cancelar</button><button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}><i className="bi bi-slash-circle" /><span>Inactivar</span></button></div></div></div>
      )}

      {tempPasswordModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeTempPasswordModal}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-key-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">{tempPasswordModal.title || 'Contraseña temporal'}</div>
                <div className="inv-pro-confirm-sub">Solo se mostrara una vez. Guardela antes de cerrar.</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeTempPasswordModal} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="inv-pro-confirm-body">
              <div className="mb-3">
                <label className="form-label mb-1">
                  <strong>Usuario</strong>
                </label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    value={tempPasswordModal.username || 'No disponible'}
                    readOnly
                  />
                  <button type="button" className="btn btn-outline-secondary" onClick={copiarUsernameTemporal}>
                    <i className="bi bi-person-badge me-1" />
                    Copiar usuario
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label mb-1">
                  <strong>Contraseña temporal</strong>
                </label>
                <div className="input-group">
                  <input
                    type={tempPasswordModal.revealed ? 'text' : 'password'}
                    className="form-control"
                    value={tempPasswordModal.password || ''}
                    readOnly
                  />
                  <button type="button" className="btn btn-outline-secondary" onClick={toggleTempPasswordReveal}>
                    <i className={`bi ${tempPasswordModal.revealed ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeTempPasswordModal}>
                Entendido
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={copiarTempPassword}>
                <i className="bi bi-clipboard" />
                <span>Copiar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {photoErrorModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closePhotoErrorModal}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">ERROR DE IMAGEN</div>
                <div className="inv-pro-confirm-sub">No se pudo guardar la foto de perfil</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closePhotoErrorModal} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">{photoErrorModal.message || FOTO_PERFIL_TOO_LARGE_MESSAGE}</div>
            </div>
            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closePhotoErrorModal}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


