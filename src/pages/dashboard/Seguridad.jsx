import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SinPermiso from "../../components/common/SinPermiso";
import { usePermisos } from "../../context/PermisosContext";
import { getAllowedTabs, MODULE_PRIMARY_PERMISSION } from "../../utils/permissions";

import SesionesTab from "./seguridad/SesionesTab";
import UsuariosTab from "./seguridad/UsuariosTab";
import PasswordPolicyTab from "./seguridad/PasswordPolicyTab";
import LoginLogsTab from "./seguridad/LoginLogsTab";
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
        detalle="No tienes acceso a ningun submodulo de Seguridad."
      />
    );
  }

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-0">Seguridad</h3>
          <small className="text-muted">Sesiones y auditoria</small>
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
