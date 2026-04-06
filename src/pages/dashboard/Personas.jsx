import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SinPermiso from "../../components/common/SinPermiso";
import { usePermisos } from "../../context/PermisosContext";
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from "../../utils/permissions";
import sucursalesService from "../../services/sucursalesService";

import PersonasTab from "./personas/PersonasTab";
import EmpresasTab from "./personas/EmpresasTab";
import EmpleadosTab from "./personas/EmpleadosTab";
import UsuariosTab from "./personas/UsuariosTab";
import ClientesTab from "./personas/ClientesTab";
import RolesPermisosTab from "./personas/components/RolesPermisosTab";

const PERSONAS_TAB_KEYS = [
  "personas",
  "empresas",
  "empleados",
  "usuarios",
  "clientes",
  "roles",
];

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeSucursalList = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

export default function Personas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();
  const [sucursales, setSucursales] = useState([]);
  const [sucursalesLoading, setSucursalesLoading] = useState(false);

  const [toast, setToast] = useState({
    show: false,
    title: "",
    message: "",
    variant: "success",
  });

  const allowedTabs = useMemo(
    () => getAllowedTabs("personas", permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0] || null;
  const selectedSucursalId = useMemo(() => {
    const parsed = parsePositiveInt(searchParams.get("sucursal"));
    return parsed ? String(parsed) : "";
  }, [searchParams]);

  const applySucursalContext = useCallback(
    (nextSucursalId) => {
      const next = new URLSearchParams(searchParams);
      const normalized = parsePositiveInt(nextSucursalId);

      if (normalized) {
        next.set("sucursal", String(normalized));
      } else {
        next.delete("sucursal");
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const t = (searchParams.get("tab") || fallbackTab).toLowerCase();
    return allowedTabs.includes(t) ? t : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  const isPlanillasTab = activeTab === "planillas";

  useEffect(() => {
    if (permisosLoading || !activeTab) return;
    const rawTab = (searchParams.get("tab") || "").toLowerCase();
    if (rawTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    if (!next.has("sucursal") && selectedSucursalId) {
      next.set("sucursal", selectedSucursalId);
    }
    setSearchParams(next, { replace: true });
  }, [activeTab, permisosLoading, searchParams, selectedSucursalId, setSearchParams]);

  useEffect(() => {
    let active = true;

    const loadSucursales = async () => {
      setSucursalesLoading(true);
      try {
        const response = await sucursalesService.getAll();
        if (!active) return;
        const next = normalizeSucursalList(response);
        setSucursales(next);
      } catch {
        if (!active) return;
        setSucursales([]);
      } finally {
        if (active) setSucursalesLoading(false);
      }
    };

    loadSucursales();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (sucursalesLoading || selectedSucursalId) return;
    const firstSucursalId = parsePositiveInt(sucursales[0]?.id_sucursal);
    if (!firstSucursalId) return;
    applySucursalContext(firstSucursalId);
  }, [activeTab, applySucursalContext, selectedSucursalId, sucursales, sucursalesLoading]);

  // =============================
  // TOAST GLOBAL
  // =============================
  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(
      () => setToast((s) => ({ ...s, show: false })),
      3000
    );
    return () => clearTimeout(timer);
  }, [toast.show]);

  const openToast = useCallback((title, message, variant = "success") => {
    setToast({ show: true, title, message, variant });
  }, []);

  const closeToast = useCallback(() => {
    setToast((s) => ({ ...s, show: false }));
  }, []);

  const toastIconClass = (variant) => {
    if (variant === "danger") return "bi bi-x-octagon-fill";
    if (variant === "warning") return "bi bi-exclamation-triangle-fill";
    if (variant === "info") return "bi bi-info-circle-fill";
    return "bi bi-check2-circle";
  };

  const toastVariant = toast.variant || "success";

  const tabContent = useMemo(() => {
    if (!activeTab) return null;
    switch (activeTab) {
      case "empresas":
        return <EmpresasTab openToast={openToast} selectedSucursalId={selectedSucursalId} />;
      case "empleados":
        return <EmpleadosTab openToast={openToast} selectedSucursalId={selectedSucursalId} />;
      case "usuarios":
        return <UsuariosTab openToast={openToast} selectedSucursalId={selectedSucursalId} />;
      case "roles":
        return <RolesPermisosTab openToast={openToast} />;
      case "clientes":
        return <ClientesTab openToast={openToast} selectedSucursalId={selectedSucursalId} />;
      default:
        return <PersonasTab openToast={openToast} selectedSucursalId={selectedSucursalId} />;
    }
  }, [activeTab, applySucursalContext, openToast, selectedSucursalId]);

  if (permisosLoading) {
    return null;
  }

  if (!activeTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.personas}
        detalle="No tienes acceso a ningun submodulo de Personas."
      />
    );
  }

  return (
    <div className={`container-fluid p-3 ${isPlanillasTab ? "personas-branch-context personas-branch-context--planillas" : ""}`}>
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3">
        {isPlanillasTab ? (
          <div className="inv-catpro-body inv-prod-body p-3">
            <div className="personas-branch-context__row">
              <label className="personas-branch-context__label" htmlFor="personas-sucursal-context">
                Seleccionar sucursal
              </label>
              <select
                id="personas-sucursal-context"
                className="form-select personas-branch-context__select"
                value={selectedSucursalId}
                onChange={(event) => applySucursalContext(event.target.value)}
                disabled={sucursalesLoading}
              >
                <option value="">Selecciona la sucursal</option>
                {sucursales.map((sucursal) => {
                  const id = parsePositiveInt(sucursal?.id_sucursal);
                  if (!id) return null;
                  const nombre =
                    sucursal?.nombre_sucursal ||
                    sucursal?.nombre ||
                    sucursal?.sucursal ||
                    `Sucursal #${id}`;
                  return (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        ) : (
          <div className="inv-catpro-body inv-prod-body p-3 d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold text-secondary-emphasis">Contexto de sucursal</span>
            <select
              id="personas-sucursal-context"
              className="form-select form-select-sm"
              style={{ maxWidth: 320 }}
              value={selectedSucursalId}
              onChange={(event) => applySucursalContext(event.target.value)}
              disabled={sucursalesLoading}
            >
              <option value="">Todas las sucursales</option>
              {sucursales.map((sucursal) => {
                const id = parsePositiveInt(sucursal?.id_sucursal);
                if (!id) return null;
                const nombre =
                  sucursal?.nombre_sucursal ||
                  sucursal?.nombre ||
                  sucursal?.sucursal ||
                  `Sucursal #${id}`;
                return (
                  <option key={id} value={id}>
                    {nombre}
                  </option>
                );
              })}
            </select>
            <span className="text-muted small">Este contexto aplica en submodulos que operan por sucursal.</span>
          </div>
        )}
      </div>

      {/* ================= CONTENIDO ================= */}
      {tabContent}

      {/* ================= TOAST ================= */}
      {toast.show && (
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <div className={`inv-toast-card ${toastVariant}`}>
            <div className="inv-toast-icon">
              <i className={toastIconClass(toastVariant)} />
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
      )}
    </div>
  );
}
