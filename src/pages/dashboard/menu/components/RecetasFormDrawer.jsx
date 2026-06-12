import { useRef } from 'react';
import Select from 'react-select';
import RecetasImagePreview from './RecetasImagePreview';
import {
  calculateCantidadBasePresentacion,
  calculateCantidadPresentacionApi,
  sanitizeRecipeQuantityInput,
  shouldRequireSpiceLevel
} from '../utils/recetasAdminUtils';

const buildInsumoOptionLabel = (insumo) => {
  const nombre = String(insumo?.nombre_insumo || '').trim();
  const rawAlmacen = String(insumo?.nombre_almacen || '').trim();
  const normalizedAlmacen = rawAlmacen.toLowerCase();

  let almacenCorto = rawAlmacen;
  if (normalizedAlmacen.includes('el carmen')) {
    almacenCorto = 'JN-CARMEN';
  } else if (normalizedAlmacen.includes('21 de agosto')) {
    almacenCorto = 'JN-21';
  } else if (rawAlmacen.length > 18) {
    almacenCorto = rawAlmacen
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase())
      .filter(Boolean)
      .join('-') || 'ALM';
  }

  return almacenCorto ? `${nombre} / ${almacenCorto}` : nombre;
};

const getUnitLabel = (source, nameKey, symbolKey) => {
  const nombre = String(source?.[nameKey] || '').trim();
  const simbolo = String(source?.[symbolKey] || '').trim();
  if (nombre && simbolo) return `${nombre} (${simbolo})`;
  return nombre || simbolo || 'Sin unidad';
};

const formatDecimal = (value, decimals = 4) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toLocaleString('es-HN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
};

const buildPresentacionLabel = (presentacion) => {
  const nombre = String(presentacion?.nombre_presentacion || 'Presentacion').trim();
  const unidadPresentacion = getUnitLabel(presentacion, 'unidad_presentacion_nombre', 'unidad_presentacion_simbolo');
  const unidadBase = getUnitLabel(presentacion, 'unidad_base_nombre', 'unidad_base_simbolo');
  const cantidadPresentacion = formatDecimal(presentacion?.cantidad_presentacion, 4) || '1';
  const cantidadBase = formatDecimal(presentacion?.cantidad_base, 4) || '0';
  return `${nombre} - ${cantidadPresentacion} ${unidadPresentacion} = ${cantidadBase} ${unidadBase}`;
};

const RecetasFormDrawer = ({
  drawerOpen,
  drawerMode,
  editingId,
  form,
  detalleReceta = [],
  insumosDetalleCatalog = [],
  unidadesMedidaCatalog = [],
  insumoCategoriasOptions = [],
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
  const insumoOptions = (Array.isArray(insumosDetalleCatalog) ? insumosDetalleCatalog : []).map((insumo) => ({
    value: String(insumo.id_insumo),
    label: buildInsumoOptionLabel(insumo),
    id_categoria_insumo: String(insumo?.id_categoria_insumo || '')
  }));
  const unidadesDetalleOptions = Array.isArray(unidadesMedidaCatalog) ? unidadesMedidaCatalog : [];

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
                      const selectedCategoriaId = String(
                        row?.id_categoria_insumo || selectedInsumo?.id_categoria_insumo || ''
                      );
                      const filteredInsumoOptions = selectedCategoriaId
                        ? insumoOptions.filter(
                          (option) => String(option.id_categoria_insumo) === selectedCategoriaId
                        )
                        : insumoOptions;
                      const unidadBloqueada = Boolean(selectedInsumo?.id_unidad_medida);
                      const requiresInitialUnit = Boolean(selectedInsumo) && !unidadBloqueada;
                      const presentacionesReceta = Array.isArray(selectedInsumo?.presentaciones_receta)
                        ? selectedInsumo.presentaciones_receta
                        : [];
                      const selectedPresentacion = presentacionesReceta.find(
                        (presentacion) => String(presentacion.id_presentacion) === String(row.id_presentacion_insumo)
                      ) || null;
                      const hasHistoricalPresentacion =
                        String(row?.modo_unidad) === 'presentacion' &&
                        String(row?.id_presentacion_insumo || '').trim() &&
                        !selectedPresentacion;
                      const selectedInitialUnitOption = unidadesDetalleOptions.find(
                        (option) => String(option.value) === String(row.id_unidad_medida)
                      ) || null;
                      const unidadBaseLabel = requiresInitialUnit && selectedInitialUnitOption
                        ? selectedInitialUnitOption.label
                        : selectedInsumo
                          ? getUnitLabel(selectedInsumo, 'unidad_nombre', 'unidad_simbolo')
                          : 'Unidad base';
                      const presentacionOptions = selectedInsumo && !requiresInitialUnit
                        ? [
                          {
                            value: 'base',
                            label: `Unidad base - ${unidadBaseLabel}`,
                            tipo: 'base'
                          },
                          ...presentacionesReceta.map((presentacion) => ({
                            value: `presentacion:${presentacion.id_presentacion}`,
                            label: buildPresentacionLabel(presentacion),
                            tipo: 'presentacion',
                            id_presentacion: String(presentacion.id_presentacion)
                          })),
                          ...(hasHistoricalPresentacion ? [{
                            value: `presentacion:${row.id_presentacion_insumo}`,
                            label: `${row.nombre_presentacion || 'Presentacion'} - No disponible`,
                            tipo: 'presentacion',
                            id_presentacion: String(row.id_presentacion_insumo),
                            isDisabled: true
                          }] : [])
                        ]
                        : [];
                      const selectedUnidadOption = String(row?.modo_unidad) === 'presentacion'
                        ? presentacionOptions.find((option) => option.value === `presentacion:${row.id_presentacion_insumo}`) || null
                        : presentacionOptions.find((option) => option.value === 'base') || null;
                      const cantidadValue = String(row?.modo_unidad) === 'presentacion'
                        ? row.cantidad_porciones
                        : row.cant;
                      const isPresentacionMode = String(row?.modo_unidad) === 'presentacion';
                      const cantidadField = isPresentacionMode ? 'cantidad_porciones' : 'cant';
                      const equivalenciaBase = selectedPresentacion
                        ? calculateCantidadBasePresentacion(row?.cantidad_porciones, selectedPresentacion)
                        : null;
                      const contenidoPresentacion = selectedPresentacion
                        ? calculateCantidadPresentacionApi(row?.cantidad_porciones, selectedPresentacion)
                        : null;
                      const contenidoPresentacionTexto = selectedPresentacion && contenidoPresentacion !== null
                        ? `${formatDecimal(contenidoPresentacion, 4)} ${getUnitLabel(selectedPresentacion, 'unidad_presentacion_nombre', 'unidad_presentacion_simbolo')}`
                        : '';
                      const equivalenciaTexto = isPresentacionMode
                        ? hasHistoricalPresentacion
                          ? 'No disponible. Cambia a unidad base o elige otra presentación antes de guardar.'
                          : equivalenciaBase !== null
                            ? `Contenido: ${contenidoPresentacionTexto}. Se descontarán ${formatDecimal(equivalenciaBase, 4)} ${unidadBaseLabel}.`
                            : `Contenido: ${contenidoPresentacionTexto}. Ingresa la cantidad de porciones para calcular el descuento.`
                        : row?.cant
                          ? `Se descontarán ${formatDecimal(row.cant, 4)} ${unidadBaseLabel}.`
                          : 'La cantidad se consumirá directamente en la unidad base.';

                      return (
                        <div className="menu-recetas-admin__detalle-row" key={`detalle-receta-${index}`}>
                          <div className="menu-recetas-admin__detalle-main">
                            <div className="menu-recetas-admin__detalle-field">
                              <label className="form-label" htmlFor={`receta_detalle_categoria_${index}`}>Categoria</label>
                              <Select
                                inputId={`receta_detalle_categoria_${index}`}
                                classNamePrefix="menu-salsas-receta-select"
                                options={insumoCategoriasOptions}
                                value={
                                  insumoCategoriasOptions.find(
                                    (option) => String(option.value) === selectedCategoriaId
                                  ) || null
                                }
                                onChange={(option) => onUpdateDetalleRow(index, 'id_categoria_insumo', option?.value || '')}
                                placeholder="Todas las categorias"
                                isDisabled={saving || loadingDetalleCatalog}
                                isClearable
                                maxMenuHeight={192}
                              />
                            </div>

                            <div className="menu-recetas-admin__detalle-field menu-recetas-admin__detalle-field--insumo">
                              <label className="form-label" htmlFor={`receta_detalle_insumo_${index}`}>Insumo</label>
                              <Select
                                inputId={`receta_detalle_insumo_${index}`}
                                classNamePrefix="menu-salsas-receta-select"
                                options={filteredInsumoOptions}
                                value={
                                  filteredInsumoOptions.find(
                                    (option) => String(option.value) === String(row.id_insumo)
                                  ) || null
                                }
                                onChange={(option) => onUpdateDetalleRow(index, 'id_insumo', option?.value || '')}
                                placeholder="Buscar insumo"
                                isDisabled={saving || loadingDetalleCatalog}
                                isClearable={false}
                                maxMenuHeight={192}
                                noOptionsMessage={() => 'No hay insumos para esa categoria'}
                              />
                            </div>

                            <div className="menu-recetas-admin__detalle-field menu-recetas-admin__detalle-field--cantidad">
                              <label className="form-label" htmlFor={`receta_detalle_cant_${index}`}>
                                {isPresentacionMode ? 'Cantidad de porciones' : 'Cantidad consumida'}
                              </label>
                              <input
                                id={`receta_detalle_cant_${index}`}
                                type="text"
                                inputMode="decimal"
                                className="form-control"
                                value={cantidadValue}
                                onChange={(event) => {
                                  const sanitized = sanitizeRecipeQuantityInput(event.target.value);
                                  if (sanitized !== null) onUpdateDetalleRow(index, cantidadField, sanitized);
                                }}
                                disabled={saving || hasHistoricalPresentacion}
                                placeholder={isPresentacionMode ? 'Ej: 1' : 'Ej: 0.25'}
                                required
                              />
                            </div>

                            <div className="menu-recetas-admin__detalle-field menu-recetas-admin__detalle-field--unidad">
                              <label className="form-label" htmlFor={`receta_detalle_unidad_${index}`}>
                                {isPresentacionMode ? 'Presentación' : 'Unidad de consumo'}
                              </label>
                              {requiresInitialUnit ? (
                                <Select
                                  inputId={`receta_detalle_unidad_${index}`}
                                  classNamePrefix="menu-salsas-receta-select"
                                  options={unidadesDetalleOptions}
                                  value={selectedInitialUnitOption}
                                  onChange={(option) => onUpdateDetalleRow(index, 'id_unidad_medida', option?.value || '')}
                                  placeholder="Seleccionar unidad base"
                                  isDisabled={saving || loadingDetalleCatalog}
                                  isClearable={false}
                                  maxMenuHeight={192}
                                />
                              ) : (
                                <Select
                                  inputId={`receta_detalle_unidad_${index}`}
                                  classNamePrefix="menu-salsas-receta-select"
                                  options={presentacionOptions}
                                  value={selectedUnidadOption}
                                  onChange={(option) => {
                                    if (!option || option.value === 'base') {
                                      onUpdateDetalleRow(index, 'modo_unidad', 'base');
                                      return;
                                    }
                                    onUpdateDetalleRow(index, 'id_presentacion_insumo', option.id_presentacion || '');
                                  }}
                                  placeholder="Seleccionar unidad base o presentacion"
                                  isDisabled={saving || loadingDetalleCatalog || !selectedInsumo}
                                  isClearable={false}
                                  maxMenuHeight={192}
                                />
                              )}
                              {hasHistoricalPresentacion ? (
                                <small className="form-text text-danger">No disponible</small>
                              ) : unidadBloqueada ? (
                                <small className="form-text">Unidad base definida en el insumo</small>
                              ) : selectedInsumo ? (
                                <small className="form-text">
                                  Este insumo no tiene unidad definida. Al guardar, se completara en el insumo.
                                </small>
                              ) : null}
                            </div>

                            <div className="menu-recetas-admin__detalle-field menu-recetas-admin__detalle-field--equivalencia">
                              <label className="form-label">Descuento de inventario</label>
                              <div className={`menu-recetas-admin__detalle-equivalencia ${hasHistoricalPresentacion ? 'is-warning' : ''}`}>
                                {equivalenciaTexto}
                              </div>
                            </div>
                          </div>

                          <div className="menu-recetas-admin__detalle-action">
                            <label className="form-label menu-recetas-admin__detalle-action-label">Eliminar</label>
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

