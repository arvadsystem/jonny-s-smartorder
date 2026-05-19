import { useEffect, useState } from "react";
import { securityService } from "../services/securityService";

/**
 * Hook que carga las politicas de contrasena del backend (HU81)
 * y las expone al frontend para validacion en tiempo real.
 */
export default function usePasswordPolicies(options = {}) {
  const enabled = options?.enabled !== false;
  const suppressForbidden = options?.suppressForbidden !== false;

  const [policies, setPolicies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!enabled) {
      setPolicies(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await securityService.getPasswordPolicies();
      const rows = data?.policies || [];

      const map = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
      setPolicies(map);
    } catch (e) {
      const status = Number.parseInt(String(e?.status ?? ""), 10);
      if (suppressForbidden && (status === 401 || status === 403)) {
        setPolicies(null);
        setError("");
        return;
      }
      setError(e?.message || "No se pudieron cargar las politicas");
      setPolicies(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [enabled]);

  return { policies, loading, error, reload: load };
}
