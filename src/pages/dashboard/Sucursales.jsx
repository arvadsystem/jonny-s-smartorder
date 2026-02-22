import React, { useEffect, useMemo, useState } from "react";
import Button from "../../components/common/Button";
import sucursalesService from "../../services/sucursalesService";


const initialForm = {
  id_sucursal: null,
  nombre_sucursal: "",
  texto_direccion: "",
  texto_telefono: "",
  texto_correo: "",
  fecha_inauguracion: "",
  estado: true,
};

export default function Sucursales() {
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // filtros (estilo captura: buscador + dropdown + limpiar)
  const [q, setQ] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos"); // todos | activo | inactivo

  // modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const totalCount = sucursales.length;

  useEffect(() => {
    loadSucursales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSucursales() {
    try {
      setLoading(true);
      setError("");
      const data = await sucursalesService.getAll();
      setSucursales(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar las sucursales con exito.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return sucursales
      .filter((s) => {
        if (estadoFilter === "activo") return !!s.estado;
        if (estadoFilter === "inactivo") return !s.estado;
        return true;
      })
      .filter((s) => {
        if (!needle) return true;
        const hay = [
          s.nombre_sucursal,
          s.texto_direccion,
          s.texto_telefono,
          s.texto_correo,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
  }, [sucursales, q, estadoFilter]);

  function openCreate() {
    setMode("create");
    setForm(initialForm);
    setIsModalOpen(true);
  }

  function openEdit(sucursal) {
  setMode("edit");
  setForm({
    id_sucursal: sucursal.id_sucursal ?? null,
    nombre_sucursal: sucursal.nombre_sucursal ?? "",
    texto_direccion: sucursal.texto_direccion ?? "",
    texto_telefono: sucursal.texto_telefono ?? "",
    texto_correo: sucursal.texto_correo ?? "",
    fecha_inauguracion: normalizeDateForInput(sucursal.fecha_inauguracion),
    estado: !!sucursal.estado,
  });
  setIsModalOpen(true);
}


  function closeModal() {
    if (saving) return;
    setIsModalOpen(false);
  }

  function onChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
        const payload = {
            nombre_sucursal: form.nombre_sucursal.trim(),
            texto_direccion: form.texto_direccion.trim() || null,
            texto_telefono: form.texto_telefono.trim() || null,
            texto_correo: form.texto_correo.trim() || null,
            fecha_inauguracion: form.fecha_inauguracion || null,
            estado: !!form.estado,
        };

      if (!payload.nombre_sucursal) {
        throw new Error("El nombre de la sucursal es obligatorio.");
      }

      if (mode === "create") {
        await sucursalesService.create(payload);
      } else {
        // Nota: asumo que tu service maneja update por ID (si tu API difiere, aquí se ajusta).
        await sucursalesService.updateFull(form.id_sucursal, payload);
      }

      closeModal();
      await loadSucursales();
    } catch (e2) {
      setError(e2?.message || "No se pudo guardar la sucursal.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(sucursal) {
    const ok = window.confirm(
      `¿Eliminar la sucursal "${sucursal.nombre_sucursal}"?`
    );
    if (!ok) return;

    try {
      setError("");
      await sucursalesService.delete(sucursal.id_sucursal);
      await loadSucursales();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar la sucursal.");
    }
  }

  function clearFilters() {
    setQ("");
    setEstadoFilter("todos");
  }

  return (
    <div className="container-fluid py-3">
      {/* Encabezado (similar a captura) */}
      <div className="mb-3">
        <h2 className="m-0">Sucursales</h2>
        <div className="text-muted">Total: {totalCount}</div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white">
          <strong>Gestión de sucursales</strong>
        </div>

        <div className="card-body">
          {/* Barra superior: buscador + filtro + limpiar + crear */}
          <div className="row g-2 align-items-center mb-3">
            <div className="col-12 col-lg-6">
              <input
                className="form-control"
                placeholder="Buscar por nombre, dirección, teléfono o correo..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="col-12 col-lg-2">
              <select
                className="form-select"
                value={estadoFilter}
                onChange={(e) => setEstadoFilter(e.target.value)}
              >
                <option value="todos">Todos</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="col-12 col-lg-2">
              <Button
                variant="btn-outline-secondary"
                className="w-100"
                onClick={clearFilters}
              >
                Limpiar filtros
              </Button>
            </div>

            <div className="col-12 col-lg-2 d-grid">
              <Button variant="btn-primary" onClick={openCreate}>
                Crear
              </Button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}

          {/* Tabla limpia */}
          <div className="table-responsive">
            <table className="table align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 70 }}>No.</th>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Teléfono</th>
                  <th>Correo</th>
                  <th style={{ width: 160 }}>Fecha inaug.</th>
                  <th style={{ width: 160 }}>Antigüedad</th>
                  <th style={{ width: 120 }}>Estado</th>
                  <th style={{ width: 180 }} className="text-end">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      No hay sucursales para mostrar.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s, idx) => (
                    <tr key={s.id_sucursal ?? idx}>
                      <td>{idx + 1}</td>
                      <td>{s.nombre_sucursal}</td>
                      <td>{s.texto_direccion || "-"}</td>
                      <td>{s.texto_telefono || "-"}</td>
                      <td>{s.texto_correo || "-"}</td>
                      <td>{formatDateForTable(s.fecha_inauguracion)}</td>

                      {/* listo para "antigüedad" calculada del backend */}
                      <td>
                        {s.antiguedad_calculada ??
                          s.antiguedad ??
                          s.antiguedad_texto ??
                          "-"}
                      </td>

                      <td>{s.estado ? "Activo" : "Inactivo"}</td>

                      <td className="text-end">
                        <div className="d-inline-flex gap-2">
                          <Button
                            variant="btn-outline-primary"
                            size="sm"
                            onClick={() => openEdit(s)}
                          >
                            Editar
                          </Button>

                          <Button
                            variant="btn-outline-danger"
                            size="sm"
                            onClick={() => onDelete(s)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal (controlado por estado React) */}
      {isModalOpen && (
        <>
          <div
            className="modal fade show"
            tabIndex="-1"
            role="dialog"
            style={{ display: "block" }}
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <form onSubmit={onSubmit}>
                  <div className="modal-header">
                    <h5 className="modal-title">
                      {mode === "create" ? "Crear sucursal" : "Editar sucursal"}
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      aria-label="Close"
                      onClick={closeModal}
                      disabled={saving}
                    />
                  </div>

                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label">Nombre</label>
                        <input
                          name="nombre_sucursal"
                          className="form-control"
                          placeholder="Ej: Sucursal Centro"
                          value={form.nombre_sucursal}
                          onChange={onChange}
                          required
                        />
                      </div>

                      {/* IDs (por tu tabla física) */}
                      <div className="col-12 col-md-4">
                        <label className="form-label">Dirección</label>
                        <input
                            name="texto_direccion"
                            className="form-control"
                            placeholder="Ej: Siguatepeque, Honduras"
                            value={form.texto_direccion}
                            onChange={onChange}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label">Teléfono</label>
                        <input
                            name="texto_telefono"
                            className="form-control"
                            placeholder="Ej: 33445566"
                            value={form.texto_telefono}
                            onChange={onChange}
                        />
                      </div>

                      <div className="col-12 col-md-4">
                        <label className="form-label">Correo</label>
                        <input
                            name="texto_correo"
                            className="form-control"
                            placeholder="Ej: admin@sucursal.com"
                            value={form.texto_correo}
                            onChange={onChange}
                        />
                      </div>

                      <div className="col-12 col-md-6">
                        <label className="form-label">Fecha de inauguración</label>
                        <input
                          type="date"
                          name="fecha_inauguracion"
                          className="form-control"
                          value={form.fecha_inauguracion}
                          onChange={onChange}
                        />
                      </div>

                      <div className="col-12 col-md-6 d-flex align-items-end">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="estadoSucursal"
                            name="estado"
                            checked={form.estado}
                            onChange={onChange}
                          />
                          <label className="form-check-label" htmlFor="estadoSucursal">
                            Activo
                          </label>
                        </div>
                      </div>
                    </div>

                    
                  </div>

                  <div className="modal-footer">
                    <Button
                      variant="btn-outline-secondary"
                      onClick={closeModal}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>

                    <Button variant="btn-primary" type="submit" disabled={saving}>
                      {saving ? "Guardando..." : mode === "create" ? "Crear" : "Guardar"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Backdrop */}
          <div className="modal-backdrop fade show" onClick={closeModal} />
        </>
      )}
    </div>
  );
}

/* Helpers */
function normalizeDateForInput(value) {
  if (!value) return "";
  // si viene ISO o Date string
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateForTable(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}
