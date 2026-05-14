import { usePermisos } from "../../context/PermisosContext";

const Can = ({ perm, children, fallback = null }) => {
  const { can, loading } = usePermisos();

  if (loading) return null;      // evita parpadeo
  if (!can(perm)) return fallback;
  return children;
};

export default Can;