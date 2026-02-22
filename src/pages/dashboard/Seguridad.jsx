import { useEffect, useState } from "react";
import { useSearchParams, NavLink } from "react-router-dom";
import SesionesTab from "./seguridad/SesionesTab";
import PasswordPolicyTab from "./seguridad/PasswordPolicyTab";
import LoginLogsTab from "./seguridad/LoginLogsTab";

const Seguridad = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("sesiones");

  useEffect(() => {
    const t = (searchParams.get("tab") || "sesiones").toLowerCase();
    if (["sesiones", "password", "logins"].includes(t)) {
      setActiveTab(t);
    } else {
      setActiveTab("sesiones");
    }
  }, [searchParams]);

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Seguridad</h3>
          <small className="text-muted">
            Sesiones y políticas de contraseña
          </small>
        </div>
      </div>

      {/* ✅ Tabs SIN RECARGA */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <NavLink
            to="/dashboard/seguridad?tab=sesiones"
            className={({ isActive }) =>
              `nav-link ${activeTab === "sesiones" ? "active" : ""}`
            }
          >
            <i className="bi bi-laptop me-2"></i>
            Sesiones activas
          </NavLink>
        </li>

        <li className="nav-item">
          <NavLink
            to="/dashboard/seguridad?tab=password"
            className={() =>
              `nav-link ${activeTab === "password" ? "active" : ""}`
            }
          >
            <i className="bi bi-key me-2"></i>
            Políticas de contraseña
          </NavLink>
        </li>

        <li className="nav-item">
          <NavLink
            to="/dashboard/seguridad?tab=logins"
            className={() =>
              `nav-link ${activeTab === "logins" ? "active" : ""}`
            }
          >
            <i className="bi bi-journal-text me-2"></i>
            Logs de login
          </NavLink>
        </li>
      </ul>

      {/* Contenido */}
      {activeTab === "sesiones" && <SesionesTab />}
      {activeTab === "password" && <PasswordPolicyTab />}
      {activeTab === "logins" && <LoginLogsTab />}
    </div>
  );
};

export default Seguridad;