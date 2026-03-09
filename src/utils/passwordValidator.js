/**
 * Valida una contraseña según las políticas configuradas en Seguridad.
 */
const parsePolicyBool = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "si", "sí", "yes", "y", "on"].includes(normalized);
};

export function validatePassword(password, policies) {
  const rules = [];

  const minLenRaw = Number(policies?.password_min_length);
  const minLen = Number.isFinite(minLenRaw) && minLenRaw > 0 ? minLenRaw : 8;
  const reqUpper = parsePolicyBool(policies?.password_require_upper);
  const reqNumber = parsePolicyBool(policies?.password_require_number);
  const reqSymbol = parsePolicyBool(policies?.password_require_symbol);

  rules.push({
    key: "min",
    label: `Mínimo ${minLen} caracteres`,
    ok: password.length >= minLen,
  });

  if (reqUpper) {
    rules.push({
      key: "upper",
      label: "Al menos una mayúscula (A-Z)",
      ok: /[A-Z]/.test(password),
    });
  }

  if (reqNumber) {
    rules.push({
      key: "number",
      label: "Al menos un número (0-9)",
      ok: /[0-9]/.test(password),
    });
  }

  if (reqSymbol) {
    rules.push({
      key: "symbol",
      label: "Al menos un símbolo (!@#$...)",
      ok: /[^A-Za-z0-9]/.test(password),
    });
  }

  return {
    allOk: rules.every((rule) => rule.ok),
    rules,
  };
}
