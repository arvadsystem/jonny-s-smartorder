import { useEffect, useMemo, useState } from "react";
import { personaService } from "../../../services/personasService";

const PersonasTab = ({ openToast }) => {

  // ==============================
  // TOAST
  // ==============================
  const safeToast = (title, message, variant = "success") => {
    if (typeof openToast === "function") openToast(title, message, variant);
  };

  // ==============================
  // ESTADOS FK
  // ==============================
  const [telefonos, setTelefonos] = useState([]);
  const [direcciones, setDirecciones] = useState([]);
  const [correos, setCorreos] = useState([]);

  // ==============================
  // ETIQUETAS
  // ==============================
  const columnLabels = {
    id_persona: "ID",
    nombre: "Nombre",
    apellido: "Apellido",
    dni: "DNI",
    genero: "Género",
    rtn: "RTN",
    fecha_nacimiento: "Fecha nacimiento",
    telefono: "Teléfono",
    direccion: "Dirección",
    correo: "Correo",
  };

  // ==============================
  // FORMATO FECHA
  // ==============================
  const formatDate = (value) => {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleDateString("es-HN");
  };

  // ==============================
  // ESTADOS PRINCIPALES
  // ==============================
  const [personas, setPersonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // ==============================
  // FORM CREAR
  // ==============================
  const emptyForm = {
    nombre: "",
    apellido: "",
    dni: "",
    genero: "",
    rtn: "",
    fecha_nacimiento: "",
    id_telefono: "",
    id_direccion: "",
    id_correo: "",
  };

  const [form, setForm] = useState(emptyForm);

  // ==============================
  // EDITAR
  // ==============================
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // ==============================
  // CARGAR TODO
  // ==============================
  const cargar = async () => {
    setLoading(true);
    try {
      const [
        personasData,
        telData,
        dirData,
        correoData
      ] = await Promise.all([
        personaService.getPersonasDetalle(),
        personaService.getTelefonos(),
        personaService.getDirecciones(),
        personaService.getCorreos(),
      ]);

      setPersonas(Array.isArray(personasData) ? personasData : []);
      setTelefonos(Array.isArray(telData) ? telData : []);
      setDirecciones(Array.isArray(dirData) ? dirData : []);
      setCorreos(Array.isArray(correoData) ? correoData : []);

    } catch (e) {
      const msg = e?.message || "Error cargando datos";
      setError(msg);
      safeToast("ERROR", msg, "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // ==============================
  // CREAR
  // ==============================
  const onCrear = async (e) => {
    e.preventDefault();
    try {
      await personaService.crearPersona(form);
      setForm(emptyForm);
      await cargar();
      safeToast("CREADO", "PERSONA CREADA", "success");
    } catch (e) {
      const msg = e?.message || "Error creando";
      setError(msg);
      safeToast("ERROR", msg, "danger");
    }
  };

  // ==============================
  // EDITAR
  // ==============================
  const iniciarEdicion = (p) => {
    setEditId(p.id_persona);
    setEditForm({
      ...p,
      id_telefono: p.id_telefono || "",
      id_direccion: p.id_direccion || "",
      id_correo: p.id_correo || "",
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setEditForm(null);
  };

  const guardarEdicion = async () => {
    try {
      for (const key in editForm) {
        if (key === "id_persona") continue;
        await personaService.actualizarPersonaCampo(editId, key, editForm[key]);
      }

      cancelarEdicion();
      await cargar();
      safeToast("ACTUALIZADO", "PERSONA ACTUALIZADA", "success");
    } catch (e) {
      const msg = e?.message || "Error actualizando";
      setError(msg);
      safeToast("ERROR", msg, "danger");
    }
  };

  // ==============================
  // ELIMINAR
  // ==============================
  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar persona?")) return;

    try {
      await personaService.eliminarPersona(id);
      await cargar();
      safeToast("ELIMINADO", "PERSONA ELIMINADA", "success");
    } catch (e) {
      const msg = e?.message || "Error eliminando";
      setError(msg);
      safeToast("ERROR", msg, "danger");
    }
  };

  // ==============================
  // FILTRAR
  // ==============================
  const personasFiltradas = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return personas;

    return personas.filter((p) =>
      `${p.nombre} ${p.apellido} ${p.dni}`.toLowerCase().includes(s)
    );
  }, [personas, search]);

  return (
    <div className="card shadow-sm mb-3">
      <div className="card-header fw-semibold">Personas</div>

      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}

        {/* ================= FORM CREAR ================= */}
        <form onSubmit={onCrear} className="row g-2 mb-3">

          <div className="col-md-2">
            <input className="form-control" placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm(s => ({ ...s, nombre: e.target.value }))}/>
          </div>

          <div className="col-md-2">
            <input className="form-control" placeholder="Apellido"
              value={form.apellido}
              onChange={(e) => setForm(s => ({ ...s, apellido: e.target.value }))}/>
          </div>

          <div className="col-md-2">
            <input className="form-control" placeholder="DNI"
              value={form.dni}
              onChange={(e) => setForm(s => ({ ...s, dni: e.target.value }))}/>
          </div>

          <div className="col-md-2">
            <input className="form-control" placeholder="RTN"
              value={form.rtn}
              onChange={(e) => setForm(s => ({ ...s, rtn: e.target.value }))}/>
          </div>

          <div className="col-md-2">
            <select className="form-select"
              value={form.genero}
              onChange={(e) => setForm(s => ({ ...s, genero: e.target.value }))}>
              <option value="">Género</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>

          <div className="col-md-2">
            <input type="date" className="form-control"
              value={form.fecha_nacimiento}
              onChange={(e) => setForm(s => ({ ...s, fecha_nacimiento: e.target.value }))}/>
          </div>

          {/* TELEFONO */}
          <div className="col-md-2">
            <select className="form-select"
              value={form.id_telefono}
              onChange={(e) => setForm(s => ({ ...s, id_telefono: e.target.value }))}>
              <option value="">Seleccione teléfono</option>
              {telefonos.map(t => (
                <option key={t.id_telefono} value={t.id_telefono}>
                  {t.telefono}
                </option>
              ))}
            </select>
          </div>

          {/* DIRECCION */}
          <div className="col-md-3">
            <select className="form-select"
              value={form.id_direccion}
              onChange={(e) => setForm(s => ({ ...s, id_direccion: e.target.value }))}>
              <option value="">Seleccione dirección</option>
              {direcciones.map(d => (
                <option key={d.id_direccion} value={d.id_direccion}>
                  {d.direccion}
                </option>
              ))}
            </select>
          </div>

          {/* CORREO */}
          <div className="col-md-3">
            <select className="form-select"
              value={form.id_correo}
              onChange={(e) => setForm(s => ({ ...s, id_correo: e.target.value }))}>
              <option value="">Seleccione correo</option>
              {correos.map(c => (
                <option key={c.id_correo} value={c.id_correo}>
                  {c.direccion_correo}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-2 d-grid">
            <button className="btn btn-primary">Crear</button>
          </div>
        </form>

        {/* ================= BUSCADOR ================= */}
        <div className="mb-3">
          <input className="form-control" placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}/>
        </div>

        {/* ================= TABLA ================= */}
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  {Object.keys(columnLabels).map((col) => (
                    <th key={col}>{columnLabels[col]}</th>
                  ))}
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {personasFiltradas.map((p) => {
                  const isEditing = editId === p.id_persona;

                  return (
                    <tr key={p.id_persona}>
                      {Object.keys(columnLabels).map((col) => (
                        <td key={col}>
                          {isEditing ? (
                            col === "fecha_nacimiento" ? (
                              <input type="date"
                                className="form-control form-control-sm"
                                value={editForm[col] ?? ""}
                                onChange={(e) =>
                                  setEditForm(s => ({ ...s, [col]: e.target.value }))
                                }
                              />
                            ) : (
                              <input
                                className="form-control form-control-sm"
                                value={editForm[col] ?? ""}
                                onChange={(e) =>
                                  setEditForm(s => ({ ...s, [col]: e.target.value }))
                                }
                              />
                            )
                          ) : col === "fecha_nacimiento" ? (
                            formatDate(p[col])
                          ) : (
                            p[col]
                          )}
                        </td>
                      ))}

                      <td>
                        {isEditing ? (
                          <>
                            <button className="btn btn-sm btn-primary me-2"
                              onClick={guardarEdicion}>
                              Guardar
                            </button>

                            <button className="btn btn-sm btn-secondary"
                              onClick={cancelarEdicion}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-sm btn-outline-primary me-2"
                              onClick={() => iniciarEdicion(p)}>
                              Editar
                            </button>

                            <button className="btn btn-sm btn-outline-danger"
                              onClick={() => eliminar(p.id_persona)}>
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

      </div>
    </div>
  );
};

export default PersonasTab;
