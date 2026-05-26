import { useEffect, useMemo, useRef, useState } from 'react';
import Select from 'react-select';
import RecetasImagePreview from './RecetasImagePreview';

const CombosFormDrawer = ({
  drawerOpen,
  drawerMode,
  editingId,
  form,
  saving,
  menusCatalog = [],
  recetasDisponibles,
  onChangeField,
  onSubmit,
  onClose,
  onClearImage,
  onPickImageFile,
  selectedImageFileName,
  formPreviewUrl,
  formPreviewError,
  loadingRecetasCatalogo,
  onPreviewError,
  onAgregarRecetaDetalle,
  onActualizarDetalleReceta,
  onQuitarRecetaDetalle
}) => {
  const [recetaSearch, setRecetaSearch] = useState('');
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const imageInputRef = useRef(null);

  useEffect(() => {
    // En crear se abre el selector; en editar queda cerrado por defecto.
    setShowRecipePicker(drawerMode === 'create');
    setRecetaSearch('');
  }, [drawerMode, drawerOpen]);

  const recetasFiltradas = useMemo(() => {
    const term = String(recetaSearch || '').trim().toLowerCase();
    if (!term) return recetasDisponibles;

    return (Array.isArray(recetasDisponibles) ? recetasDisponibles : []).filter((receta) => (
      String(receta?.nombre_receta || '').toLowerCase().includes(term)
      || String(receta?.id_receta || '').includes(term)
    ));
  }, [recetaSearch, recetasDisponibles]);

  const recetasById = useMemo(() => {
    const map = new Map();
    (Array.isArray(recetasDisponibles) ? recetasDisponibles : []).forEach((receta) => {
      const id = Number(receta?.id_receta || 0);
      if (!id) return;
      map.set(id, String(receta?.nombre_receta || '').trim());
    });
    return map;
  }, [recetasDisponibles]);

  const resolveDetalleNombre = (item) => {
    const fromItem = String(item?.nombre_receta || '').trim();
    if (fromItem) return fromItem;

    const idReceta = Number(item?.id_receta || 0);
    const fromCatalog = String(recetasById.get(idReceta) || '').trim();
    if (fromCatalog) return fromCatalog;

    return `Receta #${idReceta || '-'}`;
  };

  const totalDetalle = Array.isArray(form.detalle) ? form.detalle.length : 0;
  const selectedMenuOption = menusCatalog.find((option) => String(option.value) === String(form.id_menu)) || null;

  if (!drawerOpen) return null;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--create show">
      <div className="inv-prod-pmodal__overlay" onClick={onClose} />
      <div className="inv-prod-pmodal__viewport">
        <section
          id="menu-combos-form-drawer"
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-combos-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create menu-recetas-admin__form" onSubmit={onSubmit}>
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero is-create">
                <button
                  type="button"
                  className="inv-prod-drawer-close inv-ins-create-hero__close"
                  onClick={onClose}
                  title="Cerrar"
                  aria-label="Cerrar formulario"
                >
                  <i className="bi bi-x-lg" />
                </button>
                <div className="inv-ins-create-hero__icon">
                  <i className="bi bi-collection" aria-hidden="true" />
                </div>
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__kicker">
                    {drawerMode === 'create' ? 'Nuevo Registro' : 'Edicion Activa'}
                  </div>
                  <div id="menu-combos-modal-title" className="inv-ins-create-hero__title">
                    {drawerMode === 'create' ? 'Nuevo combo' : `Editar combo #${editingId}`}
                  </div>
                </div>
              </div>

              <div className="inv-prod-pmodal__sections mt-3">
                <section className="inv-prod-pmodal__section">
        <div className="row g-2">
          <div className="col-12">
            <label className="form-label" htmlFor="combo_nombre_combo">Nombre</label>
            <input
              id="combo_nombre_combo"
              className="form-control"
              name="nombre_combo"
              value={form.nombre_combo}
              onChange={onChangeField}
              placeholder="Ej: Combo 6 alitas + 2 tacos"
              required
            />
            <div className="form-text">Este nombre sera el titulo visible del combo.</div>
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="combo_descripcion">Descripcion</label>
            <input
              id="combo_descripcion"
              className="form-control"
              name="descripcion"
              value={form.descripcion}
              onChange={onChangeField}
              placeholder="Ej: Incluye papas y bebida"
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
            <label className="form-label" htmlFor="combo_id_menu">Menu</label>
            <Select
              inputId="combo_id_menu"
              classNamePrefix="menu-salsas-receta-select"
              options={menusCatalog}
              value={selectedMenuOption}
              onChange={(option) => onChangeField({ target: { name: 'id_menu', value: option?.value || '' } })}
              placeholder="Ej: #1 - Menu Normal"
              isClearable={false}
              isDisabled={saving}
              maxMenuHeight={192}
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
                  aria-label="Estado actual de combo"
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
        </div>
                </section>

        <hr className="my-3" />

        <div className="mb-2 d-flex justify-content-between align-items-center gap-2">
          <strong>Detalle del combo</strong>
          <span className="menu-combos-receta-picker__count">{totalDetalle} agregadas</span>
        </div>

        <div className="small text-muted mb-2">
          {totalDetalle > 0
            ? `${totalDetalle} receta(s) en este combo.`
            : 'Aun no agregas recetas al combo.'}
        </div>

        {totalDetalle > 0 ? (
          <div className="list-group mb-3">
            <div className="list-group-item py-2">
              <div className="d-flex align-items-center gap-2 small text-muted fw-semibold">
                <span className="flex-grow-1">Receta</span>
                <span style={{ width: '84px', textAlign: 'center' }}>Cant.</span>
                <span style={{ width: '84px', textAlign: 'center' }}>Orden</span>
                <span style={{ width: '78px' }} />
              </div>
            </div>

            {form.detalle.map((item) => (
              <div key={`sel-${item.id_receta}`} className="list-group-item py-2">
                <div className="d-flex align-items-center gap-2">
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{resolveDetalleNombre(item)}</div>
                    <div className="small text-muted">#{item.id_receta}</div>
                  </div>

                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-sm"
                    style={{ width: '84px', textAlign: 'center' }}
                    value={item.cantidad}
                    onChange={(event) => onActualizarDetalleReceta(item.id_receta, 'cantidad', event.target.value)}
                  />

                  <input
                    type="number"
                    min="1"
                    className="form-control form-control-sm"
                    style={{ width: '84px', textAlign: 'center' }}
                    value={item.orden}
                    onChange={(event) => onActualizarDetalleReceta(item.id_receta, 'orden', event.target.value)}
                  />

                  <button
                    type="button"
                    className="btn btn-sm inv-prod-btn-danger-lite"
                    onClick={() => onQuitarRecetaDetalle(item.id_receta)}
                    aria-label={`Quitar receta ${resolveDetalleNombre(item)} del combo`}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-warning mb-3">
            Agrega al menos una receta para guardar el combo.
          </div>
        )}

        <div className="mb-2 d-flex justify-content-between align-items-center gap-2">
          <strong>Agregar receta</strong>
          <button
            type="button"
            className="btn btn-sm inv-prod-btn-subtle"
            onClick={() => setShowRecipePicker((prev) => !prev)}
          >
            {showRecipePicker ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>

        {showRecipePicker ? (
          <>
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
          </>
        ) : null}

              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn inv-prod-btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : drawerMode === 'create' ? 'Crear combo' : 'Guardar combo'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default CombosFormDrawer;


