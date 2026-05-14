export default function InlineEmpresaForm({
  form,
  errors = {},
  onFieldChange,
  disabled = false,
  nameErrorKey = "inline_empresa_nombre",
  layoutClassName = "row g-2 mt-1",
}) {
  return (
    <div className={layoutClassName}>
      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">Nombre empresa</label>
        <input
          type="text"
          className={`form-control ${errors[nameErrorKey] ? "is-invalid" : ""}`}
          value={form.nombre_empresa}
          onChange={(event) => onFieldChange("nombre_empresa", event.target.value)}
          maxLength={120}
          disabled={disabled}
        />
        {errors[nameErrorKey] ? <div className="invalid-feedback d-block">{errors[nameErrorKey]}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label text-light text-opacity-75">RTN</label>
        <input
          type="text"
          className="form-control"
          value={form.rtn}
          onChange={(event) => onFieldChange("rtn", event.target.value)}
          maxLength={32}
          disabled={disabled}
        />
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
