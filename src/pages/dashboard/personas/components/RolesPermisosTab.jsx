import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InlineLoader from "../../../../components/common/InlineLoader";
import { usePermisos } from "../../../../context/PermisosContext";
import { rolesPermisosService } from "../../../../services/rolesPermisosService";
import { PERMISSIONS } from "../../../../utils/permissions";
import "./roles-permisos-ui.css";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const FULL_FETCH_LIMIT = 500;
const LIMIT_OPTIONS = [10, 20, 50];

const PERMISSION_LABELS = {
  SEGURIDAD_VER: "Ver modulo de seguridad",
  SEGURIDAD_SESIONES_CERRAR: "Cerrar sesiones de usuarios",
  SEGURIDAD_CONFIG_EDITAR: "Editar configuracion de seguridad",
  SEGURIDAD_USUARIOS_VER: "Ver modulo de usuarios",
  SEGURIDAD_SESIONES_VER_GLOBAL: "Ver todas las sesiones activas",
  SEGURIDAD_SESIONES_CERRAR_GLOBAL: "Cerrar sesiones de usuarios global"
};

const ACTION_WORDS = {
  VER: "Ver",
  CREAR: "Crear",
  EDITAR: "Editar",
  ELIMINAR: "Eliminar",
  CERRAR: "Cerrar",
  ABRIR: "Abrir",
  LISTAR: "Listar",
  GESTIONAR: "Gestionar"
};

const RESOURCE_WORDS = {
  SEGURIDAD: "seguridad",
  SESIONES: "sesiones",
  USUARIOS: "usuarios",
  CONFIG: "configuracion",
  CONFIGURACION: "configuracion",
  INVENTARIO: "inventario",
  PERSONAS: "personas",
  PARAMETROS: "parametros",
  VENTAS: "ventas",
  COCINA: "cocina",
  SUCURSALES: "sucursales"
};

const capitalize = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const toTitleCase = (value) =>
  String(value ?? "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => capitalize(part))
    .join(" ");

const humanizeRoleName = (rawName) => toTitleCase(rawName);
const normalizeRoleCode = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
const buildRoleFormState = (role = null) => {
  const code = String(role?.nombre || "").trim();
  return {
    displayName: code ? humanizeRoleName(code) : "",
    code
  };
};

const humanizePermissionName = (technicalName) => {
  const raw = String(technicalName ?? "").trim().toUpperCase();
  if (!raw) return "Permiso sin nombre";

  if (PERMISSION_LABELS[raw]) return PERMISSION_LABELS[raw];

  const tokens = raw.split("_").filter(Boolean);
  if (!tokens.length) return "Permiso sin nombre";

  let isGlobal = false;
  if (tokens[tokens.length - 1] === "GLOBAL") {
    isGlobal = true;
    tokens.pop();
  }

  let action = null;
  const lastToken = tokens[tokens.length - 1];
  if (ACTION_WORDS[lastToken]) {
    action = ACTION_WORDS[lastToken];
    tokens.pop();
  }

  const translated = tokens.map((token) => RESOURCE_WORDS[token] || token.toLowerCase());

  if (action) {
    const [moduleName, ...rest] = translated;
    const target = rest.length > 0 ? `${rest.join(" ")} de ${moduleName}` : moduleName || "modulo";
    return `${action} ${target}${isGlobal ? " global" : ""}`;
  }

  const fallback = capitalize(translated.join(" "));
  return `${fallback}${isGlobal ? " global" : ""}`.trim();
};

const toastIconClass = (variant) => {
  if (variant === "danger") return "bi bi-exclamation-triangle-fill";
  if (variant === "warning") return "bi bi-exclamation-circle-fill";
  if (variant === "info") return "bi bi-info-circle-fill";
  return "bi bi-check-circle-fill";
};

const normalizeRoles = (rows) =>
  (Array.isArray(rows) ? rows : []).map((role) => ({
    ...role,
    id_rol: Number(role.id_rol),
    total_permisos: Number(role.total_permisos || 0)
  }));

const normalizePermisos = (rows) =>
  (Array.isArray(rows) ? rows : []).map((permiso) => ({
    ...permiso,
    id_permiso: Number(permiso.id_permiso),
    asignado: Boolean(permiso.asignado)
  }));

const ROLE_PREVIEW_GROUPS = [
  { key: 'dashboard', label: 'Dashboard', prefixes: ['DASHBOARD_'] },
  { key: 'perfil', label: 'Perfil', prefixes: ['PERFIL_'] },
  { key: 'personas', label: 'Personas', prefixes: ['PERSONAS_'] },
  { key: 'empresas', label: 'Empresas', prefixes: ['EMPRESAS_'] },
  { key: 'clientes', label: 'Clientes', prefixes: ['CLIENTES_'] },
  { key: 'empleados', label: 'Empleados', prefixes: ['EMPLEADOS_'] },
  { key: 'usuarios', label: 'Usuarios', prefixes: ['USUARIOS_'] },
  { key: 'roles', label: 'Roles y permisos', prefixes: ['ROLES_PERMISOS_'] },
  { key: 'sucursales', label: 'Sucursales', prefixes: ['SUCURSALES_'] },
  { key: 'inventario', label: 'Inventario', prefixes: ['INVENTARIO_'] },
  { key: 'ventas', label: 'Ventas', prefixes: ['VENTAS_'] },
  { key: 'cocina', label: 'Cocina', prefixes: ['COCINA_'] },
  { key: 'menu', label: 'Menu', prefixes: ['MENU_'] },
  { key: 'seguridad', label: 'Seguridad', prefixes: ['SEGURIDAD_'] },
  { key: 'parametros', label: 'Parametros', prefixes: ['PARAMETROS_'] },
  { key: 'configuracion', label: 'Configuracion', prefixes: ['CONFIGURACION_'] },
  { key: 'otros', label: 'Otros', prefixes: [] }
];

const resolvePreviewGroup = (nombrePermiso) => {
  const technicalName = String(nombrePermiso ?? '').trim().toUpperCase();
  const group =
    ROLE_PREVIEW_GROUPS.find(
      (entry) => entry.prefixes.length > 0 && entry.prefixes.some((prefix) => technicalName.startsWith(prefix))
    ) || ROLE_PREVIEW_GROUPS[ROLE_PREVIEW_GROUPS.length - 1];

  return group.key;
};

const groupPreviewPermisos = (rows) => {
  const grouped = new Map(ROLE_PREVIEW_GROUPS.map((group) => [group.key, []]));

  normalizePermisos(rows)
    .filter((permiso) => permiso.asignado)
    .sort((left, right) =>
      String(left?.nombre_permiso || '').localeCompare(String(right?.nombre_permiso || ''), 'es', {
        sensitivity: 'base'
      })
    )
    .forEach((permiso) => {
      const groupKey = resolvePreviewGroup(permiso.nombre_permiso);
      grouped.get(groupKey)?.push(permiso);
    });

  return ROLE_PREVIEW_GROUPS.map((group) => ({
    ...group,
    permisos: grouped.get(group.key) || []
  })).filter((group) => group.permisos.length > 0);
};

const normalizePagination = ({
  pagination,
  fallbackPage = 1,
  fallbackLimit = DEFAULT_LIMIT,
  fallbackTotal = 0
}) => {
  const safePage = Math.max(1, Number(pagination?.page ?? fallbackPage) || 1);

  const rawLimit = Number(pagination?.limit ?? fallbackLimit) || DEFAULT_LIMIT;
  const safeLimit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));

  const safeTotal = Math.max(0, Number(pagination?.total ?? fallbackTotal) || 0);
  const calculatedTotalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const safeTotalPages = Math.max(
    1,
    Number(pagination?.totalPages ?? calculatedTotalPages) || calculatedTotalPages
  );

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    totalPages: safeTotalPages
  };
};

const RolesPermisosTab = () => {
  const { canAny } = usePermisos();
  const canEditRolesPermisos = canAny([PERMISSIONS.ROLES_PERMISOS_EDITAR]);
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [allPermisos, setAllPermisos] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [checkedPermisos, setCheckedPermisos] = useState(new Set());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_LIMIT,
    total: 0,
    totalPages: 1
  });
  const roleDetailCacheRef = useRef(new Map());

  const [loadingRoles, setLoadingRoles] = useState(true);
  const [loadingPermisos, setLoadingPermisos] = useState(false);
  const [hydratingSelection, setHydratingSelection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({
    show: false,
    title: "",
    message: "",
    variant: "success"
  });
  const [previewRole, setPreviewRole] = useState(null);
  const [previewPermisos, setPreviewPermisos] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [activePreviewGroupKey, setActivePreviewGroupKey] = useState("");
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [roleDrawerMode, setRoleDrawerMode] = useState("create");
  const [roleForm, setRoleForm] = useState(() => buildRoleFormState());
  const [roleFormErrors, setRoleFormErrors] = useState({});
  const [roleFormSubmitting, setRoleFormSubmitting] = useState(false);
  const [roleEditingTarget, setRoleEditingTarget] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    role: null,
    impact: null,
    loading: false,
    deleting: false,
    error: ""
  });

  const openToast = useCallback((title, message, variant = "success") => {
    setToast({ show: true, title, message, variant });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  const closePreview = useCallback(() => {
    setPreviewRole(null);
    setPreviewPermisos([]);
    setPreviewLoading(false);
    setPreviewError("");
    setActivePreviewGroupKey("");
  }, []);

  const closeRoleDrawer = useCallback(() => {
    setRoleDrawerOpen(false);
    setRoleDrawerMode("create");
    setRoleEditingTarget(null);
    setRoleForm(buildRoleFormState());
    setRoleFormErrors({});
    setRoleFormSubmitting(false);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({
      open: false,
      role: null,
      impact: null,
      loading: false,
      deleting: false,
      error: ""
    });
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => closeToast(), 3500);
    return () => clearTimeout(timer);
  }, [toast.show, closeToast]);

  const loadRoles = useCallback(async (preferredRoleId = null) => {
    setLoadingRoles(true);
    setError("");

    try {
      const response = await rolesPermisosService.getRoles();
      const nextRoles = normalizeRoles(response);
      setRoles(nextRoles);

      if (!nextRoles.length) {
        setSelectedRoleId(null);
        setSelectedRole(null);
        setAllPermisos([]);
        setPermisos([]);
        setCheckedPermisos(new Set());
        return;
      }

      const preferredExists =
        preferredRoleId !== null &&
        nextRoles.some((role) => role.id_rol === Number(preferredRoleId));

      const nextRoleId = preferredExists
        ? Number(preferredRoleId)
        : Number(nextRoles[0].id_rol);

      setSelectedRoleId(nextRoleId);
    } catch (requestError) {
      setError(requestError?.message || "No se pudieron cargar los roles.");
      setRoles([]);
      setSelectedRoleId(null);
      setSelectedRole(null);
      setAllPermisos([]);
      setPermisos([]);
      setCheckedPermisos(new Set());
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const requestRolePage = useCallback(async (idRol, pageValue, limitValue, searchValue) => {
    const safePage = Math.max(1, Number(pageValue) || 1);
    const safeLimit = Math.min(FULL_FETCH_LIMIT, Math.max(1, Number(limitValue) || DEFAULT_LIMIT));
    const safeSearch = String(searchValue ?? "").trim();

    const response = await rolesPermisosService.getRolDetalle(idRol, {
      page: safePage,
      limit: safeLimit,
      search: safeSearch
    });

    const hasServerPagination = Boolean(response?.pagination);
    const responsePermisos = Array.isArray(response) ? response : response?.permisos;
    const nextPermisos = normalizePermisos(responsePermisos);
    const nextPagination = normalizePagination({
      pagination: hasServerPagination ? response?.pagination : null,
      fallbackPage: safePage,
      fallbackLimit: safeLimit,
      fallbackTotal: nextPermisos.length
    });

    return {
      rol: response?.rol || null,
      permisos: nextPermisos,
      pagination: nextPagination,
      hasServerPagination
    };
  }, []);

  const loadRoleDetail = useCallback(
    async (idRol, { force = false } = {}) => {
      if (!idRol) return null;

      const cacheKey = Number(idRol);
      if (!force && roleDetailCacheRef.current.has(cacheKey)) {
        return roleDetailCacheRef.current.get(cacheKey);
      }

      const result = await requestRolePage(cacheKey, 1, FULL_FETCH_LIMIT, "");
      const detail = {
        rol: result.rol || null,
        permisos: normalizePermisos(result.permisos)
      };
      roleDetailCacheRef.current.set(cacheKey, detail);
      return detail;
    },
    [requestRolePage]
  );

  const openRolePreview = useCallback(
    async (role) => {
      if (!role?.id_rol) return;

      setPreviewRole(role);
      setPreviewPermisos([]);
      setPreviewError("");
      setPreviewLoading(true);

      try {
        const detail = await loadRoleDetail(role.id_rol);
        const assignedPermisos = (detail?.permisos || []).filter((permiso) => permiso.asignado);
        setPreviewRole(detail?.rol || role);
        setPreviewPermisos(assignedPermisos);
      } catch (requestError) {
        setPreviewError(requestError?.message || "No se pudo cargar el detalle del rol.");
      } finally {
        setPreviewLoading(false);
      }
    },
    [loadRoleDetail]
  );

  const syncRoleMetadata = useCallback((updatedRole) => {
    if (!updatedRole?.id_rol) return;

    const normalizedRole = {
      ...updatedRole,
      id_rol: Number(updatedRole.id_rol)
    };

    setRoles((current) =>
      current.map((role) =>
        role.id_rol === normalizedRole.id_rol
          ? { ...role, ...normalizedRole }
          : role
      )
    );

    setSelectedRole((current) =>
      current?.id_rol === normalizedRole.id_rol
        ? { ...current, ...normalizedRole }
        : current
    );

    setPreviewRole((current) =>
      current?.id_rol === normalizedRole.id_rol
        ? { ...current, ...normalizedRole }
        : current
    );

    const cachedDetail = roleDetailCacheRef.current.get(normalizedRole.id_rol);
    if (cachedDetail) {
      roleDetailCacheRef.current.set(normalizedRole.id_rol, {
        ...cachedDetail,
        rol: { ...(cachedDetail.rol || {}), ...normalizedRole }
      });
    }
  }, []);

  const openCreateRoleDrawer = useCallback(() => {
    if (!canEditRolesPermisos) return;
    setRoleDrawerMode("create");
    setRoleEditingTarget(null);
    setRoleForm(buildRoleFormState());
    setRoleFormErrors({});
    setRoleDrawerOpen(true);
  }, [canEditRolesPermisos]);

  const openEditRoleDrawer = useCallback((role) => {
    if (!canEditRolesPermisos || !role?.id_rol) return;
    setRoleDrawerMode("edit");
    setRoleEditingTarget(role);
    setRoleForm(buildRoleFormState(role));
    setRoleFormErrors({});
    setRoleDrawerOpen(true);
  }, [canEditRolesPermisos]);

  const openDeleteRoleDialog = useCallback(async (role) => {
    if (!canEditRolesPermisos || !role?.id_rol) return;

    setDeleteDialog({
      open: true,
      role,
      impact: null,
      loading: true,
      deleting: false,
      error: ""
    });

    try {
      const response = await rolesPermisosService.getRoleImpact(role.id_rol);
      setDeleteDialog((current) =>
        current.open && Number(current.role?.id_rol) === Number(role.id_rol)
          ? {
            ...current,
            impact: response?.impacto || null,
            role: response?.rol || role,
            loading: false
          }
          : current
      );
    } catch (requestError) {
      setDeleteDialog((current) =>
        current.open && Number(current.role?.id_rol) === Number(role.id_rol)
          ? {
            ...current,
            loading: false,
            error: requestError?.message || "No se pudo cargar el impacto del rol."
          }
          : current
      );
    }
  }, [canEditRolesPermisos]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!selectedRoleId) return;
    let cancelled = false;

    const initializeRole = async () => {
      setLoadingPermisos(true);
      setHydratingSelection(true);
      setError("");

      try {
        const detail = await loadRoleDetail(selectedRoleId);
        if (cancelled) return;
        const nextPermisos = Array.isArray(detail?.permisos) ? detail.permisos : [];
        setSelectedRole(detail?.rol || null);
        setAllPermisos(nextPermisos);
        setCheckedPermisos(
          new Set(
            nextPermisos
              .filter((permiso) => permiso.asignado)
              .map((permiso) => Number(permiso.id_permiso))
          )
        );
        setPage(1);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError?.message || "No se pudieron cargar los permisos del rol.");
        setSelectedRole(null);
        setAllPermisos([]);
        setPermisos([]);
        setCheckedPermisos(new Set());
        setPagination((current) => ({ ...current, total: 0, totalPages: 1 }));
      } finally {
        if (!cancelled) {
          setHydratingSelection(false);
          setLoadingPermisos(false);
        }
      }
    };

    void initializeRole();
    return () => {
      cancelled = true;
    };
  }, [loadRoleDetail, selectedRoleId]);

  const filteredPermisos = useMemo(() => {
    const searchTerm = String(search || "").trim().toLowerCase();
    if (!searchTerm) return allPermisos;

    return allPermisos.filter((permiso) => {
      const technical = String(permiso?.nombre_permiso || "").toLowerCase();
      const humanized = humanizePermissionName(permiso?.nombre_permiso).toLowerCase();
      return technical.includes(searchTerm) || humanized.includes(searchTerm);
    });
  }, [allPermisos, search]);

  useEffect(() => {
    const total = filteredPermisos.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) {
      setPage(totalPages);
      return;
    }

    const offset = (page - 1) * limit;
    setPermisos(filteredPermisos.slice(offset, offset + limit));
    setPagination({
      page,
      limit,
      total,
      totalPages
    });
  }, [filteredPermisos, limit, page]);

  const currentRole = useMemo(() => {
    if (selectedRole) return selectedRole;
    return roles.find((role) => role.id_rol === selectedRoleId) || null;
  }, [roles, selectedRole, selectedRoleId]);

  const allVisibleChecked =
    permisos.length > 0 &&
    permisos.every((permiso) => checkedPermisos.has(Number(permiso.id_permiso)));

  const handleSelectRole = (idRol) => {
    if (Number(idRol) === Number(selectedRoleId)) return;
    setSearch("");
    setPage(1);
    setSelectedRole(null);
    setAllPermisos([]);
    setPermisos([]);
    setCheckedPermisos(new Set());
    setSelectedRoleId(Number(idRol));
  };

  const handleTogglePermiso = (idPermiso) => {
    if (!canEditRolesPermisos) return;
    setCheckedPermisos((current) => {
      const next = new Set(current);
      if (next.has(idPermiso)) {
        next.delete(idPermiso);
      } else {
        next.add(idPermiso);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (!canEditRolesPermisos) return;
    setCheckedPermisos((current) => {
      const next = new Set(current);
      permisos.forEach((permiso) => next.add(Number(permiso.id_permiso)));
      return next;
    });
  };

  const handleClearAllVisible = () => {
    if (!canEditRolesPermisos) return;
    setCheckedPermisos((current) => {
      const next = new Set(current);
      permisos.forEach((permiso) => next.delete(Number(permiso.id_permiso)));
      return next;
    });
  };

  const handleSearchChange = (event) => {
    const nextSearch = event.target.value;
    setSearch(nextSearch);
    setPage(1);
  };

  const handleLimitChange = (event) => {
    const nextLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(event.target.value) || DEFAULT_LIMIT)
    );

    setLimit(nextLimit);
    setPage(1);
  };

  const goToPage = (nextPage) => {
    if (!selectedRoleId) return;
    const normalizedNextPage = Math.max(1, Number(nextPage) || 1);
    if (normalizedNextPage === page) return;
    if (normalizedNextPage > pagination.totalPages) return;
    setPage(normalizedNextPage);
  };

  const handleSave = async () => {
    if (!canEditRolesPermisos) return;
    if (!selectedRoleId) return;

    setSaving(true);
    setError("");

    const permisosSeleccionados = Array.from(checkedPermisos).sort((a, b) => a - b);

    try {
      const response = await rolesPermisosService.updateRolPermisos(
        selectedRoleId,
        permisosSeleccionados
      );
      const selectedIds = new Set(permisosSeleccionados);
      const updatedPermisos = allPermisos.map((permiso) => ({
        ...permiso,
        asignado: selectedIds.has(Number(permiso.id_permiso))
      }));

      setAllPermisos(updatedPermisos);
      roleDetailCacheRef.current.set(Number(selectedRoleId), {
        rol: currentRole,
        permisos: updatedPermisos
      });

      setRoles((current) =>
        current.map((role) =>
          role.id_rol === Number(selectedRoleId)
            ? { ...role, total_permisos: permisosSeleccionados.length }
            : role
        )
      );

      openToast(
        "ACTUALIZADO",
        response?.message || "Permisos del rol actualizados correctamente.",
        "success"
      );
    } catch (requestError) {
      const message =
        requestError?.message || "No se pudieron guardar los cambios del rol seleccionado.";
      setError(message);
      openToast("ERROR", message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleFormChange = (event) => {
    const nextDisplayName = event.target.value;
    const nextCode = normalizeRoleCode(nextDisplayName);

    setRoleForm({
      displayName: nextDisplayName,
      code: nextCode
    });
    setRoleFormErrors({});
  };

  const handleRoleSubmit = async (event) => {
    event.preventDefault();
    if (!canEditRolesPermisos || roleFormSubmitting) return;

    const nextErrors = {};
    if (!String(roleForm.displayName || "").trim()) {
      nextErrors.displayName = "Ingresa el nombre del rol.";
    }
    if (!String(roleForm.code || "").trim()) {
      nextErrors.displayName = "El nombre ingresado no genera un codigo valido.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setRoleFormErrors(nextErrors);
      return;
    }

    setRoleFormSubmitting(true);

    try {
      if (roleDrawerMode === "create") {
        const response = await rolesPermisosService.createRole({ nombre: roleForm.code });
        roleDetailCacheRef.current.delete(Number(response?.rol?.id_rol));
        closeRoleDrawer();
        await loadRoles(response?.rol?.id_rol || null);
        openToast("CREADO", response?.message || "Rol creado correctamente.", "success");
        return;
      }

      const targetRoleId = Number(roleEditingTarget?.id_rol);
      const response = await rolesPermisosService.updateRoleMeta(targetRoleId, {
        nombre: roleForm.code
      });

      syncRoleMetadata(response?.rol || { id_rol: targetRoleId, nombre: roleForm.code });
      closeRoleDrawer();
      openToast("ACTUALIZADO", response?.message || "Rol actualizado correctamente.", "success");
    } catch (requestError) {
      const message = requestError?.message || "No se pudo guardar el rol.";
      setRoleFormErrors({ general: message });
      openToast("ERROR", message, "danger");
    } finally {
      setRoleFormSubmitting(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!canEditRolesPermisos || !deleteDialog.role?.id_rol || deleteDialog.deleting) return;

    setDeleteDialog((current) => ({ ...current, deleting: true, error: "" }));

    try {
      const response = await rolesPermisosService.deleteRole(deleteDialog.role.id_rol);
      const deletedRoleId = Number(deleteDialog.role.id_rol);
      roleDetailCacheRef.current.delete(deletedRoleId);

      if (Number(previewRole?.id_rol) === deletedRoleId) {
        closePreview();
      }

      closeDeleteDialog();
      await loadRoles(Number(selectedRoleId) === deletedRoleId ? null : selectedRoleId);
      openToast("ELIMINADO", response?.message || "Rol eliminado correctamente.", "success");
    } catch (requestError) {
      const message = requestError?.message || "No se pudo eliminar el rol.";
      const impacto = requestError?.data?.impacto || null;
      setDeleteDialog((current) => ({
        ...current,
        deleting: false,
        error: message,
        impact: impacto || current.impact
      }));
      openToast("ERROR", message, "danger");
    }
  };

  const selectedRoleName = humanizeRoleName(currentRole?.nombre || "Rol");
  const visibleStart = pagination.total === 0 ? 0 : (page - 1) * limit + 1;
  const visibleEnd = Math.min(page * limit, pagination.total);
  const previewGroups = useMemo(() => groupPreviewPermisos(previewPermisos), [previewPermisos]);
  const activePreviewGroup =
    previewGroups.find((group) => group.key === activePreviewGroupKey) || previewGroups[0] || null;
  const deleteImpact = deleteDialog.impact;
  const deleteBlocked = Number(deleteImpact?.total_usuarios || 0) > 0;

  useEffect(() => {
    if (previewGroups.length === 0) {
      if (activePreviewGroupKey) setActivePreviewGroupKey("");
      return;
    }

    const hasActiveGroup = previewGroups.some((group) => group.key === activePreviewGroupKey);
    if (!hasActiveGroup) {
      setActivePreviewGroupKey(previewGroups[0].key);
    }
  }, [activePreviewGroupKey, previewGroups]);

  return (
    <>
      <div className="card shadow-sm roles-permisos-shell">
        <div className="card-body p-0">
          <div className="roles-permisos-header">
            <div>
              <h4 className="mb-1">Roles y permisos</h4>
              <small className="text-muted">
                Administra que acciones puede realizar cada rol del sistema.
              </small>
            </div>

            {canEditRolesPermisos ? (
              <div className="roles-permisos-header-actions">
                <button
                  type="button"
                  className={`inv-prod-toolbar-btn roles-permisos-create-btn ${
                    roleDrawerOpen && roleDrawerMode === "create" ? "is-on" : ""
                  }`}
                  onClick={openCreateRoleDrawer}
                  title="Nuevo rol"
                  aria-expanded={roleDrawerOpen && roleDrawerMode === "create"}
                  aria-controls="roles-permisos-drawer"
                >
                  <i className="bi bi-plus-circle" />
                  <span>Nuevo</span>
                </button>
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="roles-permisos-alert">
              <div className="alert alert-danger mb-0">{error}</div>
            </div>
          ) : null}

          <div className="roles-permisos-layout">
            <aside className="roles-permisos-panel roles-permisos-panel--roles">
              <div className="roles-permisos-panel-title">Roles</div>

              {loadingRoles ? (
                <InlineLoader />
              ) : roles.length === 0 ? (
                <div className="roles-permisos-empty">
                  <p className="mb-0">No hay roles registrados.</p>
                </div>
              ) : (
                <div className="roles-permisos-roles-list">
                  {roles.map((role, index) => {
                    const isActive = Number(role.id_rol) === Number(selectedRoleId);
                    const roleName = humanizeRoleName(role.nombre);
                    const openRoleCard = () => {
                      handleSelectRole(role.id_rol);
                      void openRolePreview(role);
                    };
                    return (
                      <article
                        key={role.id_rol}
                        className={`inv-catpro-item inv-cat-card roles-permisos-role-card inv-anim-in ${
                          isActive ? "is-active" : ""
                        }`.trim()}
                        style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                        role="button"
                        tabIndex={0}
                        onClick={openRoleCard}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openRoleCard();
                          }
                        }}
                        aria-label={`Ver detalle del rol ${roleName}`}
                        aria-pressed={isActive}
                      >
                        <div className="roles-permisos-role-card__top">
                          <div className="roles-permisos-role-card__copy">
                            <span className="roles-permisos-role-card__name">{roleName}</span>
                          </div>

                          <span className="roles-permisos-role-count">
                            {Number(role.total_permisos || 0)}
                          </span>
                        </div>

                        <div className="inv-catpro-meta inv-catpro-item-footer roles-permisos-role-card__footer">
                          <div className="inv-catpro-code-wrap roles-permisos-role-card__code">
                            <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
                            <span className="inv-catpro-code">{role.nombre}</span>
                          </div>

                          <div className="inv-catpro-meta-actions inv-catpro-action-bar inv-cat-card__actions roles-permisos-role-card__actions">
                            <button
                              type="button"
                              className="inv-catpro-action inv-catpro-action-compact"
                              onClick={(event) => {
                                event.stopPropagation();
                                void openRolePreview(role);
                              }}
                              aria-label={`Ver detalle del rol ${roleName}`}
                              title="Ver detalle"
                            >
                              <i className="bi bi-eye" />
                              <span className="inv-catpro-action-label">Detalle</span>
                            </button>

                            {canEditRolesPermisos ? (
                              <button
                                type="button"
                                className="inv-catpro-action edit inv-catpro-action-compact"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditRoleDrawer(role);
                                }}
                                aria-label={`Editar rol ${roleName}`}
                                title="Editar rol"
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>
                            ) : null}

                            {canEditRolesPermisos ? (
                              <button
                                type="button"
                                className="inv-catpro-action danger inv-catpro-action-compact"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openDeleteRoleDialog(role);
                                }}
                                aria-label={`Eliminar rol ${roleName}`}
                                title="Eliminar rol"
                              >
                                <i className="bi bi-trash3" />
                                <span className="inv-catpro-action-label">Eliminar</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className="roles-permisos-panel roles-permisos-panel--permisos">
              {!selectedRoleId && !loadingRoles ? (
                <div className="roles-permisos-empty">
                  <p className="mb-0">Selecciona un rol para administrar sus permisos.</p>
                </div>
              ) : (
                <>
                  <div className="roles-permisos-panel-top">
                    <div>
                      <h5 className="mb-1">Permisos de: {selectedRoleName}</h5>
                      <small className="text-muted">
                        {checkedPermisos.size} permisos seleccionados
                      </small>
                    </div>

                    <div className="roles-permisos-actions">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleSelectAllVisible}
                        disabled={
                          permisos.length === 0 ||
                          allVisibleChecked ||
                          hydratingSelection ||
                          !canEditRolesPermisos
                        }
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleClearAllVisible}
                        disabled={
                          permisos.length === 0 ||
                          hydratingSelection ||
                          !canEditRolesPermisos
                        }
                      >
                        Quitar todos
                      </button>
                    </div>
                  </div>

                  <div className="roles-permisos-search-wrap">
                    <label className="roles-permisos-search" aria-label="Buscar permiso">
                      <i className="bi bi-search" />
                      <input
                        type="search"
                        placeholder="Buscar permiso..."
                        value={search}
                        onChange={handleSearchChange}
                        disabled={hydratingSelection}
                      />
                    </label>
                  </div>

                  <div className="roles-permisos-list">
                    {loadingPermisos ? (
                      <InlineLoader />
                    ) : permisos.length === 0 ? (
                      <div className="roles-permisos-empty">
                        <p className="mb-0">
                          {search.trim()
                            ? "No hay permisos que coincidan con la busqueda."
                            : "No hay permisos disponibles para este rol."}
                        </p>
                      </div>
                    ) : (
                      permisos.map((permiso) => {
                        const idPermiso = Number(permiso.id_permiso);
                        const checked = checkedPermisos.has(idPermiso);
                        const inputId = `permiso-${idPermiso}`;

                        return (
                          <div key={idPermiso} className="roles-permisos-item">
                            <div className="roles-permisos-item-copy">
                              <label htmlFor={inputId} className="roles-permisos-item-label">
                                {humanizePermissionName(permiso.nombre_permiso)}
                              </label>
                              <small className="roles-permisos-item-tech">
                                {permiso.nombre_permiso}
                              </small>
                            </div>

                            <div className="form-check form-switch m-0">
                              <input
                                id={inputId}
                                className="form-check-input"
                                type="checkbox"
                                role="switch"
                                checked={checked}
                                disabled={!canEditRolesPermisos}
                                onChange={() => handleTogglePermiso(idPermiso)}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="roles-permisos-pagination">
                    <div className="roles-permisos-pagination-meta">
                      {pagination.total > 0 ? (
                        <>
                          Mostrando {visibleStart}-{visibleEnd} de {pagination.total} permisos
                        </>
                      ) : (
                        "Sin resultados"
                      )}
                    </div>

                    <div className="roles-permisos-pagination-controls">
                      <label className="roles-permisos-limit">
                        <span>Por pagina</span>
                        <select
                          className="form-select form-select-sm"
                          value={limit}
                          onChange={handleLimitChange}
                          disabled={loadingPermisos || hydratingSelection}
                        >
                          {LIMIT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="roles-permisos-pagination-actions">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => goToPage(page - 1)}
                          disabled={page <= 1 || loadingPermisos || hydratingSelection}
                        >
                          Anterior
                        </button>
                        <span className="roles-permisos-page-indicator">
                          Pagina {page} de {pagination.totalPages}
                        </span>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => goToPage(page + 1)}
                          disabled={
                            page >= pagination.totalPages ||
                            loadingPermisos ||
                            hydratingSelection
                          }
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="roles-permisos-footer">
                    <button
                      type="button"
                      className="btn btn-primary roles-permisos-save-btn"
                      onClick={handleSave}
                      disabled={
                        saving ||
                        loadingPermisos ||
                        hydratingSelection ||
                        !selectedRoleId ||
                        !canEditRolesPermisos
                      }
                    >
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar cambios"
                      )}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {previewRole ? (
        <div
          className="roles-preview-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={closePreview}
        >
          <div className="roles-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="roles-preview-header">
              <div>
                <div className="roles-preview-kicker">Detalle del rol</div>
                <h5 className="mb-1">{humanizeRoleName(previewRole?.nombre || "Rol")}</h5>
                <div className="roles-preview-meta">
                  <span>Codigo: {previewRole?.nombre || "N/D"}</span>
                  <span>Total permisos: {previewPermisos.length}</span>
                </div>

                {!previewLoading && !previewError && previewGroups.length > 0 ? (
                  <div className="roles-preview-tabs" role="tablist" aria-label="Categorias del rol">
                    {previewGroups.map((group) => {
                      const isActive = group.key === activePreviewGroup?.key;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          className={`roles-preview-tab ${isActive ? "is-active" : ""}`}
                          onClick={() => setActivePreviewGroupKey(group.key)}
                        >
                          <span className="roles-preview-tab__dot" />
                          <span className="roles-preview-tab__label">{group.label}</span>
                          <span className="roles-preview-tab__count">{group.permisos.length}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                className="roles-preview-close"
                onClick={closePreview}
                aria-label="Cerrar detalle del rol"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="roles-preview-body">
              {previewLoading ? (
                <InlineLoader />
              ) : previewError ? (
                <div className="alert alert-danger mb-0">{previewError}</div>
              ) : previewGroups.length === 0 ? (
                <div className="roles-permisos-empty">
                  <p className="mb-0">Este rol no tiene permisos asignados.</p>
                </div>
              ) : (
                <section className="roles-preview-group">
                  <div className="roles-preview-group__head">
                    <strong>{activePreviewGroup?.label || "Permisos asignados"}</strong>
                    <span>{activePreviewGroup?.permisos.length || 0}</span>
                  </div>

                  <div className="roles-preview-list-shell">
                    <div className="roles-preview-group__list">
                      {(activePreviewGroup?.permisos || []).map((permiso) => (
                        <article key={permiso.id_permiso} className="roles-preview-permiso">
                          <div className="roles-preview-permiso__label">
                            {humanizePermissionName(permiso.nombre_permiso)}
                          </div>
                          <div className="roles-preview-permiso__tech">
                            {permiso.nombre_permiso}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>

            <div className="roles-preview-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={closePreview}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${roleDrawerOpen ? "show" : ""}`}
        onClick={closeRoleDrawer}
        aria-hidden={!roleDrawerOpen}
      />

      <aside
        id="roles-permisos-drawer"
        className={`inv-prod-drawer inv-cat-v2__drawer roles-permisos-drawer ${roleDrawerOpen ? "show" : ""}`}
        role={roleDrawerOpen ? "dialog" : undefined}
        aria-modal={roleDrawerOpen ? "true" : undefined}
        aria-hidden={!roleDrawerOpen}
      >
        <div className="inv-prod-drawer-head roles-permisos-drawer__head">
          <i className={`bi ${roleDrawerMode === "create" ? "bi-shield-plus" : "bi-pencil-square"} inv-cat-v2__drawer-mark`} aria-hidden="true" />
          <div>
            <div className="inv-prod-drawer-title">
              {roleDrawerMode === "create" ? "Nuevo rol" : "Editar rol"}
            </div>
            <div className="inv-prod-drawer-sub">
              Define el nombre del rol. El codigo tecnico se genera automaticamente.
            </div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close"
            onClick={closeRoleDrawer}
            title="Cerrar"
            disabled={roleFormSubmitting}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite roles-permisos-drawer__body" onSubmit={handleRoleSubmit}>
          {roleFormErrors.general ? (
            <div className="alert alert-danger mb-3">{roleFormErrors.general}</div>
          ) : null}

          <div className="mb-3">
            <label className="form-label" htmlFor="roles_nombre_visible">Nombre del rol</label>
            <input
              id="roles_nombre_visible"
              className={`form-control ${roleFormErrors.displayName ? "is-invalid" : ""}`}
              value={roleForm.displayName}
              onChange={handleRoleFormChange}
              placeholder="Ej: Auxiliar Cocina"
              disabled={roleFormSubmitting}
            />
            {roleFormErrors.displayName ? (
              <div className="invalid-feedback d-block">{roleFormErrors.displayName}</div>
            ) : null}
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="roles_codigo_preview">Codigo tecnico</label>
            <input
              id="roles_codigo_preview"
              className="form-control roles-permisos-drawer__code"
              value={roleForm.code || "Se generara automaticamente"}
              readOnly
            />
            <div className="form-text">
              Este valor se guarda en la base de datos y se usa como identificador interno del rol.
            </div>
          </div>

          <div className="d-flex gap-2 mt-4">
            <button
              type="button"
              className="btn inv-prod-btn-subtle flex-fill"
              onClick={closeRoleDrawer}
              disabled={roleFormSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn inv-prod-btn-primary flex-fill"
              disabled={roleFormSubmitting || !roleForm.code}
            >
              {roleFormSubmitting
                ? roleDrawerMode === "create"
                  ? "Creando..."
                  : "Guardando..."
                : roleDrawerMode === "create"
                  ? "Crear rol"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      </aside>

      {deleteDialog.open ? (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeDeleteDialog}>
          <div
            className="inv-pro-confirm-panel inv-pro-confirm-panel--danger roles-permisos-delete-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="inv-pro-confirm-glow" aria-hidden="true" />

            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-main">
                <div className="inv-pro-confirm-head-icon">
                  <i className="bi bi-trash3-fill" />
                </div>
                <div className="inv-pro-confirm-head-copy">
                  <div className="inv-pro-confirm-kicker">Roles y permisos</div>
                  <div className="inv-pro-confirm-title">Confirmar eliminacion</div>
                  <div className="inv-pro-confirm-sub">Esta accion es permanente sobre el rol seleccionado.</div>
                </div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeDeleteDialog} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body roles-permisos-delete-body">
              {deleteDialog.loading ? (
                <InlineLoader />
              ) : (
                <div className="roles-permisos-delete-scroll">
                  <div className="inv-pro-confirm-note">
                    <i className="bi bi-info-circle-fill" />
                    <span>
                      Si el rol no tiene usuarios asignados, se eliminaran tambien sus relaciones en permisos.
                    </span>
                  </div>

                  <div className="inv-pro-confirm-question">Deseas eliminar este rol?</div>

                  <div className="inv-pro-confirm-name">
                    <div className="inv-pro-confirm-name-label">Rol seleccionado</div>
                    <div className="inv-pro-confirm-name-value">
                      <i className="bi bi-person-badge" />
                      <span>{humanizeRoleName(deleteDialog.role?.nombre || "Rol")}</span>
                      <small>{deleteDialog.role?.nombre || "N/D"}</small>
                    </div>
                  </div>

                  <div className="roles-permisos-impact-grid">
                    <div className="roles-permisos-impact-card">
                      <span>Usuarios asignados</span>
                      <strong>{Number(deleteImpact?.total_usuarios || 0)}</strong>
                    </div>
                    <div className="roles-permisos-impact-card">
                      <span>Permisos asociados</span>
                      <strong>{Number(deleteImpact?.total_permisos || 0)}</strong>
                    </div>
                  </div>

                  {Array.isArray(deleteImpact?.usuarios) && deleteImpact.usuarios.length > 0 ? (
                    <div className="roles-permisos-impact-users">
                      <div className="roles-permisos-impact-users__title">Usuarios que deben ser reasignados antes de borrar este rol</div>
                      <ul className="roles-permisos-impact-users__list">
                        {deleteImpact.usuarios.map((usuario) => (
                          <li key={usuario.id_usuario}>
                            <i className="bi bi-person-circle" />
                            <span>{usuario.nombre_usuario}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {deleteBlocked ? (
                    <div className="alert alert-danger inv-pro-confirm-error mb-0" role="alert">
                      Este rol no se puede eliminar mientras tenga usuarios asignados. Reasignalos primero.
                    </div>
                  ) : null}

                  {deleteDialog.error ? (
                    <div className="alert alert-danger inv-pro-confirm-error mb-0" role="alert">
                      {deleteDialog.error}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeDeleteDialog} disabled={deleteDialog.deleting}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn inv-pro-btn-danger"
                onClick={handleDeleteRole}
                disabled={deleteDialog.loading || deleteDialog.deleting || deleteBlocked}
              >
                <i className={`bi ${deleteDialog.deleting ? "bi-hourglass-split" : "bi-trash3"}`} />
                <span>
                  {deleteBlocked
                    ? "Reasignar usuarios primero"
                    : deleteDialog.deleting
                      ? "Eliminando..."
                      : "Eliminar"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast.show ? (
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <div className={`inv-toast-card ${toast.variant || "success"}`}>
            <div className="inv-toast-icon">
              <i className={toastIconClass(toast.variant)} />
            </div>

            <div className="inv-toast-content">
              <div className="inv-toast-title">{toast.title}</div>
              <div className="inv-toast-message">{toast.message}</div>
            </div>

            <button
              type="button"
              className="inv-toast-close"
              onClick={closeToast}
              aria-label="Cerrar notificacion"
            >
              <i className="bi bi-x-lg" />
            </button>

            <div className="inv-toast-progress" />
          </div>
        </div>
      ) : null}
    </>
  );
};

export default RolesPermisosTab;
