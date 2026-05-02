import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SinPermiso from "../../components/common/SinPermiso";
import { usePermisos } from "../../context/PermisosContext";
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from "../../utils/permissions";

import SesionesTab from "./seguridad/SesionesTab";
import UsuariosTab from "./seguridad/UsuariosTab";
import PasswordPolicyTab from "./seguridad/PasswordPolicyTab";
import LoginLogsTab from "./seguridad/LoginLogsTab";
import BitacorasTab from "./seguridad/BitacorasTab";
import SecurityDashboardTab from "./seguridad/SecurityDashboardTab";
import UsuarioAuditDetail from "./seguridad/UsuarioAuditDetail";

const Seguridad = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

  const allowedTabs = useMemo(
    () => getAllowedTabs("seguridad", permisos, { isSuperAdmin }).map((tab) => tab.key),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0] || null;
  const rawTab = (searchParams.get("tab") || fallbackTab || "").toLowerCase();
  const activeTab = fallbackTab && allowedTabs.includes(rawTab) ? rawTab : fallbackTab;

  useEffect(() => {
    if (!activeTab) return;
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

  if (permisosLoading) return null;

  if (!activeTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.seguridad}
        detalle="No tienes acceso a ningún submódulo de Seguridad."
      />
    );
  }

  return (
    <div className="p-4 sec-module-page">
      <div className="sec-page-header">
        <div className="sec-page-header__copy">
          <h3 className="sec-page-header__title">Seguridad</h3>
          <div className="sec-page-header__subtitle">Sesiones, auditoría y políticas de acceso</div>
        </div>
        <span className="sec-page-header__chip">
          <i className="bi bi-shield-lock" aria-hidden="true" />
          Módulo de control
        </span>
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
      {activeTab === "bitacoras" && <BitacorasTab />}
      {activeTab === "dashboard" && <SecurityDashboardTab />}
    </div>
  );
};

export default Seguridad;
