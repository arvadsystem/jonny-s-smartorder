import { usePermisos } from "../context/PermisosContext";
import SinPermiso from "../components/common/SinPermiso";

const RequirePerm = ({ perm, children }) => {
  const { can, loading } = usePermisos();

  if (loading) return null;
  if (!can(perm)) return <SinPermiso permiso={perm} />;

  return children;
};

export default RequirePerm;