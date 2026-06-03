import { useRef } from 'react';
import Select from 'react-select';
import RecetasImagePreview from './RecetasImagePreview';
import { shouldRequireSpiceLevel } from '../utils/recetasAdminUtils';

const RecetasFormDrawer = ({
  drawerOpen,
  drawerMode,
  editingId,
  form,
  detalleReceta = [],
  insumosDetalleCatalog = [],
  loadingDetalleCatalog = false,
  saving,
  onChangeField,
  onChangeSelectField,
  onAddDetalleRow,
  onRemoveDetalleRow,
  onUpdateDetalleRow,
  onSubmit,
  onClose,
  onClearImage,
  onPickImageFile,
  selectedImageFileName,
  formPreviewUrl,
  formPreviewError,
  onPreviewError,
  menusCatalog = [],
  departamentosCatalog = []
}) => {
  const requiresSpiceLevel = shouldRequireSpiceLevel(form?.nombre_receta);
  const imageInputRef = useRef(null);
  const hasInsumosCatalog = Array.isArray(insumosDetalleCatalog) && insumosDetalleCatalog.length > 0;
  const selectedMenuOption = menusCatalog.find((option) => String(option.value) === String(form.id_menu)) || null;
  const selectedDepartamentoOption =
    departamentosCatalog.find((option) => String(option.value) === String(form.id_tipo_departamento)) || null;
  const unidadesDetalleOptions = Array.from(
    new Map(
      (Array.isArray(insumosDetalleCatalog) ? insumosDetalleCatalog : [])
        .filter((item) => String(item?.id_unidad_medida || '').trim())
        .map((item) => {
          const value = String(item.id_unidad_medida);
          const nombre = String(item.unidad_nombre || '').trim();
          const simbolo = String(item.unidad_simbolo || '').trim();
          const label = simbolo && nombre ? `${simbolo} - ${nombre}` : (simbolo || nombre || `Unidad ${value}`);
          return [value, { value, label }];
        })
    ).values()
  );

  if (!drawerOpen) return null;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--create show">
      <div className="inv-prod-pmodal__overlay" onClick={onClose} />
      <div className="inv-prod-pmodal__viewport">
        <section
          id="menu-recetas-form-drawer"
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-recetas-modal-title"
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
                  <i className="bi bi-journal-plus" aria-hidden="true" />
                </div>
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__kicker">
                    {drawerMode === 'create' ? 'Nuevo Registro' : 'Edicion Activa'}
                  </div>
                  <div id="menu-recetas-modal-title" className="inv-ins-create-hero__title">
                    {drawerMode === 'create' ? 'Nueva receta' : `Editar receta #${editingId}`}
                  </div>
                </div>
              </div>

              <div className="inv-prod-pmodal__sections mt-3">
                <section className="inv-prod-pmodal__section">
                  <div className="row g-2">
                    <div className="col-12">
                      <label className="form-label" htmlFor="receta_nombre">Nombre receta</label>
                      <input
                        id="receta_nombre"
                        className="form-control"
                        name="nombre_receta"
                        value={form.nombre_receta}
                        onChange={onChangeField}
                        placeholder="Ej: Tacos de birria"
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
                        placeholder="Ej: Tortilla de maiz, birria, cebolla y cilantro"
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
                        placeholder="Ej: 75.00"
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="receta_id_menu">Menu</label>
                      <Select
                        inputId="receta_id_menu"
                        classNamePrefix="menu-salsas-receta-select"
                        options={menusCatalog}
                        value={selectedMenuOption}
                        onChange={(option) => onChangeSelectField?.('id_menu', option?.value || '')}
                        placeholder="Ej: #1 - Menu Normal"
                        isClearable={false}
                        isDisabled={saving}
                        maxMenuHeight={192}
                      />
                    </div>

                    {requiresSpiceLevel && (
                      <div className="col-12 col-md-6">
                        <label className="form-label" htmlFor="receta_id_nivel_picante">Nivel picante</label>
                        <input
                          id="receta_id_nivel_picante"
                          type="number"
                          min="1"
                          className="form-control"
                          name="id_nivel_picante"
                          value={form.id_nivel_picante}
                          onChange={onChangeField}
                          placeholder="Ej: 5"
                          required
                        />
                        <div className="form-text">Campo interno requerido solo para recetas de alitas o tenders.</div>
                      </div>
                    )}

                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="receta_id_departamento">Tipo departamento</label>
                      <Select
                        inputId="receta_id_departamento"
                        classNamePrefix="menu-salsas-receta-select"
                        options={departamentosCatalog}
                        value={selectedDepartamentoOption}
                        onChange={(option) => onChangeSelectField?.('id_tipo_departamento', option?.value || '')}
                        placeholder="Ej: Tacos de birria"
                        isClearable={false}
                        isDisabled={saving}
                        maxMenuHeight={192}
                      />
                    </div>
                  </div>
                </section>

                <section className="menu-recetas-admin__detalle mt-3">
                  <div className="menu-recetas-admin__detalle-head">
                    <div>
                      <div className="menu-recetas-admin__detalle-title">Detalle receta</div>
                      <div className="menu-recetas-admin__detalle-sub">
                        Agrega los insumos y cantidades que cocina consume al vender esta receta.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn menu-recetas-admin__detalle-add"
                      onClick={onAddDetalleRow}
                      disabled={saving || loadingDetalleCatalog}
                    >
                      <i className="bi bi-plus-lg" aria-hidden="true" /> Insumo
                    </button>
                  </div>

                  {loadingDetalleCatalog ? (
                    <div className="menu-recetas-admin__detalle-empty">Cargando insumos...</div>
                  ) : null}

                  {!loadingDetalleCatalog && !hasInsumosCatalog ? (
                    <div className="menu-recetas-admin__detalle-empty">
                      No hay insumos activos para seleccionar.
                    </div>
                  ) : null}

                  <div className="menu-recetas-admin__detalle-list">
                    {(Array.isArray(detalleReceta) ? detalleReceta : []).map((row, index) => {
                      const selectedInsumo = insumosDetalleCatalog.find(
                        (item) => String(item.id_insumo) === String(row.id_insumo)
                      );
                      const unidadLabel = selectedInsumo?.unidad_simbolo || selectedInsumo?.unidad_nombre || 'Unidad';

                      return (
                        <div className="menu-recetas-admin__detalle-row" key={`detalle-receta-${index}`}>
                          <div className="menu-recetas-admin__detalle-field menu-recetas-admin__detalle-field--insumo">
                            <label className="form-label" htmlFor={`receta_detalle_insumo_${index}`}>Insumo</label>
                            <select
                              id={`receta_detalle_insumo_${index}`}
                              className="form-select"
                              value={row.id_insumo}
                              onChange={(event) => onUpdateDetalleRow(index, 'id_insumo', event.target.value)}
                              disabled={saving || loadingDetalleCatalog}
                              required
                            >
                              <option value="">Ej: Salsa roja</option>
                              {insumosDetalleCatalog.map((insumo) => (
                                <option key={insumo.id_insumo} value={insumo.id_insumo}>
                                  {insumo.nombre_insumo}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="menu-recetas-admin__detalle-field">
                            <label className="form-label" htmlFor={`receta_detalle_cant_${index}`}>Cantidad</label>
                            <input
                              id={`receta_detalle_cant_${index}`}
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              className="form-control"
                              value={row.cant}
                              onChange={(event) => onUpdateDetalleRow(index, 'cant', event.target.value)}
                              disabled={saving}
                              placeholder="Ej: 0.2500"
                              required
                            />
                          </div>

                          <div className="menu-recetas-admin__detalle-field">
                            <label className="form-label" htmlFor={`receta_detalle_unidad_${index}`}>Unidad</label>
                            <Select
                              inputId={`receta_detalle_unidad_${index}`}
                              classNamePrefix="menu-salsas-receta-select"
                              options={unidadesDetalleOptions}
                              value={unidadesDetalleOptions.find((option) => String(option.value) === String(row.id_unidad_medida)) || null}
                              onChange={(option) => onUpdateDetalleRow(index, 'id_unidad_medida', option?.value || '')}
                              placeholder="Seleccionar unidad"
                              isDisabled={saving || loadingDetalleCatalog}
                              isClearable={false}
                              maxMenuHeight={192}
                            />
                            {!row.id_unidad_medida && unidadLabel && unidadLabel !== 'Unidad' ? (
                              <small className="form-text">Sugerida por insumo: {unidadLabel}</small>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            className="btn menu-recetas-admin__detalle-remove"
                            onClick={() => onRemoveDetalleRow(index)}
                            disabled={saving || detalleReceta.length <= 1}
                            title="Quitar insumo"
                            aria-label="Quitar insumo"
                          >
                            <i className="bi bi-trash3" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
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

export default RecetasFormDrawer;

