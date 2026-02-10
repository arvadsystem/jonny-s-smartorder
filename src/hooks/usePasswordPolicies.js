import { useEffect, useState } from "react";
import { securityService } from "../services/securityService";

/**
 * Hook que carga las políticas de contraseña del backend (HU81)
 * y las expone al frontend para validación en tiempo real.
 */
export default function usePasswordPolicies() {
  const [policies, setPolicies] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await securityService.getPasswordPolicies();
      const rows = data?.policies || [];

      // Convertimos array -> objeto { clave: valor }
      const map = Object.fromEntries(rows.map((r) => [r.clave, r.valor]));
      setPolicies(map);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar las políticas");
      setPolicies(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { policies, loading, error, reload: load };
}
