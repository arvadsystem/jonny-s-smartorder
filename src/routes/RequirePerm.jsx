import { Navigate } from "react-router-dom";
import { usePermisos } from "../context/PermisosContext";
import SinPermiso from "../components/common/SinPermiso";

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const RequirePerm = ({
  perm,
  anyOf,
  allOf,
  children,
  redirectTo = null,
  fallback = null
}) => {
  const { can, canAny, canAll, loading } = usePermisos();

  if (loading) return null;

  const normalizedAnyOf = toArray(anyOf);
  const normalizedAllOf = toArray(allOf);

  const checks = [];
  if (perm) checks.push(can(perm));
  if (normalizedAnyOf.length > 0) checks.push(canAny(normalizedAnyOf));
  if (normalizedAllOf.length > 0) checks.push(canAll(normalizedAllOf));

  const isAllowed = checks.length === 0 ? true : checks.every(Boolean);
  if (isAllowed) return children;

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (fallback !== null) {
    return fallback;
  }

  const requiredLabel =
    perm ||
    (normalizedAnyOf.length > 0 ? normalizedAnyOf.join(" | ") : normalizedAllOf.join(" + ")) ||
    "—";

  return <SinPermiso permiso={requiredLabel} />;
};

export default RequirePerm;
