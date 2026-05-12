import Select from "react-select";

const buildInlineGeneroSelectStyles = () => ({
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 10,
    borderColor: state.isFocused ? "rgba(158, 105, 61, 0.72)" : "rgba(157, 150, 112, 0.42)",
    boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(158, 105, 61, 0.18)" : "none",
    backgroundColor: "#fff",
    "&:hover": { borderColor: "rgba(158, 105, 61, 0.72)" },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 12px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: "rgba(98, 83, 73, 0.75)" }),
  singleValue: (base) => ({ ...base, color: "#2f1a10" }),
  indicatorsContainer: (base) => ({ ...base, paddingRight: 4 }),
  menuPortal: (base) => ({ ...base, zIndex: 3000 }),
});

export default function InlinePersonaForm({
  form,
  errors = {},
  onFieldChange,
  disabled = false,
  nameErrorKey = "inline_persona_nombre",
  lastNameErrorKey = "inline_persona_apellido",
  layoutClassName = "row g-2 mt-1",
}) {
  const generoOptions = [
    { value: "M", label: "Masculino" },
    { value: "F", label: "Femenino" },
    { value: "O", label: "Otro" },
  ];

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
        <Select
          inputId="inline-persona-genero-select"
          classNamePrefix="inline-persona-genero-select"
          placeholder="Seleccione"
          isClearable
          options={generoOptions}
          value={generoOptions.find((option) => option.value === String(form.genero ?? "").trim().toUpperCase()) || null}
          onChange={(option) => onFieldChange("genero", option?.value || "")}
          isDisabled={disabled}
          styles={buildInlineGeneroSelectStyles()}
          menuPortalTarget={typeof document !== "undefined" ? document.body : null}
          menuPosition="fixed"
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
