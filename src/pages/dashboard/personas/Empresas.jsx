import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { personaService } from "../../../services/personasService";
import EntityTable from "../../../components/ui/EntityTable";
import HeaderModulo from "./components/common/HeaderModulo";
import ModuleFiltros from "./components/common/ModuleFiltros";
import ModuleKPICards from "./components/common/ModuleKPICards";
import EmpresaCard from "./components/empresas/EmpresaCard";
import "./components/empresas/empresas-modal.css";

const emptyForm = {
  rtn: "",
  nombre_empresa: "",
  id_telefono: "",
  id_direccion: "",
  id_correo: "",
  estado: true,
};

const createInitialFiltersDraft = () => ({
  estadoFiltro: "todos",
  sortBy: "recientes",
});

const EMAIL_WITH_DOMAIN_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RTN_DIGITS_LENGTH = 14;
const RTN_DISPLAY_MAX_LENGTH = 16;
const PHONE_DIGITS_LENGTH = 8;
const PHONE_DISPLAY_MAX_LENGTH = 9;
const RTN_FORMAT_ERROR = "El RTN debe contener 14 digitos numericos.";

const normalizeText = (value) => String(value ?? "").trim();

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");
const limitText = (value, max) => String(value ?? "").slice(0, max);

const formatRtn = (rawValue) => {
  const clean = limitText(digitsOnly(rawValue), RTN_DIGITS_LENGTH);
  const part1 = clean.slice(0, 4);
  const part2 = clean.slice(4, 8);
  const part3 = clean.slice(8, 14);

  if (clean.length <= 4) return part1;
  if (clean.length <= 8) return `${part1}-${part2}`;
  return `${part1}-${part2}-${part3}`;
};

const resolveCaretFromDigitIndex = (formattedValue, digitIndex) => {
  if (!formattedValue) return 0;
  if (digitIndex <= 0) return 0;

  let seenDigits = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    const char = formattedValue[index];
    if (char >= "0" && char <= "9") {
      seenDigits += 1;
      if (seenDigits >= digitIndex) return index + 1;
    }
  }

  return formattedValue.length;
};

const formatPhone = (digits8) => {
  const clean = String(digits8 ?? "");
  const part1 = clean.slice(0, 4);
  const part2 = clean.slice(4, 8);
  if (clean.length <= 4) return part1;
  return `${part1}-${part2}`;
};

const findCatalogLabelById = (catalog, idKey, labelKey, idValue) => {
  const idAsText = normalizeText(idValue);
  if (!idAsText) return "";
  const found = (Array.isArray(catalog) ? catalog : []).find(
    (item) => normalizeText(item?.[idKey]) === idAsText
  );
  return normalizeText(found?.[labelKey]);
};

const normalizeListResponse = (resp) => {
  if (Array.isArray(resp)) {
    return { data: resp, total: resp.length };
  }

  const data = (resp && (resp.data || resp.items || resp.rows || resp.resultados)) || [];
  const total =
    (resp && (resp.total || resp.totalItems || resp.count || resp.total_count)) ||
    (Array.isArray(data) ? data.length : 0);

  return { data: Array.isArray(data) ? data : [], total: Number(total) || 0 };
};

const resolveCardsPerPage = (width) => {
  if (width >= 1200) return 6;
  if (width >= 620) return 4;
  return 2;
};

const toDisplayValue = (value, fallback = "No registrado") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const readViewMode = (storageKey) => {
  if (typeof window === "undefined") return "cards";
  try {
    return window.localStorage.getItem(storageKey) === "table" ? "table" : "cards";
  } catch {
    return "cards";
  }
};

const isEmpresaActiva = (empresa) => {
  const raw = empresa?.estado;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (["true", "1", "t", "si", "activo"].includes(normalized)) return true;
    if (["false", "0", "f", "no", "inactivo"].includes(normalized)) return false;
  }
  return false;
};

export default function Empresas({ openToast }) {
  const safeToast = useCallback(
    (title, message, variant = "success") => {
      if (typeof openToast === "function") openToast(title, message, variant);
    },
    [openToast]
  );

  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);

  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState(() => readViewMode("empresasViewMode"));

  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [sortBy, setSortBy] = useState("recientes");
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    idToDelete: null,
    nombre: "",
  });

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const catalogosCargadosRef = useRef(false);
  const rtnInputRef = useRef(null);
  const rtnCaretRef = useRef(null);
  const telefonoInputRef = useRef(null);
  const telefonoCaretRef = useRef(null);
  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === "undefined" ? 6 : resolveCardsPerPage(window.innerWidth)
  );

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isAnyDrawerOpen = showModal || filtersOpen;

  const blurFocusedElementInside = useCallback((containerId) => {
    if (typeof document === "undefined") return;
    const container = document.getElementById(containerId);
    const active = document.activeElement;
    if (!container || !active) return;
    if (container.contains(active) && typeof active.blur === "function") {
      active.blur();
    }
  }, []);

  const closeFormDrawer = useCallback(() => {
    blurFocusedElementInside("emp-form-drawer");
    setShowModal(false);
  }, [blurFocusedElementInside]);

  const buildFormFromEmpresa = useCallback(
    (empresa) => ({
      rtn: formatRtn(empresa?.rtn),
      nombre_empresa: normalizeText(empresa?.nombre_empresa),
      id_telefono: formatPhone(
        limitText(
          digitsOnly(
            empresa?.telefono ??
              empresa?.telefono_numero ??
              empresa?.numero_telefono ??
              findCatalogLabelById(
                telefonos,
                "id_telefono",
                "telefono",
                empresa?.id_telefono
              )
          ),
          PHONE_DIGITS_LENGTH
        )
      ),
      id_direccion: normalizeText(
        empresa?.direccion ??
          empresa?.direccion_detalle ??
          findCatalogLabelById(
            direcciones,
            "id_direccion",
            "direccion",
            empresa?.id_direccion
          )
      ),
      id_correo: normalizeText(
        empresa?.correo ??
          empresa?.direccion_correo ??
          empresa?.email ??
          findCatalogLabelById(
            correos,
            "id_correo",
            "direccion_correo",
            empresa?.id_correo
          )
      ),
      estado: isEmpresaActiva(empresa),
    }),
    [telefonos, direcciones, correos]
  );

  const buildEmpresaPayloadFromForm = useCallback(
    (sourceForm) => {
      const rtnRaw = limitText(digitsOnly(sourceForm?.rtn), RTN_DIGITS_LENGTH);
      const telefonoRaw = limitText(digitsOnly(sourceForm?.id_telefono), PHONE_DIGITS_LENGTH);
      const direccion = normalizeText(sourceForm?.id_direccion);
      const correo = normalizeText(sourceForm?.id_correo);

      const payload = {
        rtn: rtnRaw,
        nombre_empresa: normalizeText(sourceForm?.nombre_empresa),
        estado: Boolean(sourceForm?.estado),
      };

      if (telefonoRaw) payload.texto_telefono = formatPhone(telefonoRaw);
      if (direccion) payload.texto_direccion = direccion;
      if (correo) payload.texto_correo = correo;

      return payload;
    },
    []
  );

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
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudieron cargar catalogos", "danger");
    }
  }, [safeToast]);

  const cargarEmpresas = useCallback(async () => {
    setLoading(true);
    const requestId = ++requestIdRef.current;

    try {
      const resp = await personaService.getEmpresas({
        page,
        limit,
        nombre: search?.trim() || undefined,
      });
      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const { data, total: totalResp } = normalizeListResponse(resp);
      setEmpresas(data);
      setTotal(totalResp);
    } catch (error) {
      if (!mountedRef.current) return;
      safeToast("ERROR", error.message || "No se pudo cargar empresas", "danger");
      setEmpresas([]);
      setTotal(0);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, limit, search, safeToast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    cargarEmpresas();
  }, [cargarEmpresas]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const onResize = () => setCardsPerPage(resolveCardsPerPage(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("empresasViewMode", viewMode);
    } catch {
      // Keep working even if storage is unavailable.
    }
  }, [viewMode]);

  useLayoutEffect(() => {
    if (rtnCaretRef.current === null) return;
    const input = rtnInputRef.current;
    if (!input) return;

    const nextCaret = rtnCaretRef.current;
    rtnCaretRef.current = null;
    try {
      input.setSelectionRange(nextCaret, nextCaret);
    } catch {
      // Some browsers can throw when the element is not focusable.
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
      // Some browsers can throw when the element is not focusable.
    }
  }, [form.id_telefono]);

  useEffect(() => {
    if (!showModal || !editId) return;
    const empresaActual = empresas.find((item) => String(item.id_empresa) === String(editId));
    if (!empresaActual) return;

    setForm((prev) => {
      const resolved = buildFormFromEmpresa(empresaActual);
      const next = { ...prev };

      if (!prev.id_telefono && resolved.id_telefono) next.id_telefono = resolved.id_telefono;
      if (!prev.id_direccion && resolved.id_direccion) next.id_direccion = resolved.id_direccion;
      if (!prev.id_correo && resolved.id_correo) next.id_correo = resolved.id_correo;

      return next;
    });
  }, [showModal, editId, empresas, buildFormFromEmpresa]);

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

  const validar = useCallback(() => {
    const currentErrors = {};
    const rtnRaw = limitText(digitsOnly(form.rtn), RTN_DIGITS_LENGTH);
    const telefonoRaw = digitsOnly(form.id_telefono);
    const correoValue = normalizeText(form.id_correo);

    if (!form.nombre_empresa?.trim()) currentErrors.nombre_empresa = "Requerido";
    if (!rtnRaw) {
      currentErrors.rtn = "Requerido";
    } else if (rtnRaw.length !== RTN_DIGITS_LENGTH) {
      currentErrors.rtn = RTN_FORMAT_ERROR;
    }

    if (telefonoRaw && telefonoRaw.length !== PHONE_DIGITS_LENGTH) {
      currentErrors.id_telefono = "Formato invalido";
    }

    if (correoValue && !EMAIL_WITH_DOMAIN_REGEX.test(correoValue)) {
      currentErrors.id_correo = "Ingrese un correo valido con dominio";
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  }, [form]);

  const guardar = async (event) => {
    event.preventDefault();
    if (!validar() || actionLoading) return;

    const payloadActual = buildEmpresaPayloadFromForm(form);
    setActionLoading(true);
    try {
      if (editId) {
        const empresaOriginal = empresas.find((item) => String(item.id_empresa) === String(editId));
        if (!empresaOriginal) {
          safeToast("ERROR", "No se encontro la empresa a editar", "danger");
          await cargarEmpresas();
          return;
        }

        const originalForm = buildFormFromEmpresa(empresaOriginal);
        const originalPayload = buildEmpresaPayloadFromForm(originalForm);
        const changedPayload = Object.fromEntries(
          Object.keys(payloadActual)
            .filter(
              (key) =>
                String(payloadActual[key] ?? "") !== String(originalPayload[key] ?? "")
            )
            .map((key) => [key, payloadActual[key]])
        );

        if (!Object.keys(changedPayload).length) {
          safeToast("INFO", "No hay cambios para guardar", "info");
        } else {
          await personaService.updateEmpresa(editId, changedPayload);
          safeToast("OK", "Empresa actualizada");
        }
      } else {
        await personaService.createEmpresa(payloadActual);
        safeToast("OK", "Empresa creada");
      }

      closeFormDrawer();
      setEditId(null);
      setForm(emptyForm);
      await cargarEmpresas();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo guardar", "danger");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  };

  const iniciarEdicion = (empresa) => {
    setFiltersOpen(false);
    setEditId(empresa.id_empresa);
    setErrors({});
    setForm(buildFormFromEmpresa(empresa));
    setShowModal(true);
  };

  const openCreate = () => {
    if (actionLoading || deletingId) return;
    setFiltersOpen(false);
    setEditId(null);
    setErrors({});
    setForm(emptyForm);
    setShowModal(true);
  };

  const openConfirmDelete = (empresa) => {
    setConfirmModal({
      show: true,
      idToDelete: empresa?.id_empresa ?? null,
      nombre: empresa?.nombre_empresa || "",
    });
  };

  const closeConfirmDelete = () =>
    setConfirmModal({ show: false, idToDelete: null, nombre: "" });

  const eliminarConfirmado = async () => {
    const id = confirmModal.idToDelete;
    if (!id || actionLoading || deletingId) return;

    setDeletingId(id);
    try {
      await personaService.deleteEmpresa(id);

      if (String(editId) === String(id)) {
        closeFormDrawer();
        setEditId(null);
        setForm(emptyForm);
      }

      const quedaVaciaPagina = empresas.length === 1 && page > 1;
      if (quedaVaciaPagina) {
        setPage((prev) => Math.max(1, prev - 1));
      } else {
        await cargarEmpresas();
      }

      safeToast("OK", "Empresa eliminada");
      closeConfirmDelete();
    } catch (error) {
      safeToast("ERROR", error.message || "No se pudo eliminar", "danger");
      await cargarEmpresas();
    } finally {
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const empresasFiltradas = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const list = [...(Array.isArray(empresas) ? empresas : [])];

    const filtered = list.filter((empresa) => {
      const activa = isEmpresaActiva(empresa);
      const matchEstado =
        estadoFiltro === "todos" ? true : estadoFiltro === "activo" ? activa : !activa;
      if (!matchEstado) return false;

      if (!needle) return true;

      const hay = [
        empresa?.nombre_empresa,
        empresa?.rtn,
        empresa?.telefono,
        empresa?.telefono_numero,
        empresa?.numero_telefono,
        empresa?.correo,
        empresa?.direccion_correo,
        empresa?.email,
        empresa?.direccion,
        empresa?.direccion_detalle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === "nombre_asc") {
        return String(a?.nombre_empresa || "").localeCompare(String(b?.nombre_empresa || ""), "es", {
          sensitivity: "base",
        });
      }
      if (sortBy === "nombre_desc") {
        return String(b?.nombre_empresa || "").localeCompare(String(a?.nombre_empresa || ""), "es", {
          sensitivity: "base",
        });
      }
      return Number(b?.id_empresa ?? 0) - Number(a?.id_empresa ?? 0);
    });

    return filtered;
  }, [empresas, search, estadoFiltro, sortBy]);

  const stats = useMemo(() => {
    const totalFiltradas = empresasFiltradas.length;
    const activas = empresasFiltradas.filter((item) => isEmpresaActiva(item)).length;
    return { total: totalFiltradas, activas, inactivas: totalFiltradas - activas };
  }, [empresasFiltradas]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || estadoFiltro !== "todos" || sortBy !== "recientes",
    [search, estadoFiltro, sortBy]
  );

  const colsClass = cardsPerPage >= 6 ? "cols-3" : cardsPerPage >= 4 ? "cols-2" : "cols-1";
  const drawerMode = editId ? "edit" : "create";

  const openFiltersDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const closeFiltersDrawer = () => setFiltersOpen(false);

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro || "todos");
    setSortBy(filtersDraft.sortBy || "recientes");
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro("todos");
    setSortBy("recientes");
    setFiltersDraft(createInitialFiltersDraft());
  };

  const clearAllFilters = () => {
    setSearch("");
    clearVisualFilters();
    setFiltersOpen(false);
  };

  const closeAnyDrawer = () => {
    if (actionLoading) return;
    closeFormDrawer();
    setFiltersOpen(false);
  };

  return (
    <div className="personas-page">
      <div className="inv-catpro-card inv-prod-card personas-page__panel mb-3">
        <HeaderModulo
          iconClass="bi bi-buildings-fill"
          title="Empresas"
          subtitle="Gestion visual de empresas"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nombre, RTN, telefono, correo o direccion..."
          searchAriaLabel="Buscar empresas"
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          createOpen={showModal}
          onOpenCreate={openCreate}
          createLabel="Nuevo"
          filtersControlsId="emp-filtros-drawer"
          formControlsId="emp-form-drawer"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <ModuleKPICards stats={stats} totalLabel="Total de empresas" />

        <div className="inv-catpro-body inv-prod-body p-3">
          <div className="inv-prod-results-meta personas-page__results-meta">
            <span>{loading ? "Cargando empresas..." : `${empresasFiltradas.length} resultados`}</span>
            <span>{loading ? "" : `Total: ${total}`}</span>
            {hasActiveFilters ? <span className="inv-prod-active-filter-pill">Filtros activos</span> : null}
          </div>

          <div className={`inv-catpro-list ${isAnyDrawerOpen ? "drawer-open" : ""}`}>
            {loading ? (
              <div className="inv-catpro-loading" role="status" aria-live="polite">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando empresas...</span>
              </div>
            ) : empresasFiltradas.length === 0 ? (
              <div className="inv-catpro-empty">
                <div className="inv-catpro-empty-icon">
                  <i className="bi bi-buildings" />
                </div>
                <div className="inv-catpro-empty-title">No hay empresas para mostrar</div>
                <div className="inv-catpro-empty-sub">
                  {hasActiveFilters ? "Prueba limpiar filtros o crea una nueva empresa." : "Crea tu primera empresa."}
                </div>

                <div className="d-flex gap-2 justify-content-center flex-wrap">
                  {hasActiveFilters ? (
                    <button type="button" className="btn btn-outline-secondary" onClick={clearAllFilters}>
                      Limpiar filtros
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={openCreate}>
                    Nueva empresa
                  </button>
                </div>
              </div>
            ) : viewMode === "table" ? (
              <EntityTable>
                <table className="table personas-page__table">
                  <thead>
                    <tr>
                      <th scope="col">Empresa</th>
                      <th scope="col">RTN</th>
                      <th scope="col">Telefono</th>
                      <th scope="col">Correo</th>
                      <th scope="col">Direccion</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Codigo</th>
                      <th scope="col" className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresasFiltradas.map((empresa, idx) => {
                      const isActive = isEmpresaActiva(empresa);
                      const idEmpresa = empresa?.id_empresa;
                      const deleting = deletingId === idEmpresa;
                      const tableIndex = (page - 1) * limit + idx;
                      const telefono = empresa?.telefono ?? empresa?.telefono_numero ?? empresa?.numero_telefono;
                      const correo = empresa?.correo ?? empresa?.direccion_correo ?? empresa?.email;
                      const direccion = empresa?.direccion ?? empresa?.direccion_detalle;

                      return (
                        <tr key={empresa?.id_empresa ?? idx} className={isActive ? "" : "is-inactive-state"}>
                          <td>
                            <strong>{tableIndex + 1}. {toDisplayValue(empresa?.nombre_empresa, "Empresa sin nombre")}</strong>
                          </td>
                          <td>{toDisplayValue(empresa?.rtn, "N/D")}</td>
                          <td>{toDisplayValue(telefono, "Sin telefono")}</td>
                          <td>{toDisplayValue(correo, "Sin correo")}</td>
                          <td>{toDisplayValue(direccion, "Sin direccion")}</td>
                          <td>
                            <span className={`inv-ins-card__badge ${isActive ? "is-ok" : "is-inactive"}`}>
                              {isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td>
                            <div className="inv-catpro-code-wrap personas-page__table-code-wrap">
                              <span className={`inv-catpro-state-dot ${isActive ? "ok" : "off"}`} />
                              <span className="inv-catpro-code">EMP-{String(idEmpresa ?? "-")}</span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="personas-page__table-actions">
                              <button
                                type="button"
                                className="inv-catpro-action edit inv-catpro-action-compact"
                                onClick={() => iniciarEdicion(empresa)}
                                title="Editar"
                                disabled={actionLoading || deleting}
                              >
                                <i className="bi bi-pencil-square" />
                                <span className="inv-catpro-action-label">Editar</span>
                              </button>

                              <button
                                type="button"
                                className="inv-catpro-action danger inv-catpro-action-compact"
                                onClick={() => openConfirmDelete(empresa)}
                                title="Eliminar"
                                disabled={actionLoading || deleting}
                              >
                                <i className={`bi ${deleting ? "bi-hourglass-split" : "bi-trash"}`} />
                                <span className="inv-catpro-action-label">{deleting ? "Eliminando..." : "Eliminar"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </EntityTable>
            ) : (
              <div className={`inv-catpro-grid inv-catpro-grid-page ${colsClass}`}>
                {empresasFiltradas.map((empresa, idx) => (
                  <EmpresaCard
                    key={empresa?.id_empresa ?? idx}
                    empresa={empresa}
                    index={(page - 1) * limit + idx}
                    onOpenEdit={iniciarEdicion}
                    onOpenDelete={openConfirmDelete}
                    actionLoading={actionLoading}
                    deletingId={deletingId}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="personas-page__pagination">
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page === 1 || loading || actionLoading || !!deletingId}
              onClick={() => setPage((prev) => prev - 1)}
            >
              <i className="bi bi-chevron-left me-1" />
              Anterior
            </button>
            <span>
              Pagina {page} de {totalPages}
            </span>

            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={page >= totalPages || loading || actionLoading || !!deletingId}
              onClick={() => setPage((prev) => prev + 1)}
            >
              Siguiente
              <i className="bi bi-chevron-right ms-1" />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? "is-hidden" : ""}`}
        onClick={openCreate}
        title="Nuevo"
        disabled={actionLoading || !!deletingId}
      >
        <i className="bi bi-plus" />
      </button>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? "show" : ""}`}
        onClick={closeAnyDrawer}
        aria-hidden={!isAnyDrawerOpen}
      />

      <ModuleFiltros
        open={filtersOpen}
        drawerId="emp-filtros-drawer"
        iconClass="bi bi-buildings-fill"
        title="Filtros de empresas"
        subtitle="Estado y orden visual del listado"
        draft={filtersDraft}
        onChangeDraft={setFiltersDraft}
        onClose={closeFiltersDrawer}
        onApply={applyFiltersDrawer}
        onClear={clearVisualFilters}
        allLabel="Todas"
        activeLabel="Activas"
        inactiveLabel="Inactivas"
      />

      <aside
        className={`inv-prod-drawer inv-cat-v2__drawer empresas-modal ${showModal ? "show" : ""} ${
          drawerMode === "create" ? "is-create" : "is-edit"
        }`}
        id="emp-form-drawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={!showModal}
      >
        <div className="inv-prod-drawer-head empresas-modal__header">
          <div className="empresas-modal__header-copy">
            <div className="inv-prod-drawer-title empresas-modal__title">
              {drawerMode === "create" ? "Nueva empresa" : "Editar empresa"}
            </div>
            <div className="inv-prod-drawer-sub empresas-modal__subtitle">
              Completa los campos y guarda los cambios.
            </div>
          </div>
          <button
            type="button"
            className="inv-prod-drawer-close empresas-modal__close"
            onClick={closeFormDrawer}
            title="Cerrar"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite empresas-modal__body" onSubmit={guardar}>
          <div className="row g-3 empresas-modal__grid">
            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label">RTN</label>
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
              />
              {errors.rtn && <div className="invalid-feedback d-block">{errors.rtn}</div>}
            </div>

            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label">Nombre empresa</label>
              <input
                className={`form-control empresas-modal__input ${errors.nombre_empresa ? "is-invalid" : ""}`}
                placeholder="Ej: Inversiones La Esperanza"
                value={form.nombre_empresa}
                onChange={(event) => handleFieldChange("nombre_empresa", event.target.value)}
              />
              {errors.nombre_empresa && <div className="invalid-feedback d-block">{errors.nombre_empresa}</div>}
            </div>

            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label">Telefono</label>
              <input
                ref={telefonoInputRef}
                type="text"
                inputMode="numeric"
                maxLength={PHONE_DISPLAY_MAX_LENGTH}
                list="emp-telefonos-sugeridos"
                placeholder="0000-0000"
                className={`form-control empresas-modal__input ${errors.id_telefono ? "is-invalid" : ""}`}
                value={form.id_telefono}
                onChange={handleTelefonoChange}
                onPaste={handleTelefonoPaste}
              />
              <datalist id="emp-telefonos-sugeridos">
                {telefonos.map((telefono) => (
                  <option key={telefono.id_telefono} value={toDisplayValue(telefono.telefono, "")} />
                ))}
              </datalist>
              {errors.id_telefono && <div className="invalid-feedback d-block">{errors.id_telefono}</div>}
            </div>

            <div className="col-12 col-md-6 empresas-modal__field">
              <label className="form-label empresas-modal__label">Direccion</label>
              <input
                type="text"
                list="emp-direcciones-sugeridas"
                placeholder="Ej: Col. Palmira, Avenida Republica..."
                className={`form-control empresas-modal__input ${errors.id_direccion ? "is-invalid" : ""}`}
                value={form.id_direccion}
                onChange={(event) => handleFieldChange("id_direccion", event.target.value)}
              />
              <datalist id="emp-direcciones-sugeridas">
                {direcciones.map((direccion) => (
                  <option key={direccion.id_direccion} value={toDisplayValue(direccion.direccion, "")} />
                ))}
              </datalist>
              {errors.id_direccion && <div className="invalid-feedback d-block">{errors.id_direccion}</div>}
            </div>

            <div className="col-12 empresas-modal__field">
              <label className="form-label empresas-modal__label">Correo</label>
              <input
                type="email"
                list="emp-correos-sugeridos"
                placeholder="empresa@dominio.com"
                className={`form-control empresas-modal__input ${errors.id_correo ? "is-invalid" : ""}`}
                value={form.id_correo}
                onChange={(event) => handleFieldChange("id_correo", event.target.value)}
              />
              <datalist id="emp-correos-sugeridos">
                {correos.map((correo) => (
                  <option key={correo.id_correo} value={toDisplayValue(correo.direccion_correo, "")} />
                ))}
              </datalist>
              {errors.id_correo && <div className="invalid-feedback d-block">{errors.id_correo}</div>}
            </div>

            <div className="col-12 empresas-modal__field empresas-modal__switch-wrap">
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={Boolean(form.estado)}
                  onChange={(event) => handleFieldChange("estado", event.target.checked)}
                  id="empresa_estado_visual"
                  disabled={actionLoading || !!deletingId}
                />
                <label className="form-check-label empresas-modal__label" htmlFor="empresa_estado_visual">
                  Registro habilitado
                </label>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-4 empresas-modal__footer">
            <button
              type="button"
              className="btn inv-prod-btn-subtle flex-fill empresas-modal__btn"
              onClick={closeFormDrawer}
              disabled={actionLoading || !!deletingId}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn inv-prod-btn-primary flex-fill empresas-modal__btn"
              disabled={actionLoading || !!deletingId}
            >
              {actionLoading ? "Guardando..." : drawerMode === "create" ? "Crear" : "Guardar"}
            </button>
          </div>
        </form>
      </aside>

      {confirmModal.show && (
        <div className="inv-pro-confirm-backdrop" role="dialog" aria-modal="true" onClick={closeConfirmDelete}>
          <div className="inv-pro-confirm-panel" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-icon">
                <i className="bi bi-exclamation-triangle-fill" />
              </div>
              <div>
                <div className="inv-pro-confirm-title">CONFIRMAR ELIMINACION</div>
                <div className="inv-pro-confirm-sub">Esta accion es permanente</div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirmDelete} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-question">Deseas eliminar esta empresa?</div>
              <div className="inv-pro-confirm-name">
                <i className="bi bi-building" />
                <span>{confirmModal.nombre || "Empresa seleccionada"}</span>
              </div>
            </div>

            <div className="inv-pro-confirm-footer">
              <button type="button" className="btn inv-pro-btn-cancel" onClick={closeConfirmDelete}>
                Cancelar
              </button>
              <button type="button" className="btn inv-pro-btn-danger" onClick={eliminarConfirmado}>
                <i className="bi bi-trash3" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
