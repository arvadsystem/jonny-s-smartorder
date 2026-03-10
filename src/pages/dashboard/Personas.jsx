import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SinPermiso from "../../components/common/SinPermiso";
import { usePermisos } from "../../context/PermisosContext";
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from "../../utils/permissions";

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

export default function Personas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

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

  const activeTab = useMemo(() => {
    if (!fallbackTab) return null;
    const t = (searchParams.get("tab") || fallbackTab).toLowerCase();
    return allowedTabs.includes(t) ? t : fallbackTab;
  }, [allowedTabs, fallbackTab, searchParams]);

  useEffect(() => {
    if (permisosLoading || !activeTab) return;
    const rawTab = (searchParams.get("tab") || "").toLowerCase();
    if (rawTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, permisosLoading, searchParams, setSearchParams]);

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
        return <EmpresasTab openToast={openToast} />;
      case "empleados":
        return <EmpleadosTab openToast={openToast} />;
      case "usuarios":
        return <UsuariosTab openToast={openToast} />;
      case "roles":
        return <RolesPermisosTab openToast={openToast} />;
      case "clientes":
        return <ClientesTab openToast={openToast} />;
      default:
        return <PersonasTab openToast={openToast} />;
    }
  }, [activeTab, openToast]);

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
    <div className="container-fluid p-3">

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
