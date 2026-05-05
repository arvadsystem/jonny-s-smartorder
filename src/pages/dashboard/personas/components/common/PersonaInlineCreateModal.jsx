import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ALLOWED_EDITING_KEYS,
  DNI_DIGITS_LENGTH,
  LETTERS_INPUT_REGEX,
  PHONE_DIGITS_LENGTH,
  buildPersonaPayloadFromForm,
  createInitialPersonaForm,
  createInitialPersonaTouched,
  digitsOnly,
  formatDNI,
  formatPhone,
  limit,
  normalizeHumanNameInput,
  normalizePersonaFormValues,
  personaFormFieldToTouchedKey,
  resolveCaretFromDigitIndex,
  validatePersonaField,
  validatePersonaForm,
} from "./persona-form-shared";
import "./crud-modal-theme.css";
import "./persona-inline-create-modal.css";

const buildTouchedAllTrue = () => ({
  nombre: true,
  apellido: true,
  dni: true,
  genero: true,
  fechaNacimiento: true,
  telefono: true,
  correo: true,
  rtn: true,
});

export default function PersonaInlineCreateModal({
  show,
  title = "Nueva persona",
  subtitle = "Completa los campos y guarda los cambios.",
  saveLabel = "Crear",
  initialForm = null,
  onClose,
  onSave,
  saving = false,
}) {
  const [form, setForm] = useState(() => createInitialPersonaForm());
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(() => createInitialPersonaTouched());
  const drawerRef = useRef(null);

  const dniInputRef = useRef(null);
  const telefonoInputRef = useRef(null);
  const dniCaretRef = useRef(null);
  const telefonoCaretRef = useRef(null);

  useEffect(() => {
    if (!show) return;
    setForm(normalizePersonaFormValues(initialForm ?? createInitialPersonaForm()));
    setErrors({});
    setTouched(createInitialPersonaTouched());
    dniCaretRef.current = null;
    telefonoCaretRef.current = null;
  }, [show, initialForm]);

  const releaseDrawerFocus = useCallback(() => {
    if (typeof document === "undefined") return;
    const activeElement = document.activeElement;
    const drawerNode = drawerRef.current;
    if (!(activeElement instanceof HTMLElement)) return;
    if (!drawerNode || !drawerNode.contains(activeElement)) return;
    activeElement.blur();
  }, []);

  useEffect(() => {
    if (show) return;
    releaseDrawerFocus();
  }, [show, releaseDrawerFocus]);

  useLayoutEffect(() => {
    if (dniCaretRef.current === null) return;
    const input = dniInputRef.current;
    if (!input) return;

    const nextCaret = dniCaretRef.current;
    dniCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // noop
    }
  }, [form.dni]);

  useLayoutEffect(() => {
    if (telefonoCaretRef.current === null) return;
    const input = telefonoInputRef.current;
    if (!input) return;

    const nextCaret = telefonoCaretRef.current;
    telefonoCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // noop
    }
  }, [form.id_telefono]);

  const setFieldErrorState = useCallback((fieldName, errorMessage) => {
    setErrors((prevErrors) => {
      const nextErrors = { ...prevErrors };
      if (errorMessage) nextErrors[fieldName] = errorMessage;
      else delete nextErrors[fieldName];
      return nextErrors;
    });
  }, []);

  const updateFieldValue = useCallback(
    (fieldName, nextValue, touchOnChange = true) => {
      const touchedKey = personaFormFieldToTouchedKey[fieldName];
      const isTouched = touchedKey ? Boolean(touched[touchedKey]) : false;
      const shouldValidate = Boolean(touchedKey && (isTouched || touchOnChange));

      if (touchedKey && touchOnChange && !isTouched) {
        setTouched((prev) => ({ ...prev, [touchedKey]: true }));
      }

      setForm((prevForm) => {
        const nextForm =
          prevForm[fieldName] === nextValue ? prevForm : { ...prevForm, [fieldName]: nextValue };
        if (shouldValidate) {
          const fieldError = validatePersonaField(fieldName, nextValue, nextForm);
          setFieldErrorState(fieldName, fieldError);
        }
        return nextForm;
      });
    },
    [setFieldErrorState, touched]
  );

  const handleFieldBlur = useCallback(
    (fieldName) => () => {
      const touchedKey = personaFormFieldToTouchedKey[fieldName];
      if (!touchedKey) return;
      setTouched((prev) => (prev[touchedKey] ? prev : { ...prev, [touchedKey]: true }));
      const fieldError = validatePersonaField(fieldName, form[fieldName], form);
      setFieldErrorState(fieldName, fieldError);
    },
    [form, setFieldErrorState]
  );

  const handleLettersFieldChange = (field) => (event) => {
    const normalized = normalizeHumanNameInput(event.target.value, { preserveTrailingSpace: true });
    updateFieldValue(field, normalized, true);
  };

  const handleDniChange = (event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const raw = limit(digitsOnly(inputValue), DNI_DIGITS_LENGTH);
    const formatted = formatDNI(raw);

    dniCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, raw.length)
    );

    updateFieldValue("dni", formatted, true);
  };

  const handleRtnChange = (event) => {
    const normalized = limit(digitsOnly(event.target.value), 1);
    updateFieldValue("rtn", normalized, true);
  };

  const handleTelefonoChange = (event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const raw = limit(digitsOnly(inputValue), PHONE_DIGITS_LENGTH);
    const formatted = formatPhone(raw);

    telefonoCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, raw.length)
    );

    updateFieldValue("id_telefono", formatted, true);
  };

  const blockInvalidNumericBeforeInput = useCallback(
    (event, fieldName, maxDigits) => {
      const data = event?.nativeEvent?.data ?? event?.data;
      if (!data) return;
      if (/\D/.test(data)) {
        event.preventDefault();
        return;
      }
      const currentFormatted = String(form[fieldName] ?? "");
      const currentRaw = digitsOnly(currentFormatted);
      if (currentRaw.length >= maxDigits) {
        const input = event.currentTarget;
        const hasSelection =
          typeof input.selectionStart === "number" &&
          typeof input.selectionEnd === "number" &&
          input.selectionStart !== input.selectionEnd;
        if (!hasSelection) {
          event.preventDefault();
          return;
        }
      }

      const input = event.currentTarget;
      const selectionStart =
        typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd =
        typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const nextLength = currentRaw.length - (rawEnd - rawStart) + digitsOnly(data).length;
      if (nextLength > maxDigits) event.preventDefault();
    },
    [form]
  );

  const blockInvalidNumericKeyDown = useCallback(
    (event, fieldName, maxDigits) => {
      if (event.ctrlKey || event.metaKey) return;
      if (ALLOWED_EDITING_KEYS.has(event.key)) return;
      if (event.key.length !== 1) return;
      if (!/\d/.test(event.key)) {
        event.preventDefault();
        return;
      }
      const input = event.currentTarget;
      const currentFormatted = String(form[fieldName] ?? "");
      const selectionStart =
        typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd =
        typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const currentRaw = digitsOnly(currentFormatted);
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const nextLength = currentRaw.length - (rawEnd - rawStart) + 1;
      if (nextLength > maxDigits) event.preventDefault();
    },
    [form]
  );

  const handleDniPaste = useCallback(
    (event) => {
      event.preventDefault();
      const pasted = event.clipboardData?.getData("text") ?? "";
      const raw = limit(digitsOnly(pasted), DNI_DIGITS_LENGTH);
      dniCaretRef.current = formatDNI(raw).length;
      updateFieldValue("dni", formatDNI(raw), true);
    },
    [updateFieldValue]
  );

  const handleTelefonoPaste = useCallback(
    (event) => {
      event.preventDefault();
      const pasted = event.clipboardData?.getData("text") ?? "";
      const raw = limit(digitsOnly(pasted), PHONE_DIGITS_LENGTH);
      telefonoCaretRef.current = formatPhone(raw).length;
      updateFieldValue("id_telefono", formatPhone(raw), true);
    },
    [updateFieldValue]
  );

  const sanitizeNumericPaste = useCallback(
    (event, fieldName, maxDigits, formatter = (value) => value) => {
      event.preventDefault();
      const pastedRaw = digitsOnly(event.clipboardData?.getData("text") ?? "");
      const currentFormatted = String(form[fieldName] ?? "");
      const input = event.target;
      const selectionStart =
        typeof input.selectionStart === "number" ? input.selectionStart : currentFormatted.length;
      const selectionEnd =
        typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const currentRaw = digitsOnly(currentFormatted);
      const rawStart = digitsOnly(currentFormatted.slice(0, selectionStart)).length;
      const rawEnd = digitsOnly(currentFormatted.slice(0, selectionEnd)).length;
      const mergedRaw = limit(
        `${currentRaw.slice(0, rawStart)}${pastedRaw}${currentRaw.slice(rawEnd)}`,
        maxDigits
      );
      updateFieldValue(fieldName, formatter(mergedRaw), true);
    },
    [form, updateFieldValue]
  );

  const blockInvalidLettersBeforeInput = useCallback((event) => {
    const data = event?.nativeEvent?.data ?? event?.data;
    if (!data) return;
    const normalizedData = String(data).replace(/\u00A0/g, " ");
    if (!LETTERS_INPUT_REGEX.test(normalizedData)) event.preventDefault();
  }, []);

  const sanitizeLettersPaste = useCallback(
    (event, fieldName) => {
      event.preventDefault();
      const pasted = String(event.clipboardData?.getData("text") ?? "");
      const current = String(form[fieldName] ?? "");
      const input = event.target;
      const selectionStart =
        typeof input.selectionStart === "number" ? input.selectionStart : current.length;
      const selectionEnd =
        typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
      const merged = `${current.slice(0, selectionStart)}${pasted}${current.slice(selectionEnd)}`;
      const normalized = normalizeHumanNameInput(merged, { preserveTrailingSpace: true });
      updateFieldValue(fieldName, normalized, true);
    },
    [form, updateFieldValue]
  );

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;

    const currentErrors = validatePersonaForm(form);
    setTouched(buildTouchedAllTrue());
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;

    const payload = buildPersonaPayloadFromForm(form);
    releaseDrawerFocus();
    await onSave?.(payload, form);
  };

  const handleRequestClose = useCallback(() => {
    releaseDrawerFocus();
    onClose?.();
  }, [onClose, releaseDrawerFocus]);

  return (
    <>
      <div
        className={`inv-prod-drawer-backdrop persona-inline-create-modal__backdrop ${show ? "show" : ""}`}
        onClick={saving ? undefined : handleRequestClose}
      />

      <aside
        ref={drawerRef}
        className={`inv-prod-drawer inv-cat-v2__drawer crud-modal personas-modal persona-inline-create-modal ${
          show ? "show" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!show}
      >
        <div className="inv-prod-drawer-head crud-modal__header">
          <div className="crud-modal__header-copy crud-modal__header-copy--insumo">
            <div className="crud-modal__hero-icon" aria-hidden="true">
              <i className="bi bi-person-vcard" />
            </div>
            <div className="crud-modal__hero-main">
              <div className="crud-modal__hero-kicker">Catalogo de Personas</div>
              <div className="inv-prod-drawer-title crud-modal__title">{title}</div>
              <div className="inv-prod-drawer-sub crud-modal__subtitle">{subtitle}</div>
            </div>
            <div className="crud-modal__hero-chips">
              <span className="crud-modal__hero-chip">
                <i className="bi bi-person" /> Persona
              </span>
              <span className="crud-modal__hero-chip">
                <i className="bi bi-check2-circle" /> Alta controlada
              </span>
            </div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close crud-modal__close"
            onClick={handleRequestClose}
            title="Cerrar"
            disabled={saving}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite crud-modal__body" onSubmit={handleSave}>
          <div className="row g-2 crud-modal__grid mt-1">
            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>Nombre</span>
                <span className="persona-field-label__meta is-required">Oblig.</span>
              </label>
              <input
                type="text"
                className={`form-control ${touched.nombre && errors.nombre ? "is-invalid" : ""}`}
                placeholder="Ej: Maria"
                value={form.nombre}
                onChange={handleLettersFieldChange("nombre")}
                onBeforeInput={blockInvalidLettersBeforeInput}
                onPaste={(event) => sanitizeLettersPaste(event, "nombre")}
                onBlur={handleFieldBlur("nombre")}
                disabled={saving}
              />
              {touched.nombre && errors.nombre ? <div className="invalid-feedback d-block">{errors.nombre}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>Apellido</span>
                <span className="persona-field-label__meta is-required">Oblig.</span>
              </label>
              <input
                type="text"
                className={`form-control ${touched.apellido && errors.apellido ? "is-invalid" : ""}`}
                placeholder="Ej: Rodriguez"
                value={form.apellido}
                onChange={handleLettersFieldChange("apellido")}
                onBeforeInput={blockInvalidLettersBeforeInput}
                onPaste={(event) => sanitizeLettersPaste(event, "apellido")}
                onBlur={handleFieldBlur("apellido")}
                disabled={saving}
              />
              {touched.apellido && errors.apellido ? (
                <div className="invalid-feedback d-block">{errors.apellido}</div>
              ) : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>DNI</span>
                <span className="persona-field-label__meta is-optional">Opc.</span>
              </label>
              <input
                ref={dniInputRef}
                type="text"
                className={`form-control ${touched.dni && errors.dni ? "is-invalid" : ""}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={15}
                placeholder="0000-0000-00000"
                value={form.dni}
                onChange={handleDniChange}
                onBeforeInput={(event) => blockInvalidNumericBeforeInput(event, "dni", DNI_DIGITS_LENGTH)}
                onKeyDown={(event) => blockInvalidNumericKeyDown(event, "dni", DNI_DIGITS_LENGTH)}
                onPaste={handleDniPaste}
                onBlur={handleFieldBlur("dni")}
                disabled={saving}
              />
              {touched.dni && errors.dni ? <div className="invalid-feedback d-block">{errors.dni}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>RTN</span>
                <span className="persona-field-label__meta is-optional">Opc.</span>
              </label>
              <input
                type="text"
                className={`form-control ${touched.rtn && errors.rtn ? "is-invalid" : ""}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={1}
                placeholder="9"
                value={form.rtn}
                onChange={handleRtnChange}
                onBeforeInput={(event) => blockInvalidNumericBeforeInput(event, "rtn", 1)}
                onKeyDown={(event) => blockInvalidNumericKeyDown(event, "rtn", 1)}
                onPaste={(event) => sanitizeNumericPaste(event, "rtn", 1)}
                onBlur={handleFieldBlur("rtn")}
                disabled={saving}
              />
              {touched.rtn && errors.rtn ? <div className="invalid-feedback d-block">{errors.rtn}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>Genero</span>
                <span className="persona-field-label__meta is-required">Oblig.</span>
              </label>
              <select
                className={`form-select ${touched.genero && errors.genero ? "is-invalid" : ""}`}
                value={form.genero}
                onChange={(event) => updateFieldValue("genero", event.target.value, true)}
                onBlur={handleFieldBlur("genero")}
                disabled={saving}
              >
                <option value="">Seleccione</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
              {touched.genero && errors.genero ? <div className="invalid-feedback d-block">{errors.genero}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>Fecha Nacimiento</span>
                <span className="persona-field-label__meta is-optional">Opc.</span>
              </label>
              <input
                type="date"
                className={`form-control ${touched.fechaNacimiento && errors.fecha_nacimiento ? "is-invalid" : ""}`}
                value={form.fecha_nacimiento}
                onChange={(event) => updateFieldValue("fecha_nacimiento", event.target.value, true)}
                onBlur={handleFieldBlur("fecha_nacimiento")}
                disabled={saving}
              />
              {touched.fechaNacimiento && errors.fecha_nacimiento ? (
                <div className="invalid-feedback d-block">{errors.fecha_nacimiento}</div>
              ) : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>Telefono</span>
                <span className="persona-field-label__meta is-optional">Opc.</span>
              </label>
              <input
                ref={telefonoInputRef}
                type="text"
                className={`form-control ${touched.telefono && errors.id_telefono ? "is-invalid" : ""}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={9}
                placeholder="0000-0000"
                value={form.id_telefono}
                onChange={handleTelefonoChange}
                onBeforeInput={(event) => blockInvalidNumericBeforeInput(event, "id_telefono", PHONE_DIGITS_LENGTH)}
                onKeyDown={(event) => blockInvalidNumericKeyDown(event, "id_telefono", PHONE_DIGITS_LENGTH)}
                onPaste={handleTelefonoPaste}
                onBlur={handleFieldBlur("id_telefono")}
                disabled={saving}
              />
              {touched.telefono && errors.id_telefono ? (
                <div className="invalid-feedback d-block">{errors.id_telefono}</div>
              ) : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label persona-field-label">
                <span>Direccion</span>
                <span className="persona-field-label__meta is-optional">Opc.</span>
              </label>
              <input
                type="text"
                className={`form-control ${errors.id_direccion ? "is-invalid" : ""}`}
                placeholder="Ej: Lomas de Santa Lucia"
                value={form.id_direccion}
                onChange={(event) => updateFieldValue("id_direccion", event.target.value)}
                disabled={saving}
              />
              {errors.id_direccion ? <div className="invalid-feedback d-block">{errors.id_direccion}</div> : null}
            </div>

            <div className="col-12">
              <label className="form-label persona-field-label">
                <span>Correo</span>
                <span className="persona-field-label__meta is-optional">Opc.</span>
              </label>
              <input
                type="text"
                className={`form-control ${touched.correo && errors.id_correo ? "is-invalid" : ""}`}
                placeholder="ejemplo@correo.com"
                value={form.id_correo}
                onChange={(event) => updateFieldValue("id_correo", event.target.value, true)}
                onBlur={handleFieldBlur("id_correo")}
                disabled={saving}
              />
              {touched.correo && errors.id_correo ? <div className="invalid-feedback d-block">{errors.id_correo}</div> : null}
            </div>
          </div>

          <div className="d-flex mt-3 crud-modal__footer">
            <button
              type="button"
              className="btn inv-prod-btn-subtle flex-fill crud-modal__btn"
              onClick={handleRequestClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button type="submit" className="btn inv-prod-btn-primary flex-fill crud-modal__btn" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Guardando...
                </>
              ) : (
                saveLabel
              )}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
