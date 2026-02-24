import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import PersonasTab from "./personas/personasTab";
import EmpresasTab from "./personas/EmpresasTab";
import EmpleadosTab from "./personas/EmpleadosTab";
import UsuariosTab from "./personas/UsuariosTab";
import ClientesTab from "./personas/ClientesTab";

const PERSONAS_TAB_KEYS = [
  "personas",
  "empresas",
  "empleados",
  "usuarios",
  "clientes",
];

export default function Personas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("personas");

  const [toast, setToast] = useState({
    show: false,
    title: "",
    message: "",
    variant: "success",
  });

  // =============================
  // CONTROL DE TAB POR URL
  // =============================
  useEffect(() => {
    const t = (searchParams.get("tab") || "personas").toLowerCase();
    setActiveTab(PERSONAS_TAB_KEYS.includes(t) ? t : "personas");
  }, [searchParams]);

  const changeTab = (newTab) => {
    if (!PERSONAS_TAB_KEYS.includes(newTab)) return;

    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", newTab);
      return p;
    });
  };

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

  const openToast = (title, message, variant = "success") => {
    setToast({ show: true, title, message, variant });
  };

  const closeToast = () => {
    setToast((s) => ({ ...s, show: false }));
  };

  const toastIconClass = (variant) => {
    if (variant === "danger") return "bi bi-x-octagon-fill";
    if (variant === "warning") return "bi bi-exclamation-triangle-fill";
    if (variant === "info") return "bi bi-info-circle-fill";
    return "bi bi-check2-circle";
  };

  const toastVariant = toast.variant || "success";

  const renderTab = () => {
    switch (activeTab) {
      case "empresas":
        return <EmpresasTab openToast={openToast} />;
      case "empleados":
        return <EmpleadosTab openToast={openToast} />;
      case "usuarios":
        return <UsuariosTab openToast={openToast} />;
      case "clientes":
        return <ClientesTab openToast={openToast} />;
      default:
        return <PersonasTab openToast={openToast} />;
    }
  };

  return (
    <div className="container-fluid p-3">

      {/* ================= CONTENIDO ================= */}
      {renderTab()}

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