
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { personaService } from '../../../services/personasService';
import EntityTable from '../../../components/ui/EntityTable';
import HeaderModulo from './components/common/HeaderModulo';
import ModuleFiltros from './components/common/ModuleFiltros';
import ModuleKPICards from './components/common/ModuleKPICards';
import UsuarioCard from './components/usuarios/UsuarioCard';
import UsuarioDetailModal from './components/usuarios/UsuarioDetailModal';
import UsuarioModal from './components/usuarios/UsuarioModal';
import { usePermisos } from '../../../context/PermisosContext';
import { PERMISSIONS } from '../../../utils/permissions';
import {
  isUsuarioDataImageUrl,
  isUsuarioRenderableImageValue,
  isUsuarioUploadsImageUrl,
} from './components/usuarios/imageSourcePolicy';

const emptyForm = {
  id_empleado: '',
  id_rol: '',
  estado: true,
};

const createInitialFiltersDraft = () => ({
  estadoFiltro: 'todos',
  sortBy: 'recientes',
});

const IMAGE_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;
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

export default function UsuariosTab({ openToast }) {
  const { canAny } = usePermisos();
  const canCreateUsuario = canAny([PERMISSIONS.USUARIOS_CREAR]);
  const canEditUsuario = canAny([PERMISSIONS.USUARIOS_EDITAR]);
  const canDeleteUsuario = canAny([PERMISSIONS.USUARIOS_ELIMINAR]);
  const canResetPassword = canAny([PERMISSIONS.USUARIOS_PASSWORD_RESETEAR]);
  const canEditFotoUsuario = canAny([PERMISSIONS.USUARIOS_FOTO_EDITAR]);
  const canVerDetalleUsuario = canAny([PERMISSIONS.USUARIOS_VER]);

  const safeToast = useCallback((title, message, variant = 'success') => {
    if (typeof openToast === 'function') openToast(title, message, variant);
  }, [openToast]);

  const [usuarios, setUsuarios] = useState([]);
  const [empleadosCatalogo, setEmpleadosCatalogo] = useState([]);
  const [rolesCatalogo, setRolesCatalogo] = useState([]);

  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => readViewMode('usuariosViewMode'));

  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [sortBy, setSortBy] = useState('recientes');
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

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
  const catalogLoadedRef = useRef(false);
  const imageInputRef = useRef(null);

  const getNombreCompleto = useCallback((u) =>
    normalizeText(u?.empleado?.nombre_completo || u?.nombre_completo || `${u?.nombre || ''} ${u?.apellido || ''}`) || 'No registrado',
  []);
  const getSucursalNombre = useCallback((u) => normalizeText(u?.empleado?.sucursal_nombre || u?.sucursal_nombre) || 'No registrado', []);
  const getDni = useCallback((u) => normalizeText(u?.empleado?.dni || u?.dni), []);
  const getTelefono = useCallback((u) => normalizeText(u?.empleado?.telefono || u?.telefono), []);
  const getCorreo = useCallback((u) => normalizeText(u?.empleado?.correo || u?.correo), []);
  const getRolNombre = useCallback((u) => normalizeText(u?.rol?.nombre || u?.rol_nombre || u?.nombre_rol), []);

  const totalPages = Math.max(1, Math.ceil(total / limit));
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

  const generatedUsernamePreview = useMemo(() => {
    if (drawerMode !== 'create' || !selectedEmpleado) return '';
    return buildUsernamePreview(selectedEmpleado, usernamesInUse);
  }, [drawerMode, selectedEmpleado, usernamesInUse]);

  const filteredEmpleadoOptions = useMemo(() => empleadosCatalogo, [empleadosCatalogo]);

  const sortedRoles = useMemo(
    () =>
      [...rolesCatalogo].sort((a, b) => Number(a?.id_rol ?? 0) - Number(b?.id_rol ?? 0)),
    [rolesCatalogo]
  );

  const clearImagePicker = useCallback(() => {
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, []);

  const cargarCatalogos = useCallback(async () => {
    if (catalogLoadedRef.current) return;

    setCatalogLoading(true);
    setRolesLoading(true);
    try {
      const [empleadosResp, personasResp, rolesResp] = await Promise.all([
        personaService.getEmpleados({ page: 1, limit: 100 }),
        personaService.getPersonasDetalle({ page: 1, limit: 100 }),
        personaService.getRolesUsuariosV2(),
      ]);

      if (!mountedRef.current) return;

      const empleados = normalizeListResponse(empleadosResp).items;
      const personas = normalizeListResponse(personasResp).items;
      const personaMap = new Map(personas.map((p) => [String(p?.id_persona ?? ''), p]));

      const options = empleados.map((e) => {
        const persona = personaMap.get(String(e?.id_persona ?? '')) || null;
        const nombre = normalizeText(e?.persona_nombre || persona?.nombre);
        const apellido = normalizeText(e?.persona_apellido || persona?.apellido);
        const nombreCompleto =
          normalizeText(e?.persona_nombre_completo)
          || `${nombre} ${apellido}`.trim()
          || `Empleado #${e?.id_empleado ?? 'N/D'}`;

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

      const rolesItems = Array.isArray(rolesResp)
        ? rolesResp
        : normalizeListResponse(rolesResp).items;

      const parsedRoles = rolesItems
        .map((role) => ({
          id_rol: String(role?.id_rol ?? ''),
          nombre: normalizeText(role?.nombre),
        }))
        .filter((role) => role.id_rol && role.nombre);

      setEmpleadosCatalogo(options);
      setRolesCatalogo(parsedRoles);
      catalogLoadedRef.current = true;
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudieron cargar catalogos', 'danger');
    } finally {
      if (mountedRef.current) setCatalogLoading(false);
      if (mountedRef.current) setRolesLoading(false);
    }
  }, [safeToast]);

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    const reqId = ++requestIdRef.current;

    try {
      const response = await personaService.getUsuariosV2({ page, limit, q: search?.trim() || '' });
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
  }, [page, limit, search, safeToast]);

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
    setPage(1);
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

    setForm({
      id_empleado: String(current?.id_empleado || current?.empleado?.id_empleado || ''),
      id_rol: String(current?.rol?.id_rol || ''),
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
    if (!form.id_empleado) currentErrors.id_empleado = 'Seleccione un empleado';
    if (!form.id_rol) currentErrors.id_rol = 'Seleccione un rol';
    if (selectedEmpleado && empleadosConUsuario.has(selectedEmpleado.id)) {
      currentErrors.id_empleado = 'Empleado ya tiene usuario';
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  }, [form.id_empleado, form.id_rol, selectedEmpleado, empleadosConUsuario]);

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
      safeToast('OK', 'Contrasena temporal copiada');
    } catch {
      safeToast('ERROR', 'No se pudo copiar la contrasena temporal', 'danger');
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
          id_empleado: Number.parseInt(String(form.id_empleado), 10),
          id_rol: Number.parseInt(String(form.id_rol), 10),
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
        const currentRoleId = String(original?.rol?.id_rol || '');

        if (Boolean(form.estado) !== Boolean(parseBooleanField(original))) {
          updatePayload.estado = Boolean(form.estado);
        }

        if (String(form.id_rol || '') && String(form.id_rol || '') !== currentRoleId) {
          updatePayload.id_rol = Number.parseInt(String(form.id_rol), 10);
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
        safeToast('ERROR', 'No se recibio la contrasena temporal', 'danger');
      } else {
        const fallbackUsername =
          normalizeText(
            usuarios.find((item) => String(item.id_usuario) === String(editId))?.nombre_usuario
          );
        setTempPasswordModal({
          show: true,
          title: 'Contrasena temporal regenerada',
          password: tempPassword,
          username: normalizeText(response?.nombre_usuario) || fallbackUsername,
          revealed: false,
        });
        safeToast('OK', 'Contrasena temporal regenerada');
      }
    } catch (error) {
      safeToast('ERROR', error?.message || 'No se pudo resetear la contrasena temporal', 'danger');
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
      await personaService.deleteUsuarioV2(id);
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

      safeToast('OK', 'Usuario eliminado');
      closeConfirmDelete();
    } catch (error) {
      safeToast('ERROR', error.message || 'No se pudo eliminar', 'danger');
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

  const stats = useMemo(() => {
    const totalRows = usuariosFiltrados.length;
    const activas = usuariosFiltrados.filter((u) => parseBooleanField(u)).length;
    return { total: totalRows, activas, inactivas: totalRows - activas };
  }, [usuariosFiltrados]);

  const hasActiveFilters = search.trim() !== '' || estadoFiltro !== 'todos' || sortBy !== 'recientes';
  const colsClass = cardsPerPage >= 6 ? 'cols-3' : cardsPerPage >= 4 ? 'cols-2' : 'cols-1';

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    setShowModal(false);
    setDetailUsuario(null);
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro || 'todos');
    setSortBy(filtersDraft.sortBy || 'recientes');
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro('todos');
    setSortBy('recientes');
    setFiltersDraft(createInitialFiltersDraft());
  };

  const closeAnyDrawer = () => {
    if (actionLoading) return;
    setShowModal(false);
    setFiltersOpen(false);
  };

  const selectedUser = usuarios.find((item) => String(item.id_usuario) === String(editId)) || null;

  return (
    <div className="personas-page">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3">
        <HeaderModulo iconClass="bi bi-people-fill" title="Usuarios" subtitle="Gestion visual de usuarios" search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre, usuario, sucursal, DNI, telefono o correo..."
          searchAriaLabel="Buscar usuarios" filtersOpen={filtersOpen} onOpenFilters={openFiltersDrawer}
          createOpen={showModal} onOpenCreate={openCreate} createLabel="Nuevo" canCreate={canCreateUsuario}
          filtersControlsId="usr-filtros-drawer" formControlsId="usr-form-drawer"
          viewMode={viewMode} onViewModeChange={setViewMode} />

        <ModuleKPICards stats={stats} totalLabel="Total de usuarios" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>{loading ? 'Cargando usuarios...' : `${usuariosFiltrados.length} resultados`}</span>
            <span>{loading ? '' : `Total: ${total}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? 'drawer-open' : ''}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite"><span className="spinner-border spinner-border-sm" aria-hidden="true" /><span>Cargando usuarios...</span></div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="inv-catpro-empty"><div className="inv-catpro-empty-icon"><i className="bi bi-people" /></div><div className="inv-catpro-empty-title">No hay usuarios para mostrar</div><div className="inv-catpro-empty-sub">{hasActiveFilters ? 'Prueba limpiar filtros o crea un nuevo usuario.' : 'Crea tu primer usuario.'}</div><div className="d-flex gap-2 justify-content-center flex-wrap">{hasActiveFilters ? <button type="button" className="btn btn-outline-secondary" onClick={() => { setSearch(''); clearVisualFilters(); }}>Limpiar filtros</button> : null}{canCreateUsuario ? <button type="button" className="btn btn-primary" onClick={openCreate}>Nuevo usuario</button> : null}</div></div>
            ) : viewMode === 'table' ? (
              <EntityTable>
                <table className="table personas-page__table">
                  <thead><tr><th scope="col">Usuario</th><th scope="col">Sucursal</th><th scope="col">DNI</th><th scope="col">Telefono</th><th scope="col">Nombre usuario</th><th scope="col">Fecha creacion</th><th scope="col">Estado</th><th scope="col">Codigo</th><th scope="col" className="text-end">Acciones</th></tr></thead>
                  <tbody>{usuariosFiltrados.map((usuario, idx) => { const active = parseBooleanField(usuario); const idUsuario = usuario?.id_usuario; const deleting = deletingId === idUsuario; const tableIndex = (page - 1) * limit + idx; return (<tr key={usuario?.id_usuario ?? idx} className={active ? '' : 'is-inactive-state'}><td><strong>{tableIndex + 1}. {toDisplayValue(getNombreCompleto(usuario), 'Usuario sin nombre')}</strong></td><td>{toDisplayValue(getSucursalNombre(usuario))}</td><td>{toDisplayValue(getDni(usuario), 'N/D')}</td><td>{toDisplayValue(getTelefono(usuario), 'Sin telefono')}</td><td>{toDisplayValue(usuario?.nombre_usuario, 'Sin usuario')}</td><td>{formatDateLabel(usuario?.fecha_creacion)}</td><td><span className={`inv-ins-card__badge ${active ? 'is-ok' : 'is-inactive'}`}>{active ? 'ACTIVO' : 'INACTIVO'}</span></td><td><div className="inv-catpro-code-wrap personas-page__table-code-wrap"><span className={`inv-catpro-state-dot ${active ? 'ok' : 'off'}`} /><span className="inv-catpro-code">USR-{String(idUsuario ?? '-')}</span></div></td><td className="text-end"><div className="personas-page__table-actions"><button type="button" className="inv-catpro-action inv-catpro-action-compact" onClick={() => openDetalle(usuario)} title="Ver detalle" disabled={actionLoading || deleting || !canVerDetalleUsuario}><i className="bi bi-eye" /><span className="inv-catpro-action-label">Detalle</span></button><button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => iniciarEdicion(usuario)} title="Editar" disabled={actionLoading || deleting || !canEditUsuario}><i className="bi bi-pencil-square" /><span className="inv-catpro-action-label">Editar</span></button><button type="button" className="inv-catpro-action danger inv-catpro-action-compact" onClick={() => openConfirmDelete(usuario)} title="Eliminar" disabled={actionLoading || deleting || !canDeleteUsuario}><i className={`bi ${deleting ? 'bi-hourglass-split' : 'bi-trash'}`} /><span className="inv-catpro-action-label">{deleting ? 'Eliminando...' : 'Eliminar'}</span></button></div></td></tr>); })}</tbody>
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

          <div className="personas-page__pagination">
            <button type="button" className="btn btn-outline-secondary" disabled={page === 1 || loading || actionLoading || !!deletingId} onClick={() => setPage((prev) => prev - 1)}><i className="bi bi-chevron-left me-1" />Anterior</button>
            <span>Pagina {page} de {totalPages}</span>
            <button type="button" className="btn btn-outline-secondary" disabled={page >= totalPages || loading || actionLoading || !!deletingId} onClick={() => setPage((prev) => prev + 1)}>Siguiente<i className="bi bi-chevron-right ms-1" /></button>
          </div>
        </div>
      </div>

      <button type="button" className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? 'is-hidden' : ''}`} onClick={openCreate} title="Nuevo" disabled={actionLoading || !!deletingId || !canCreateUsuario}><i className="bi bi-plus" /></button>
      <div className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`} onClick={closeAnyDrawer} aria-hidden={!isAnyDrawerOpen} />

      <ModuleFiltros open={filtersOpen} drawerId="usr-filtros-drawer" iconClass="bi bi-people-fill" title="Filtros de usuarios" subtitle="Estado y orden visual del listado" draft={filtersDraft}
        onChangeDraft={setFiltersDraft} onClose={() => setFiltersOpen(false)} onApply={applyFiltersDrawer} onClear={clearVisualFilters}
        allLabel="Todos" activeLabel="Activos" inactiveLabel="Inactivos" />

      <UsuarioModal
        open={showModal}
        mode={drawerMode}
        form={form}
        errors={errors}
        onFieldChange={(field, value) => {
          setForm((prev) => ({ ...prev, [field]: value }));
          setErrors((prev) => ({ ...prev, [field]: undefined }));
          if (drawerMode === 'create' && (field === 'id_empleado' || field === 'id_rol')) {
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
        empleadosConUsuario={empleadosConUsuario}
        generatedUsernamePreview={generatedUsernamePreview}
        empleadoDisplayName={toDisplayValue(selectedEmpleado?.nombre_completo || getNombreCompleto(selectedUser), 'No registrado')}
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
      />

      <UsuarioDetailModal open={Boolean(detailUsuario)} usuario={detailUsuario} onClose={() => setDetailUsuario(null)} />

      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}><div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}><div className="inv-pro-confirm-head"><div className="inv-pro-confirm-head-icon"><i className="bi bi-exclamation-triangle-fill" /></div><div><div className="inv-pro-confirm-title">CONFIRMAR ELIMINACION</div><div className="inv-pro-confirm-sub">Esta accion es permanente</div></div><button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar"><i className="bi bi-x-lg" /></button></div><div className="inv-pro-confirm-body"><div className="inv-pro-confirm-question">Deseas eliminar este usuario?</div><div className="inv-pro-confirm-name"><i className="bi bi-person-badge" /><span>{confirmModal.nombre || 'Usuario seleccionado'}</span></div></div><div className="inv-pro-confirm-footer"><button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>Cancelar</button><button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}><i className="bi bi-trash3" /><span>Eliminar</span></button></div></div></div>
      )}

      {tempPasswordModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeTempPasswordModal}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-key-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">{tempPasswordModal.title || 'Contrasena temporal'}</div>
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
                  <strong>Contrasena temporal</strong>
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


