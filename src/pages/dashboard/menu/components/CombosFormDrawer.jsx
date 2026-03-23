import { useMemo, useState } from 'react';
import RecetasImagePreview from './RecetasImagePreview';

const CombosFormDrawer = ({
  drawerOpen,
  drawerMode,
  editingId,
  form,
  saving,
  recetasDisponibles,
  onChangeField,
  onSubmit,
  onClose,
  onClearImage,
  formPreviewUrl,
  formPreviewError,
  loadingRecetasCatalogo,
  onPreviewError,
  onAgregarRecetaDetalle,
  onActualizarDetalleReceta,
  onQuitarRecetaDetalle
}) => {
  const [recetaSearch, setRecetaSearch] = useState('');

  const recetasFiltradas = useMemo(() => {
    const term = String(recetaSearch || '').trim().toLowerCase();
    if (!term) return recetasDisponibles;

    return (Array.isArray(recetasDisponibles) ? recetasDisponibles : []).filter((receta) => (
      String(receta?.nombre_receta || '').toLowerCase().includes(term)
      || String(receta?.id_receta || '').includes(term)
    ));
  }, [recetaSearch, recetasDisponibles]);

  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${drawerOpen ? 'show' : ''}`}
      id="menu-combos-form-drawer"
      role="dialog"
      aria-modal="true"
      aria-hidden={!drawerOpen}
    >
      <div className="inv-prod-drawer-head">
        <i className="bi bi-collection inv-cat-v2__drawer-mark" aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">
            {drawerMode === 'create' ? 'Nuevo combo' : `Editar combo #${editingId}`}
          </div>
          <div className="inv-prod-drawer-sub">Define cabecera, imagen y detalle del combo.</div>
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
            <label className="form-label" htmlFor="combo_descripcion">Descripcion</label>
            <input
              id="combo_descripcion"
              className="form-control"
              name="descripcion"
              value={form.descripcion}
              onChange={onChangeField}
              required
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="combo_precio">Precio</label>
            <input
              id="combo_precio"
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
            <label className="form-label" htmlFor="combo_cant_personas">Cant. personas</label>
            <input
              id="combo_cant_personas"
              type="number"
              min="1"
              className="form-control"
              name="cant_personas"
              value={form.cant_personas}
              onChange={onChangeField}
              required
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="combo_id_menu">ID menu</label>
            <input
              id="combo_id_menu"
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
            <label className="form-label" htmlFor="combo_id_usuario">ID usuario</label>
            <input
              id="combo_id_usuario"
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
            <label className="form-label" htmlFor="combo_estado">Estado</label>
            <select
              id="combo_estado"
              className="form-select"
              name="estado"
              value={form.estado}
              onChange={onChangeField}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="combo_url_imagen">URL imagen publica (Drive)</label>
            <input
              id="combo_url_imagen"
              className="form-control"
              name="url_imagen_publica"
              value={form.url_imagen_publica}
              onChange={onChangeField}
              placeholder="https://..."
            />
            <div className="form-text">
              Puedes pegar el enlace compartido de Google Drive. Se registra en archivos y se usa id_archivo.
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
        </div>

        <hr className="my-3" />

        <div className="mb-2 d-flex justify-content-between align-items-center gap-2">
          <strong>Detalle del combo</strong>
        </div>

        <div className="small text-muted mb-2">
          {loadingRecetasCatalogo
            ? 'Cargando recetas disponibles...'
            : `${recetasDisponibles.length} recetas disponibles para agregar.`}
        </div>

        {!loadingRecetasCatalogo ? (
          <div className="menu-combos-receta-picker mb-3">
            <input
              type="text"
              className="form-control form-control-sm menu-combos-receta-picker__search"
              placeholder="Buscar receta por nombre o ID..."
              value={recetaSearch}
              onChange={(event) => setRecetaSearch(event.target.value)}
            />

            <div className="menu-combos-receta-picker__list">
              {recetasFiltradas.length > 0 ? (
                recetasFiltradas.map((receta) => (
                  <button
                    key={`pick-${receta.id_receta}`}
                    type="button"
                    className="menu-combos-receta-picker__item"
                    onClick={() => onAgregarRecetaDetalle(receta.id_receta)}
                  >
                    <span className="menu-combos-receta-picker__item-id">#{receta.id_receta}</span>
                    <span className="menu-combos-receta-picker__item-name">
                      {receta.nombre_receta || `Receta ${receta.id_receta}`}
                    </span>
                    <span className="menu-combos-receta-picker__item-add">Agregar</span>
                  </button>
                ))
              ) : (
                <div className="small text-muted px-1 py-2">
                  No hay recetas que coincidan con la busqueda.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {Array.isArray(form.detalle) && form.detalle.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Receta</th>
                  <th style={{ width: '120px' }}>Cantidad</th>
                  <th style={{ width: '120px' }}>Orden</th>
                  <th className="text-end">Accion</th>
                </tr>
              </thead>
              <tbody>
                {form.detalle.map((item) => (
                  <tr key={item.id_receta}>
                    <td>
                      <div className="fw-semibold">#{item.id_receta}</div>
                      <div className="small text-muted">{item.nombre_receta || 'Receta'}</div>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        value={item.cantidad}
                        onChange={(event) => onActualizarDetalleReceta(item.id_receta, 'cantidad', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        className="form-control form-control-sm"
                        value={item.orden}
                        onChange={(event) => onActualizarDetalleReceta(item.id_receta, 'orden', event.target.value)}
                      />
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm inv-prod-btn-danger-lite"
                        onClick={() => onQuitarRecetaDetalle(item.id_receta)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="alert alert-warning mb-0">
            Agrega al menos una receta para guardar el combo.
          </div>
        )}

        <div className="d-flex gap-2 mt-3">
          <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving}>
            {saving ? 'Guardando...' : drawerMode === 'create' ? 'Crear combo' : 'Guardar combo'}
          </button>
        </div>
      </form>
    </aside>
  );
};

export default CombosFormDrawer;
