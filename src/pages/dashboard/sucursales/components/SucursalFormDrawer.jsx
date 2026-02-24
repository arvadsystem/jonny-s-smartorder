export default function SucursalFormDrawer({
  open,
  mode,
  form,
  saving,
  onClose,
  onSubmit,
  onFieldChange,
  fieldErrors = {},
  duplicateErrors = {},
  disableSubmit = false
}) {
  const nombreError = fieldErrors.nombre_sucursal || duplicateErrors.nombre_sucursal || '';
  const direccionError = fieldErrors.texto_direccion || duplicateErrors.texto_direccion || '';

  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${open ? 'show' : ''}`}
      id="suc-form-drawer"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="inv-prod-drawer-head">
        <i className="bi bi-shop-window inv-cat-v2__drawer-mark" aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">{mode === 'create' ? 'Nueva sucursal' : 'Editar sucursal'}</div>
          <div className="inv-prod-drawer-sub">Completa los campos y guarda los cambios.</div>
        </div>
        <button type="button" className="inv-prod-drawer-close" onClick={onClose} title="Cerrar" disabled={saving}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={onSubmit}>
        <div className="mb-2">
          <label className="form-label" htmlFor="suc_nombre">Nombre</label>
          <input
            id="suc_nombre"
            name="nombre_sucursal"
            className={`form-control ${nombreError ? 'is-invalid' : ''}`}
            value={form.nombre_sucursal}
            onChange={onFieldChange}
            placeholder="Ej: Sucursal Centro"
          />
          {nombreError ? <div className="invalid-feedback d-block">{nombreError}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="suc_direccion">Direccion</label>
          <input
            id="suc_direccion"
            name="texto_direccion"
            className={`form-control ${direccionError ? 'is-invalid' : ''}`}
            value={form.texto_direccion}
            onChange={onFieldChange}
            placeholder="Ej: Siguatepeque, Honduras"
          />
          {direccionError ? <div className="invalid-feedback d-block">{direccionError}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="suc_telefono">Telefono (opcional)</label>
          <input
            id="suc_telefono"
            name="texto_telefono"
            className={`form-control ${fieldErrors.texto_telefono ? 'is-invalid' : ''}`}
            value={form.texto_telefono}
            onChange={onFieldChange}
            placeholder="Ej: 33445566"
          />
          {fieldErrors.texto_telefono ? <div className="invalid-feedback">{fieldErrors.texto_telefono}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="suc_correo">Correo (opcional)</label>
          <input
            id="suc_correo"
            name="texto_correo"
            type="email"
            className={`form-control ${fieldErrors.texto_correo ? 'is-invalid' : ''}`}
            value={form.texto_correo}
            onChange={onFieldChange}
            placeholder="Ej: admin@sucursal.com"
          />
          {fieldErrors.texto_correo ? <div className="invalid-feedback">{fieldErrors.texto_correo}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="suc_fecha">Fecha de inauguracion (opcional)</label>
          <input
            id="suc_fecha"
            type="date"
            name="fecha_inauguracion"
            className={`form-control ${fieldErrors.fecha_inauguracion ? 'is-invalid' : ''}`}
            value={form.fecha_inauguracion}
            onChange={onFieldChange}
          />
          {fieldErrors.fecha_inauguracion ? <div className="invalid-feedback">{fieldErrors.fecha_inauguracion}</div> : null}
        </div>

        <div className="form-check mt-2 mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="suc_estado"
            name="estado"
            checked={!!form.estado}
            onChange={onFieldChange}
          />
          <label className="form-check-label" htmlFor="suc_estado">
            Activo
          </label>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving || disableSubmit}>
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </form>
    </aside>
  );
}

