/**
 * Valida una contraseña en base a políticas del backend (HU81).
 * policies ejemplo:
 * {
 *  password_min_length: "8",
 *  password_require_upper: "true",
 *  password_require_number: "true",
 *  password_require_symbol: "false"
 * }
 */
export function validatePassword(password, policies) {
  const rules = [];

  const minLen = Number(policies?.password_min_length ?? 8);
  const reqUpper = String(policies?.password_require_upper ?? "false") === "true";
  const reqNumber = String(policies?.password_require_number ?? "false") === "true";
  const reqSymbol = String(policies?.password_require_symbol ?? "false") === "true";

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

  const allOk = rules.every((r) => r.ok);

  return { allOk, rules };
}
