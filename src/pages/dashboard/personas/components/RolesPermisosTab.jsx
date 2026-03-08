import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InlineLoader from "../../../../components/common/InlineLoader";
import { rolesPermisosService } from "../../../../services/rolesPermisosService";
import "./roles-permisos-ui.css";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
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
  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
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
  const limitRef = useRef(DEFAULT_LIMIT);

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

  const openToast = useCallback((title, message, variant = "success") => {
    setToast({ show: true, title, message, variant });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!toast.show) return undefined;
    const timer = setTimeout(() => closeToast(), 3500);
    return () => clearTimeout(timer);
  }, [toast.show, closeToast]);

  useEffect(() => {
    limitRef.current = limit;
  }, [limit]);

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
      setPermisos([]);
      setCheckedPermisos(new Set());
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  const requestRolePage = useCallback(async (idRol, pageValue, limitValue, searchValue) => {
    const safePage = Math.max(1, Number(pageValue) || 1);
    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limitValue) || DEFAULT_LIMIT));
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

  const hydrateAssignedPermisos = useCallback(async (idRol) => {
    const assigned = new Set();
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages) {
      const result = await requestRolePage(idRol, currentPage, MAX_LIMIT, "");

      result.permisos.forEach((permiso) => {
        if (permiso.asignado) {
          assigned.add(Number(permiso.id_permiso));
        }
      });

      if (!result.hasServerPagination) break;
      totalPages = Math.max(1, Number(result.pagination.totalPages || 1));
      currentPage += 1;
    }

    return assigned;
  }, [requestRolePage]);

  const loadRolePage = useCallback(
    async ({ idRol, nextPage, nextLimit, nextSearch }) => {
      if (!idRol) return;

      setLoadingPermisos(true);
      setError("");

      try {
        const result = await requestRolePage(idRol, nextPage, nextLimit, nextSearch);
        setSelectedRole(result.rol || null);
        setPermisos(result.permisos);
        setPagination(result.pagination);
        setPage(result.pagination.page);
        setLimit(result.pagination.limit);
      } catch (requestError) {
        setError(requestError?.message || "No se pudieron cargar los permisos del rol.");
        setSelectedRole(null);
        setPermisos([]);
        setPagination((current) => ({ ...current, total: 0, totalPages: 1 }));
      } finally {
        setLoadingPermisos(false);
      }
    },
    [requestRolePage]
  );

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!selectedRoleId) return;
    let cancelled = false;
    const currentLimit = limitRef.current;

    const initializeRole = async () => {
      setLoadingPermisos(true);
      setHydratingSelection(true);
      setError("");

      try {
        const initialAssigned = await hydrateAssignedPermisos(selectedRoleId);
        if (cancelled) return;
        setCheckedPermisos(initialAssigned);

        const firstPage = await requestRolePage(selectedRoleId, 1, currentLimit, "");
        if (cancelled) return;

        setSelectedRole(firstPage.rol || null);
        setPermisos(firstPage.permisos);
        setPagination(firstPage.pagination);
        setPage(firstPage.pagination.page);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError?.message || "No se pudieron cargar los permisos del rol.");
        setSelectedRole(null);
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
  }, [selectedRoleId, hydrateAssignedPermisos, requestRolePage]);

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
    setPermisos([]);
    setCheckedPermisos(new Set());
    setSelectedRoleId(Number(idRol));
  };

  const handleTogglePermiso = (idPermiso) => {
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
    setCheckedPermisos((current) => {
      const next = new Set(current);
      permisos.forEach((permiso) => next.add(Number(permiso.id_permiso)));
      return next;
    });
  };

  const handleClearAllVisible = () => {
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

    if (!selectedRoleId) return;

    void loadRolePage({
      idRol: selectedRoleId,
      nextPage: 1,
      nextLimit: limit,
      nextSearch
    });
  };

  const handleLimitChange = (event) => {
    const nextLimit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(event.target.value) || DEFAULT_LIMIT)
    );

    setLimit(nextLimit);
    setPage(1);

    if (!selectedRoleId) return;

    void loadRolePage({
      idRol: selectedRoleId,
      nextPage: 1,
      nextLimit,
      nextSearch: search
    });
  };

  const goToPage = (nextPage) => {
    if (!selectedRoleId) return;
    const normalizedNextPage = Math.max(1, Number(nextPage) || 1);
    if (normalizedNextPage === page) return;
    if (normalizedNextPage > pagination.totalPages) return;

    setPage(normalizedNextPage);

    void loadRolePage({
      idRol: selectedRoleId,
      nextPage: normalizedNextPage,
      nextLimit: limit,
      nextSearch: search
    });
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;

    setSaving(true);
    setError("");

    const permisosSeleccionados = Array.from(checkedPermisos).sort((a, b) => a - b);

    try {
      const response = await rolesPermisosService.updateRolPermisos(
        selectedRoleId,
        permisosSeleccionados
      );

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

  const selectedRoleName = humanizeRoleName(currentRole?.nombre || "Rol");
  const visibleStart = pagination.total === 0 ? 0 : (page - 1) * limit + 1;
  const visibleEnd = Math.min(page * limit, pagination.total);

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
                  {roles.map((role) => {
                    const isActive = Number(role.id_rol) === Number(selectedRoleId);
                    return (
                      <button
                        key={role.id_rol}
                        type="button"
                        className={`roles-permisos-role-item ${isActive ? "is-active" : ""}`}
                        onClick={() => handleSelectRole(role.id_rol)}
                      >
                        <div className="roles-permisos-role-copy">
                          <span className="roles-permisos-role-name">
                            {humanizeRoleName(role.nombre)}
                          </span>
                          <small className="roles-permisos-role-tech">{role.nombre}</small>
                        </div>
                        <span className="roles-permisos-role-count">
                          {Number(role.total_permisos || 0)}
                        </span>
                      </button>
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
                        disabled={permisos.length === 0 || allVisibleChecked || hydratingSelection}
                      >
                        Seleccionar todos
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleClearAllVisible}
                        disabled={permisos.length === 0 || hydratingSelection}
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
                      disabled={saving || loadingPermisos || hydratingSelection || !selectedRoleId}
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
