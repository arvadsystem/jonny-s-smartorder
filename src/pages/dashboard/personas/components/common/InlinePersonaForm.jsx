export default function InlinePersonaForm({
  form,
  errors = {},
  onFieldChange,
  disabled = false,
  nameErrorKey = "inline_persona_nombre",
  lastNameErrorKey = "inline_persona_apellido",
  layoutClassName = "row g-2 mt-1",
}) {
  return (
    <div className={layoutClassName}>
      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">Nombre</label>
        <input
          type="text"
          className={`form-control ${errors[nameErrorKey] ? "is-invalid" : ""}`}
          value={form.nombre}
          onChange={(event) => onFieldChange("nombre", event.target.value)}
          maxLength={80}
          disabled={disabled}
        />
        {errors[nameErrorKey] ? <div className="invalid-feedback d-block">{errors[nameErrorKey]}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">Apellido</label>
        <input
          type="text"
          className={`form-control ${errors[lastNameErrorKey] ? "is-invalid" : ""}`}
          value={form.apellido}
          onChange={(event) => onFieldChange("apellido", event.target.value)}
          maxLength={80}
          disabled={disabled}
        />
        {errors[lastNameErrorKey] ? <div className="invalid-feedback d-block">{errors[lastNameErrorKey]}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">DNI</label>
        <input
          type="text"
          className="form-control"
          value={form.dni}
          onChange={(event) => onFieldChange("dni", event.target.value)}
          maxLength={20}
          disabled={disabled}
        />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">Genero</label>
        <select
          className="form-select"
          value={form.genero}
          onChange={(event) => onFieldChange("genero", event.target.value)}
          disabled={disabled}
        >
          <option value="">Seleccione</option>
          <option value="M">Masculino</option>
          <option value="F">Femenino</option>
        </select>
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">Telefono</label>
        <input
          type="text"
          className="form-control"
          value={form.texto_telefono}
          onChange={(event) => onFieldChange("texto_telefono", event.target.value)}
          maxLength={20}
          disabled={disabled}
        />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">Correo</label>
        <input
          type="email"
          className="form-control"
          value={form.texto_correo}
          onChange={(event) => onFieldChange("texto_correo", event.target.value)}
          maxLength={120}
          disabled={disabled}
        />
      </div>

      <div className="col-12">
        <label className="form-label text-light text-opacity-75">Direccion</label>
        <input
          type="text"
          className="form-control"
          value={form.texto_direccion}
          onChange={(event) => onFieldChange("texto_direccion", event.target.value)}
          maxLength={180}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
