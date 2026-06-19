const DepartamentosFormDrawer = ({
  drawerOpen,
  drawerMode,
  editingId,
  form,
  saving,
  onChangeField,
  onSubmit,
  onClose
}) => {
  if (!drawerOpen) return null;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--create show">
      <div className="inv-prod-pmodal__overlay" onClick={onClose} />
      <div className="inv-prod-pmodal__viewport">
        <section
          id="menu-departamentos-form-drawer"
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-departamentos-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <form
            className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create menu-recetas-admin__form"
            onSubmit={onSubmit}
            noValidate
          >
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero is-create">
                <button
                  type="button"
                  className="inv-prod-drawer-close inv-ins-create-hero__close"
                  onClick={onClose}
                  title="Cerrar"
                  aria-label="Cerrar formulario"
                  disabled={saving}
                >
                  <i className="bi bi-x-lg" />
                </button>
                <div className="inv-ins-create-hero__icon">
                  <i className="bi bi-diagram-3" aria-hidden="true" />
                </div>
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__kicker">
                    {drawerMode === 'create' ? 'Nuevo Registro' : 'Edicion Activa'}
                  </div>
                  <div id="menu-departamentos-modal-title" className="inv-ins-create-hero__title">
                    {drawerMode === 'create' ? 'Nuevo departamento' : `Editar departamento #${editingId}`}
                  </div>
                </div>
              </div>

              <div className="inv-prod-pmodal__sections mt-3">
                <section className="inv-prod-pmodal__section">
                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label" htmlFor="departamento_nombre">Nombre departamento</label>
                      <input
                        id="departamento_nombre"
                        className="form-control"
                        name="nombre_departamento"
                        value={form.nombre_departamento}
                        onChange={onChangeField}
                        placeholder="Ej: Pizzas"
                        maxLength={50}
                        disabled={saving}
                        required
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label" htmlFor="departamento_descripcion">Descripcion</label>
                      <input
                        id="departamento_descripcion"
                        className="form-control"
                        name="descripcion"
                        value={form.descripcion}
                        onChange={onChangeField}
                        placeholder="Ej: Categoria de recetas de pizzas"
                        maxLength={50}
                        disabled={saving}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Estado</label>
                      <div
                        className="menu-recetas-admin__status-pill menu-recetas-admin__status-pill--readonly"
                        aria-label="Estado actual de departamento"
                      >
                        {String(form?.estado || 'true') === 'false' ? 'Inactivo' : 'Activo'}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : drawerMode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default DepartamentosFormDrawer;
