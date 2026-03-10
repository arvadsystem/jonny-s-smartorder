import RecetasImagePreview from './RecetasImagePreview';

const RecetasFormDrawer = ({
  drawerOpen,
  drawerMode,
  editingId,
  form,
  saving,
  onChangeField,
  onSubmit,
  onClose,
  onClearImage,
  formPreviewUrl,
  formPreviewError,
  onPreviewError
}) => (
  <aside
    className={`inv-prod-drawer inv-cat-v2__drawer ${drawerOpen ? 'show' : ''}`}
    id="menu-recetas-form-drawer"
    role="dialog"
    aria-modal="true"
    aria-hidden={!drawerOpen}
  >
    <div className="inv-prod-drawer-head">
      <i className="bi bi-journal-plus inv-cat-v2__drawer-mark" aria-hidden="true" />
      <div>
        <div className="inv-prod-drawer-title">
          {drawerMode === 'create' ? 'Nueva receta' : `Editar receta #${editingId}`}
        </div>
        <div className="inv-prod-drawer-sub">Completa la informacion y guarda cambios.</div>
      </div>
      <button
        type="button"
        className="inv-prod-drawer-close"
        onClick={onClose}
        title="Cerrar"
        aria-label="Cerrar formulario"
      >
        <i className="bi bi-x-lg" />
      </button>
    </div>

    <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite menu-recetas-admin__form" onSubmit={onSubmit}>
      <div className="row g-2">
        <div className="col-12">
          <label className="form-label" htmlFor="receta_nombre">Nombre receta</label>
          <input
            id="receta_nombre"
            className="form-control"
            name="nombre_receta"
            value={form.nombre_receta}
            onChange={onChangeField}
            required
          />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="receta_descripcion">Descripcion</label>
          <input
            id="receta_descripcion"
            className="form-control"
            name="descripcion"
            value={form.descripcion}
            onChange={onChangeField}
          />
        </div>

        <div className="col-12">
          <label className="form-label" htmlFor="receta_url_imagen">URL imagen publica (Drive)</label>
          <input
            id="receta_url_imagen"
            className="form-control"
            name="url_imagen_publica"
            value={form.url_imagen_publica}
            onChange={onChangeField}
            placeholder="https://..."
          />
          <div className="form-text">
            Puedes pegar directamente el enlace compartido de Google Drive. El sistema lo convierte automaticamente para preview y guardado en `archivos`.
          </div>

          <RecetasImagePreview
            imageUrl={formPreviewUrl}
            hasError={formPreviewError}
            onError={onPreviewError}
          />

          <div className="d-flex justify-content-end mt-2">
            <button type="button" className="btn inv-prod-btn-subtle btn-sm" onClick={onClearImage}>
              Quitar URL
            </button>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="receta_precio">Precio</label>
          <input
            id="receta_precio"
            type="number"
            min="0"
            step="0.01"
            className="form-control"
            name="precio"
            value={form.precio}
            onChange={onChangeField}
            required
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="receta_id_menu">ID menu</label>
          <input
            id="receta_id_menu"
            type="number"
            min="1"
            className="form-control"
            name="id_menu"
            value={form.id_menu}
            onChange={onChangeField}
            required
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="receta_id_nivel_picante">ID nivel picante</label>
          <input
            id="receta_id_nivel_picante"
            type="number"
            min="1"
            className="form-control"
            name="id_nivel_picante"
            value={form.id_nivel_picante}
            onChange={onChangeField}
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="receta_id_usuario">ID usuario</label>
          <input
            id="receta_id_usuario"
            type="number"
            min="1"
            className="form-control"
            name="id_usuario"
            value={form.id_usuario}
            onChange={onChangeField}
            required
          />
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="receta_estado">Estado</label>
          <select
            id="receta_estado"
            className="form-select"
            name="estado"
            value={form.estado}
            onChange={onChangeField}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="receta_id_departamento">ID tipo departamento</label>
          <input
            id="receta_id_departamento"
            type="number"
            min="1"
            className="form-control"
            name="id_tipo_departamento"
            value={form.id_tipo_departamento}
            onChange={onChangeField}
            required
          />
        </div>
      </div>

      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving}>
          {saving ? 'Guardando...' : drawerMode === 'create' ? 'Crear' : 'Guardar'}
        </button>
      </div>
    </form>
  </aside>
);

export default RecetasFormDrawer;
