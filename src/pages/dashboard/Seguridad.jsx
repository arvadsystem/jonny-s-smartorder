import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SesionesTab from "./seguridad/SesionesTab";
import PasswordPolicyTab from "./seguridad/PasswordPolicyTab";
import LoginLogsTab from "./seguridad/LoginLogsTab";


const Seguridad = () => {
  const [searchParams] = useSearchParams();

  // ✅ Ahora soporta: sesiones | password | logins
  const [activeTab, setActiveTab] = useState("sesiones");

  useEffect(() => {
    const t = (searchParams.get("tab") || "sesiones").toLowerCase();

    // ✅ Permitimos 3 tabs y dejamos "sesiones" como fallback
    if (t === "password") setActiveTab("password");
    else if (t === "logins") setActiveTab("logins");
    else setActiveTab("sesiones");
  }, [searchParams]);

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Seguridad</h3>
          <small className="text-muted">Sesiones, políticas de contraseña y auditoría</small>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === "sesiones" ? "active" : ""}`}
            href="/dashboard/seguridad?tab=sesiones"
          >
            <i className="bi bi-laptop me-2"></i>Sesiones activas
          </a>
        </li>

        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === "password" ? "active" : ""}`}
            href="/dashboard/seguridad?tab=password"
          >
            <i className="bi bi-key me-2"></i>Políticas de contraseña
          </a>
        </li>

        {/* ✅ NUEVO TAB: Logs de login (HU78) */}
        <li className="nav-item">
          <a
            className={`nav-link ${activeTab === "logins" ? "active" : ""}`}
            href="/dashboard/seguridad?tab=logins"
          >
            <i className="bi bi-journal-text me-2"></i>Logs de login
          </a>
        </li>
      </ul>

      {/* Contenido por tab */}
      {activeTab === "sesiones" && <SesionesTab />}
      {activeTab === "password" && <PasswordPolicyTab />}
      {activeTab === "logins" && <LoginLogsTab />}
    </div>
  );
};

export default Seguridad;
