import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

      {activeTab === "sesiones" && <SesionesTab />}
      {activeTab === "password" && <PasswordPolicyTab />}
      {activeTab === "logins" && <LoginLogsTab />}
    </div>
  );
};

export default Seguridad;
