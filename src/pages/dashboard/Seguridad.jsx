import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

import SesionesTab from "./seguridad/SesionesTab";
import UsuariosTab from "./seguridad/UsuariosTab";
import PasswordPolicyTab from "./seguridad/PasswordPolicyTab";
import LoginLogsTab from "./seguridad/LoginLogsTab";
import UsuarioAuditDetail from "./seguridad/UsuarioAuditDetail";

const Seguridad = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const isSuperAdmin = Number(user?.rol) === 1;

  const allowedTabs = useMemo(() => {
    const base = ["sesiones", "password", "logins"];
    return isSuperAdmin ? ["sesiones", "usuarios", ...base.slice(1)] : base;
  }, [isSuperAdmin]);

  const rawTab = (searchParams.get("tab") || "sesiones").toLowerCase();
  const activeTab = allowedTabs.includes(rawTab) ? rawTab : "sesiones";

  useEffect(() => {
    // Normaliza URL si viene algo inválido (o usuarios sin ser SuperAdmin)
    if (rawTab !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", activeTab);
      setSearchParams(next, { replace: true });
    }
  }, [rawTab, activeTab, searchParams, setSearchParams]);

  const detailView = String(searchParams.get("view") || "").toLowerCase();
  const detailUserId = Number(searchParams.get("uid") || 0);
  const showUsuarioDetalle =
    activeTab === "usuarios" &&
    detailView === "detalle" &&
    Number.isInteger(detailUserId) &&
    detailUserId > 0;

  const openUsuarioDetalle = (row) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "usuarios");
    next.set("view", "detalle");
    next.set("uid", String(row?.id_usuario));
    setSearchParams(next);
  };

  const backToUsuarios = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    next.delete("uid");
    next.set("tab", "usuarios");
    setSearchParams(next);
  };

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Seguridad</h3>
          <small className="text-muted">Sesiones y auditoría</small>
        </div>
      </div>

      {activeTab === "sesiones" && <SesionesTab />}
      {activeTab === "usuarios" && (
        <>
          <div style={{ display: showUsuarioDetalle ? "none" : "block" }}>
            <UsuariosTab onOpenAudit={openUsuarioDetalle} />
          </div>

          {showUsuarioDetalle && (
            <UsuarioAuditDetail userId={detailUserId} onBack={backToUsuarios} />
          )}
        </>
      )}
      {activeTab === "password" && <PasswordPolicyTab />}
      {activeTab === "logins" && <LoginLogsTab />}
    </div>
  );
};

export default Seguridad;
