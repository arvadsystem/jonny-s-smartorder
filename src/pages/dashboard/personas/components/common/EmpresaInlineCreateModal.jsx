import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { personaService } from "../../../../../services/personasService";
import {
  PHONE_DISPLAY_MAX_LENGTH,
  PHONE_DIGITS_LENGTH,
  RTN_DISPLAY_MAX_LENGTH,
  RTN_DIGITS_LENGTH,
  buildEmpresaPayloadFromForm,
  createInitialEmpresaForm,
  digitsOnly,
  formatPhone,
  formatRtn,
  limitText,
  normalizeEmpresaFormValues,
  resolveCaretFromDigitIndex,
  validateEmpresaForm,
} from "./empresa-form-shared";
import "../empresas/empresas-modal.css";
import "./empresa-inline-create-modal.css";

const toDisplayValue = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

export default function EmpresaInlineCreateModal({
  show,
  title = "Nueva empresa",
  subtitle = "Completa los campos y guarda los cambios.",
  initialForm = null,
  onClose,
  onSave,
  saving = false,
}) {
  const [form, setForm] = useState(() => createInitialEmpresaForm());
  const [errors, setErrors] = useState({});
  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);
  const drawerRef = useRef(null);

  const mountedRef = useRef(false);
  const catalogosCargadosRef = useRef(false);
  const rtnInputRef = useRef(null);
  const rtnCaretRef = useRef(null);
  const telefonoInputRef = useRef(null);
  const telefonoCaretRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!show) return;
    setForm(normalizeEmpresaFormValues(initialForm ?? createInitialEmpresaForm()));
    setErrors({});
    rtnCaretRef.current = null;
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

  const cargarCatalogos = useCallback(async () => {
    if (catalogosCargadosRef.current) return;
    try {
      const [telefonosResp, direccionesResp, correosResp] = await Promise.all([
        personaService.getTelefonos(),
        personaService.getDirecciones(),
        personaService.getCorreos(),
      ]);

      if (!mountedRef.current) return;
      setTelefonos(Array.isArray(telefonosResp) ? telefonosResp : []);
      setDirecciones(Array.isArray(direccionesResp) ? direccionesResp : []);
      setCorreos(Array.isArray(correosResp) ? correosResp : []);
      catalogosCargadosRef.current = true;
    } catch {
      if (!mountedRef.current) return;
      setTelefonos([]);
      setDirecciones([]);
      setCorreos([]);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    cargarCatalogos();
  }, [show, cargarCatalogos]);

  useLayoutEffect(() => {
    if (rtnCaretRef.current === null) return;
    const input = rtnInputRef.current;
    if (!input) return;

    const nextCaret = rtnCaretRef.current;
    rtnCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // noop
    }
  }, [form.rtn]);

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

  const handleRtnChange = useCallback((event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const clean = limitText(digitsOnly(inputValue), RTN_DIGITS_LENGTH);
    const formatted = formatRtn(clean);

    rtnCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, clean.length)
    );

    setForm((state) => ({ ...state, rtn: formatted }));
    setErrors((state) => ({ ...state, rtn: undefined }));
  }, []);

  const handleRtnPaste = useCallback((event) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") ?? "";
    const clean = limitText(digitsOnly(pasted), RTN_DIGITS_LENGTH);
    const formatted = formatRtn(clean);
    rtnCaretRef.current = formatted.length;
    setForm((state) => ({ ...state, rtn: formatted }));
    setErrors((state) => ({ ...state, rtn: undefined }));
  }, []);

  const handleTelefonoChange = useCallback((event) => {
    const inputValue = event.target.value ?? "";
    const caretPosition = event.target.selectionStart ?? inputValue.length;
    const digitsBeforeCaret = digitsOnly(inputValue.slice(0, caretPosition)).length;
    const raw = limitText(digitsOnly(inputValue), PHONE_DIGITS_LENGTH);
    const formatted = formatPhone(raw);

    telefonoCaretRef.current = resolveCaretFromDigitIndex(
      formatted,
      Math.min(digitsBeforeCaret, raw.length)
    );

    setForm((state) => ({ ...state, id_telefono: formatted }));
    setErrors((state) => ({ ...state, id_telefono: undefined }));
  }, []);

  const handleTelefonoPaste = useCallback((event) => {
    event.preventDefault();
    const pasted = event.clipboardData?.getData("text") ?? "";
    const raw = limitText(digitsOnly(pasted), PHONE_DIGITS_LENGTH);
    const formatted = formatPhone(raw);

    telefonoCaretRef.current = formatted.length;
    setForm((state) => ({ ...state, id_telefono: formatted }));
    setErrors((state) => ({ ...state, id_telefono: undefined }));
  }, []);

  const handleFieldChange = useCallback((field, value) => {
    setForm((state) => ({ ...state, [field]: value }));
    setErrors((state) => ({ ...state, [field]: undefined }));
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    if (saving) return;

    const currentErrors = validateEmpresaForm(form);
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;

    const payload = buildEmpresaPayloadFromForm(form);
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
        className={`inv-prod-drawer-backdrop empresa-inline-create-modal__backdrop ${show ? "show" : ""}`}
        onClick={saving ? undefined : handleRequestClose}
      />

      <aside
        ref={drawerRef}
        className={`inv-prod-drawer inv-cat-v2__drawer empresas-modal empresa-inline-create-modal ${show ? "show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!show}
      >
        <div className="inv-prod-drawer-head empresas-modal__header">
          <div className="empresas-modal__header-copy">
            <div className="inv-prod-drawer-title empresas-modal__title">{title}</div>
            <div className="inv-prod-drawer-sub empresas-modal__subtitle">{subtitle}</div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close empresas-modal__close"
            onClick={handleRequestClose}
            title="Cerrar"
            disabled={saving}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite empresas-modal__body" onSubmit={handleSave}>
          <div className="row g-3 empresas-modal__grid">
            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label empresas-modal__field-label">
                <span>RTN</span>
                <span className="empresas-modal__field-meta is-required">Oblig.</span>
              </label>
              <input
                ref={rtnInputRef}
                type="text"
                inputMode="numeric"
                maxLength={RTN_DISPLAY_MAX_LENGTH}
                className={`form-control empresas-modal__input ${errors.rtn ? "is-invalid" : ""}`}
                placeholder="0801-9010-000000"
                value={form.rtn}
                onChange={handleRtnChange}
                onPaste={handleRtnPaste}
                disabled={saving}
              />
              {errors.rtn ? <div className="invalid-feedback d-block">{errors.rtn}</div> : null}
            </div>

            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label empresas-modal__field-label">
                <span>Nombre Empresa</span>
                <span className="empresas-modal__field-meta is-required">Oblig.</span>
              </label>
              <input
                className={`form-control empresas-modal__input ${errors.nombre_empresa ? "is-invalid" : ""}`}
                placeholder="Ej: Inversiones La Esperanza"
                value={form.nombre_empresa}
                onChange={(event) => handleFieldChange("nombre_empresa", event.target.value)}
                disabled={saving}
              />
              {errors.nombre_empresa ? <div className="invalid-feedback d-block">{errors.nombre_empresa}</div> : null}
            </div>

            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label empresas-modal__field-label">
                <span>Telefono</span>
                <span className="empresas-modal__field-meta is-optional">Opc.</span>
              </label>
              <input
                ref={telefonoInputRef}
                type="text"
                inputMode="numeric"
                maxLength={PHONE_DISPLAY_MAX_LENGTH}
                list="empresa-inline-telefonos-sugeridos"
                placeholder="0000-0000"
                className={`form-control empresas-modal__input ${errors.id_telefono ? "is-invalid" : ""}`}
                value={form.id_telefono}
                onChange={handleTelefonoChange}
                onPaste={handleTelefonoPaste}
                disabled={saving}
              />
              <datalist id="empresa-inline-telefonos-sugeridos">
                {telefonos.map((telefono) => (
                  <option key={telefono.id_telefono} value={toDisplayValue(telefono.telefono, "")} />
                ))}
              </datalist>
              {errors.id_telefono ? <div className="invalid-feedback d-block">{errors.id_telefono}</div> : null}
            </div>

            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label empresas-modal__field-label">
                <span>Direccion</span>
                <span className="empresas-modal__field-meta is-optional">Opc.</span>
              </label>
              <input
                type="text"
                list="empresa-inline-direcciones-sugeridas"
                placeholder="Ej: Col. Palmira, Avenida Republica..."
                className={`form-control empresas-modal__input ${errors.id_direccion ? "is-invalid" : ""}`}
                value={form.id_direccion}
                onChange={(event) => handleFieldChange("id_direccion", event.target.value)}
                disabled={saving}
              />
              <datalist id="empresa-inline-direcciones-sugeridas">
                {direcciones.map((direccion) => (
                  <option key={direccion.id_direccion} value={toDisplayValue(direccion.direccion, "")} />
                ))}
              </datalist>
              {errors.id_direccion ? <div className="invalid-feedback d-block">{errors.id_direccion}</div> : null}
            </div>

            <div className="col-12 empresas-modal__field">
              <label className="form-label empresas-modal__label empresas-modal__field-label">
                <span>Correo</span>
                <span className="empresas-modal__field-meta is-optional">Opc.</span>
              </label>
              <input
                type="email"
                list="empresa-inline-correos-sugeridos"
                placeholder="empresa@dominio.com"
                className={`form-control empresas-modal__input ${errors.id_correo ? "is-invalid" : ""}`}
                value={form.id_correo}
                onChange={(event) => handleFieldChange("id_correo", event.target.value)}
                disabled={saving}
              />
              <datalist id="empresa-inline-correos-sugeridos">
                {correos.map((correo) => (
                  <option key={correo.id_correo} value={toDisplayValue(correo.direccion_correo, "")} />
                ))}
              </datalist>
              {errors.id_correo ? <div className="invalid-feedback d-block">{errors.id_correo}</div> : null}
            </div>

            <div className="col-12 empresas-modal__field empresas-modal__switch-wrap">
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={Boolean(form.estado)}
                  onChange={(event) => handleFieldChange("estado", event.target.checked)}
                  id="empresa_inline_estado_visual"
                  disabled={saving}
                />
                <label className="form-check-label empresas-modal__label" htmlFor="empresa_inline_estado_visual">
                  Registro habilitado
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-4 empresas-modal__footer">
            <button
              type="button"
              className="btn inv-prod-btn-subtle flex-fill empresas-modal__btn"
              onClick={handleRequestClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn inv-prod-btn-primary flex-fill empresas-modal__btn"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar empresa"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
