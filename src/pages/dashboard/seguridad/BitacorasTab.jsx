import { useEffect, useRef, useState } from "react";
import InlineLoader from "../../../components/common/InlineLoader";
import SinPermiso from "../../../components/common/SinPermiso";
import { usePermisos } from "../../../context/PermisosContext";
import { fmtHN } from "../../../utils/dateTime";
import { securityAuditApi } from "./services/securityAuditApi";
import "./sesiones-ui.css";

const PAGE_SIZE = 10;
const AUTO_REFRESH_MS = 5000;

const fmtDate = (value) => fmtHN(value);

const toDisplay = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text ? text : "";
};

const safeJson = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { value };
    }
  }
  return value;
};

const hasJsonPayload = (value) => {
  const normalized = safeJson(value);
  if (!normalized) return false;
  if (Array.isArray(normalized)) return normalized.length > 0;
  if (typeof normalized === "object") return Object.keys(normalized).length > 0;
  return true;
};

const plainTextValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const estadoLabel = (value) => {
  if (value === true || value === 1) return "ACTIVO";
  if (value === false || value === 0) return "INACTIVO";

  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  if (["true", "1", "t", "si", "yes", "y", "activo", "activa"].includes(text)) return "ACTIVO";
  if (["false", "0", "f", "no", "n", "inactivo", "inactiva"].includes(text)) return "INACTIVO";
  return "";
};

const plainTextDetails = (value) => {
  const normalized = safeJson(value);
  if (!hasJsonPayload(normalized)) return "";

  if (Array.isArray(normalized)) {
    return normalized
      .map((item, idx) => `${idx + 1}. ${plainTextValue(item)}`)
      .join("\n");
  }

  if (typeof normalized === "object") {
    return Object.entries(normalized)
      .map(([key, val]) => {
        const normalizedKey = String(key ?? "").trim().toLowerCase();
        if (normalizedKey === "estado") {
          const label = estadoLabel(val);
          return `${key}: ${label || plainTextValue(val)}`;
        }
        return `${key}: ${plainTextValue(val)}`;
      })
      .join("\n");
  }

  return plainTextValue(normalized);
};

const changedFieldsLabel = (beforeValue, afterValue) => {
  const beforeJson = safeJson(beforeValue);
  const afterJson = safeJson(afterValue);

  if (!beforeJson || !afterJson) return "";
  if (typeof beforeJson !== "object" || typeof afterJson !== "object") return "";
  if (Array.isArray(beforeJson) || Array.isArray(afterJson)) return "";

  const keys = new Set([...Object.keys(beforeJson), ...Object.keys(afterJson)]);
  const changed = [...keys].filter(
    (key) => JSON.stringify(beforeJson[key]) !== JSON.stringify(afterJson[key])
  );

  if (changed.length === 0) return "";
  return `Campos modificados: ${changed.join(", ")}`;
};

const descripcionDisplay = (row) => {
  const desc = String(row?.descripcion || "").trim();
  if (desc) return desc;

  const puntual = changedFieldsLabel(row?.datos_antes, row?.datos_despues);
  if (puntual) return puntual;

  return `Accion ${toDisplay(row?.accion)} ejecutada por ${toDisplay(row?.usuario_display)}`;
};

const friendlyError = (err) => {
  const raw = String(err?.message || "").trim();
  if (!raw) return "No se pudo cargar bitacoras.";
  if (raw.includes("Cannot GET") || raw.includes("<!DOCTYPE")) {
    return "No se pudo obtener bitacoras desde el endpoint de Seguridad.";
  }
  return raw;
};

const JsonModal = ({ title, value, onClose }) => {
  if (!title) return null;
  const details = plainTextDetails(value);

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" aria-modal="true">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            {details ? (
              <pre className="mb-0 small" style={{ maxHeight: 420, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {details}
              </pre>
            ) : (
              <div className="text-muted">Sin datos registrados.</div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BitacorasTab = () => {
  const { isSuperAdmin, loading: permisosLoading } = usePermisos();

  const [loading, setLoading] = useState(true);
  const [noPermiso, setNoPermiso] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [modalState, setModalState] = useState({ title: "", value: null });

  const canPrev = offset > 0;
  const canNext = offset + rows.length < total;
  const shown = Math.min(offset + rows.length, total);

  const load = async ({ silent = false } = {}) => {
    if (!isSuperAdmin) return;

    if (!silent) {
      setLoading(true);
      setError("");
      setNoPermiso(false);
    }

    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(offset));
      if (search) qs.set("usuario", search);
      qs.set("_ts", String(Date.now()));

      const data = await securityAuditApi.getBitacoras(qs.toString());
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total) || 0);
      setLastUpdated(Date.now());
    } catch (e) {
      if (e?.status === 403) {
        setNoPermiso(true);
        return;
      }
      setError(friendlyError(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (permisosLoading) return;
    if (!isSuperAdmin) {
      setNoPermiso(true);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, permisosLoading, search, offset]);

  useEffect(() => {
    if (permisosLoading || !isSuperAdmin) return undefined;
    const t = setInterval(() => {
      loadRef.current?.({ silent: true });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [isSuperAdmin, permisosLoading]);

  const onSearchInput = (value) => {
    setSearchInput(value);
    setOffset(0);
    setSearch(value.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setOffset(0);
  };

  const openJsonModal = (title, value) => {
    setModalState({ title, value });
  };

  const closeJsonModal = () => {
    setModalState({ title: "", value: null });
  };

  const renderJsonCell = (title, value) => {
    if (!hasJsonPayload(value)) {
      return <span className="text-muted small">Sin datos</span>;
    }

    return (
      <div className="d-flex align-items-center">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => openJsonModal(title, value)}
        >
          Ver
        </button>
      </div>
    );
  };

  if (noPermiso) {
    return (
      <SinPermiso
        permiso="SEGURIDAD_SESIONES_VER_GLOBAL"
        detalle="Solo Super Admin puede consultar bitacoras."
      />
    );
  }

  return (
    <>
      <div className="card shadow-sm sec-sesiones-shell" style={{ backgroundColor: "#fff" }}>
        <div className="card-body p-0">
          <div className="sec-panel-header sec-sesiones-header">
            <div className="sec-panel-title-wrap">
              <div className="sec-panel-title-row">
                <i className="bi bi-clipboard-data sec-panel-title-icon" />
                <span className="sec-panel-title">BITACORAS</span>
              </div>
              <div className="sec-panel-subtitle">Auditoria general de acciones administrativas</div>
            </div>

            <div className="sec-panel-header-actions sec-sesiones-header-actions">
              <label className="sec-toolbar-search sec-sesiones-search" aria-label="Buscar en bitacoras por usuario">
                <i className="bi bi-search" />
                <input
                  type="search"
                  placeholder="ID o usuario..."
                  value={searchInput}
                  onChange={(e) => onSearchInput(e.target.value)}
                  onInput={(e) => onSearchInput(e.currentTarget.value)}
                />
              </label>
              <button className="btn btn-outline-secondary sec-sesiones-global-btn" type="button" onClick={clearSearch}>
                Limpiar
              </button>
            </div>
          </div>

          <div className="sec-panel-body p-3 sec-sesiones-body">
            {loading ? <InlineLoader /> : null}
            {error ? <div className="alert alert-danger">{error}</div> : null}

            {!loading && !error ? (
              <>
                <div className="sec-results-meta sec-sesiones-results-meta">
                  <span>Mostrando {shown} de {total}</span>
                  <span className="text-muted">
                    Ultima actualizacion: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "-"} (auto 5 s)
                  </span>
                </div>

                <div className="sec-sesiones-table-card">
                  <div className="table-responsive sec-sesiones-table-responsive">
                    <table className="table table-hover align-middle mb-0 sec-sesiones-table">
                      <thead>
                        <tr>
                          <th>USUARIO</th>
                          <th>ACCION</th>
                          <th>DESCRIPCION</th>
                          <th>IP_ORIGEN</th>
                          <th>DATOS_ANTES</th>
                          <th>DATOS_DESPUES</th>
                          <th>FECHA/HORA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="text-center text-muted py-4">
                              No hay registros para la busqueda actual.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row) => (
                            <tr key={row.id_bitacora}>
                              <td>{toDisplay(row.usuario_display)}</td>
                              <td>{toDisplay(row.accion)}</td>
                              <td>{descripcionDisplay(row)}</td>
                              <td>{toDisplay(row.ip_origen)}</td>
                              <td>{renderJsonCell("DATOS_ANTES", row.datos_antes)}</td>
                              <td>{renderJsonCell("DATOS_DESPUES", row.datos_despues)}</td>
                              <td>{fmtDate(row.fecha_hora)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">Mostrando {shown} de {total}</small>

                  <div className="btn-group">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={!canPrev}
                      onClick={() => setOffset((v) => Math.max(0, v - PAGE_SIZE))}
                    >
                      Anterior
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={!canNext}
                      onClick={() => setOffset((v) => v + PAGE_SIZE)}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <JsonModal title={modalState.title} value={modalState.value} onClose={closeJsonModal} />
    </>
  );
};

export default BitacorasTab;
