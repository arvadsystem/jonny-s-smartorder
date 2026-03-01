import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

import SesionesTab from "./seguridad/SesionesTab";
import UsuariosTab from "./seguridad/UsuariosTab";
import PasswordPolicyTab from "./seguridad/PasswordPolicyTab";
import LoginLogsTab from "./seguridad/LoginLogsTab";

const Seguridad = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isSuperAdmin = Number(user?.rol) === 1;

  const allowedTabs = useMemo(() => {
    const base = ["sesiones", "password", "logins"];
    return isSuperAdmin ? ["sesiones", "usuarios", ...base.slice(1)] : base;
  }, [isSuperAdmin]);

  const [activeTab, setActiveTab] = useState("sesiones");

  useEffect(() => {
    const raw = (searchParams.get("tab") || "sesiones").toLowerCase();
    const resolved = allowedTabs.includes(raw) ? raw : "sesiones";

    setActiveTab(resolved);

    // Normaliza URL si viene algo inválido (o usuarios sin ser SuperAdmin)
    if (raw !== resolved) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", resolved);
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams, allowedTabs]);

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Seguridad</h3>
          <small className="text-muted">Sesiones y auditoría</small>
        </div>
      </div>

      {activeTab === "sesiones" && <SesionesTab />}
      {activeTab === "usuarios" && <UsuariosTab />}
      {activeTab === "password" && <PasswordPolicyTab />}
      {activeTab === "logins" && <LoginLogsTab />}
    </div>
  );
};

export default Seguridad;