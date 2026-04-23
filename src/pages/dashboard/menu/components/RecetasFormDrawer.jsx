import { useRef } from 'react';
import RecetasImagePreview from './RecetasImagePreview';
import { shouldRequireSpiceLevel } from '../utils/recetasAdminUtils';

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
  onPickImageFile,
  selectedImageFileName,
  formPreviewUrl,
  formPreviewError,
  onPreviewError
}) => {
  const requiresSpiceLevel = shouldRequireSpiceLevel(form?.nombre_receta);
  const imageInputRef = useRef(null);

  return (
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
            <label className="form-label">Imagen</label>
            <div className="menu-recetas-admin__image-editor">
              <RecetasImagePreview
                imageUrl={formPreviewUrl}
                hasError={formPreviewError}
                onError={onPreviewError}
                compact
              />

              <div className="menu-recetas-admin__image-controls">
                <div
                  className="menu-recetas-admin__status-pill menu-recetas-admin__status-pill--readonly"
                  aria-label="Estado actual de receta"
                >
                  {String(form?.estado || 'true') === 'false' ? 'Inactivo' : 'Activo'}
                </div>

                <div className="menu-recetas-admin__image-actions">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="d-none"
                    onChange={(event) => {
                      onPickImageFile?.(event.target.files?.[0] || null);
                      event.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="btn menu-recetas-admin__image-btn menu-recetas-admin__image-btn--add"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <i className="bi bi-upload" aria-hidden="true" /> Agregar imagen
                  </button>
                  <button
                    type="button"
                    className="btn menu-recetas-admin__image-btn menu-recetas-admin__image-btn--ghost menu-recetas-admin__image-btn--remove"
                    onClick={onClearImage}
                  >
                    Quitar
                  </button>
                </div>

                <small className="menu-recetas-admin__image-help">JPG, PNG o WEBP hasta 6 MB.</small>
                {selectedImageFileName ? (
                  <small className="menu-recetas-admin__image-file-name">Archivo: {selectedImageFileName}</small>
                ) : null}
              </div>
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

          {requiresSpiceLevel && (
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
                required
              />
              <div className="form-text">Campo obligatorio solo para recetas de alitas o tenders.</div>
            </div>
          )}

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
};

export default RecetasFormDrawer;
