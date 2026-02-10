import React from "react";
import { useLocation } from "react-router-dom";

import PersonasTab from "./personas/PersonasTab";
// import EmpresasTab from "./personas/EmpresasTab";
// import EmpleadosTab from "./personas/EmpleadosTab";
// import UsuariosTab from "./personas/UsuariosTab";
// import ClientesTab from "./personas/ClientesTab";
// import PlanillasTab from "./personas/PlanillasTab";
// import BiometricosTab from "./personas/BiometricosTab";

export default function Personas() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get("tab") || "personas";

  const renderTab = () => {
    switch (tab) {
      case "personas":
        return <PersonasTab />;

      /*
      case "empresas":
        return <EmpresasTab />;

      case "empleados":
        return <EmpleadosTab />;

      case "usuarios":
        return <UsuariosTab />;

      case "clientes":
        return <ClientesTab />;

      case "planillas":
        return <PlanillasTab />;

      case "biometricos":
        return <BiometricosTab />;
      */

      default:
        return <PersonasTab />;
    }
  };

  return (
    <div>
      {renderTab()}
    </div>
  );
}
