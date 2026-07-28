import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../../services/inventarioService';
import { resolveInventarioImageUrl } from '../../../../utils/inventarioImagenes';
import {
  buildCanjeableProductoPayload,
  buildSaveConfiguracionPayload,
  calculatePointsPreview,
  calculateRedemptionPointsPreview,
  computeConfiguracionSaveState,
  extractApiMessage,
  formatCurrency,
  formatPoints,
  isRedemptionPointsOverrideInvalid,
  isSensitiveLempirasRate,
  RATE_CONFIRMATION_EXAMPLE_AMOUNT,
  RATE_PREVIEW_AMOUNTS
} from '../utils/fidelizacionHelpers';

const normalizeProductoCatalogo = (row) => ({
  id_producto: Number(row?.id_producto ?? 0) || null,
  nombre_producto: String(row?.nombre_producto ?? '').trim(),
  imagen_principal_url: row?.imagen_principal_url ? String(row.imagen_principal_url).trim() || null : null,
  precio: Number(row?.precio ?? 0) || 0,
  cantidad: Number(row?.cantidad ?? 0) || 0,
  stock_minimo: Number(row?.stock_minimo ?? 0) || 0,
  id_almacen: Number(row?.id_almacen ?? 0) || null,
  estado: row?.estado !== undefined ? Boolean(row.estado) : true
});

// Miniatura compacta (no tarjeta grande): mismo patron sin estado de
// VentaComposerCatalog.jsx, el <img> oculta su propio <img> y revela el
// placeholder hermano si la URL falla. `url` ya debe llegar resuelta por
// resolveInventarioImageUrl (URL absoluta, jonnys-assets/... convertido a
// Supabase, ruta relativa convertida via API_URL, o cadena vacia): este
// componente nunca decide como resolverla, solo la renderiza.
const ProductoThumb = ({ url, nombre }) => (
  <div className="fidelizacion-config-modal__thumb">
    {url ? (
      <img
        src={url}
        alt={nombre}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          const next = event.currentTarget.nextElementSibling;
          if (next) next.classList.remove('d-none');
        }}
      />
    ) : null}
    <span className={`fidelizacion-config-modal__thumb-placeholder ${url ? 'd-none' : ''}`}>
      <i className="bi bi-image" aria-hidden="true" />
    </span>
  </div>
);

export default function ConfiguracionReglasModal({
  show,
  onClose,
  configuracion,
  saving,
  selectedSucursalId,
  onSubmit
}) {
  const [mounted, setMounted] = useState(false);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lempiras, setLempiras] = useState('');
  // El valor inicial siempre viene de lo que respondio el backend (nunca se
  // asume true por defecto); ver el efecto de abajo que lo sincroniza al abrir el modal.
  const [acumulacionHabilitada, setAcumulacionHabilitada] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [selectedProductos, setSelectedProductos] = useState({});
  // Confirmacion explicita de la equivalencia de la tasa. Nunca se precarga en
  // true: debe marcarse a proposito cada vez que la tasa se define o cambia.
  const [rateConfirmed, setRateConfirmed] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!show) return;

    const lempirasValue = configuracion?.configuracion?.lempiras_por_punto;
    setLempiras(lempirasValue ? String(lempirasValue) : '');
    setAcumulacionHabilitada(Boolean(configuracion?.configuracion?.acumulacion_habilitada));
    setSearchTerm('');
    // Reinicio de la confirmacion: al abrir el modal, al cambiar de sucursal y
    // cuando llega una configuracion distinta del backend (este efecto depende
    // de `configuracion` y `show`). Nunca debe quedar marcada de una sesion
    // anterior.
    setRateConfirmed(false);

    const selectedMap = {};
    (configuracion?.productos_canjeables || []).forEach((producto) => {
      if (!producto.id_producto) return;
      selectedMap[producto.id_producto] = {
        checked: Boolean(producto.estado),
        puntos_requeridos_override:
          producto.puntos_requeridos_override === null || producto.puntos_requeridos_override === undefined
            ? ''
            : String(producto.puntos_requeridos_override)
      };
    });
    setSelectedProductos(selectedMap);
  }, [configuracion, show]);

  useEffect(() => {
    if (!show) return;

    let ignore = false;
    const loadProductos = async () => {
      setLoadingProductos(true);
      setLoadError('');
      try {
        const response = await inventarioService.getProductos({
          incluirInactivos: true,
          id_sucursal: selectedSucursalId || undefined
        });
        if (ignore) return;
        const rawRows = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : [];
        const rows = rawRows
          .map(normalizeProductoCatalogo)
          .filter((producto) => producto.id_producto && producto.nombre_producto);
        setCatalogoProductos(rows);
      } catch (error) {
        if (!ignore) {
          setCatalogoProductos([]);
          setLoadError(extractApiMessage(error, 'No se pudo cargar el catalogo de productos.'));
        }
      } finally {
        if (!ignore) setLoadingProductos(false);
      }
    };

    void loadProductos();
    return () => {
      ignore = true;
    };
  }, [selectedSucursalId, show]);

  const filteredProductos = useMemo(() => {
    const raw = String(searchTerm || '').trim().toLowerCase();
    if (!raw) return catalogoProductos;
    return catalogoProductos.filter((producto) => {
      const stack = [producto.nombre_producto, `#${producto.id_producto}`];
      return stack.some((value) => String(value ?? '').toLowerCase().includes(raw));
    });
  }, [catalogoProductos, searchTerm]);

  const selectedCount = useMemo(
    () =>
      Object.values(selectedProductos).filter((value) => value?.checked).length,
    [selectedProductos]
  );

  const toggleProducto = (idProducto, checked) => {
    setSelectedProductos((current) => ({
      ...current,
      [idProducto]: {
        checked,
        puntos_requeridos_override: current[idProducto]?.puntos_requeridos_override ?? ''
      }
    }));
  };

  const updateOverride = (idProducto, value) => {
    setSelectedProductos((current) => ({
      ...current,
      [idProducto]: {
        checked: current[idProducto]?.checked ?? true,
        puntos_requeridos_override: value
      }
    }));
  };

  const previousLempirasPorPunto = configuracion?.configuracion?.lempiras_por_punto ?? null;

  const { canSubmit: canSubmitRate, confirmationRequired } = computeConfiguracionSaveState({
    lempiras,
    saving,
    previousLempirasPorPunto,
    rateConfirmed
  });

  // Bloqueante: un producto marcado como canjeable con un costo en puntos
  // que no sea ni "vacio" (automatico) ni un entero positivo valido nunca
  // debe poder guardarse -ni con campo vacio en otros productos, que si son
  // validos-. isRedemptionPointsOverrideInvalid reutiliza el mismo
  // normalizador que construye el payload: la regla de bloqueo y la de
  // construccion del payload nunca pueden divergir.
  const hasInvalidProductOverride = useMemo(
    () => Object.values(selectedProductos).some(
      (value) => Boolean(value?.checked) && isRedemptionPointsOverrideInvalid(value?.puntos_requeridos_override)
    ),
    [selectedProductos]
  );

  const canSubmit = canSubmitRate && !hasInvalidProductOverride;

  // Cambiar la tasa invalida cualquier confirmacion previa: el usuario debe
  // volver a leer el ejemplo con el nuevo valor antes de poder guardar.
  const handleLempirasChange = (value) => {
    setLempiras(value);
    setRateConfirmed(false);
  };

  const tasaNumerica = Number(lempiras);
  const tasaValida = Number.isFinite(tasaNumerica) && tasaNumerica > 0;
  const tasaSensible = isSensitiveLempirasRate(lempiras);
  const puntosEjemploConfirmacion = calculatePointsPreview({
    amount: RATE_CONFIRMATION_EXAMPLE_AMOUNT,
    lempirasPorPunto: lempiras
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    // buildCanjeableProductoPayload valida el costo en puntos con el mismo
    // normalizador que bloquea el boton (hasInvalidProductOverride): si
    // canSubmit es true no deberia haber ningun null aqui, pero se filtra de
    // todas formas (defensa en profundidad, nunca se envia un producto con un
    // costo invalido).
    const productos_canjeables = Object.entries(selectedProductos)
      .filter(([, value]) => value?.checked)
      .map(([idProducto, value]) => buildCanjeableProductoPayload({
        idProducto,
        puntosRequeridosOverride: value?.puntos_requeridos_override
      }))
      .filter((entry) => entry !== null);

    onSubmit(buildSaveConfiguracionPayload({
      idSucursal: configuracion?.id_sucursal,
      lempiras,
      acumulacionHabilitada,
      productosCanjeables: productos_canjeables,
      rateConfirmed
    }));
  };

  if (!mounted || !show) return null;

  return createPortal(
    <div className="inv-prod-pmodal inv-prod-pmodal--create show" aria-hidden={!show}>
      <div className="inv-prod-pmodal__overlay" onClick={saving ? undefined : onClose} />
      <div className="inv-prod-pmodal__viewport">
        <div
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create fidelizacion-config-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fidelizacion-config-title"
        >
          <form onSubmit={handleSubmit} className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero">
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__eyebrow">Fidelizacion</div>
                  <h3 id="fidelizacion-config-title">Configurar reglas</h3>
                  <p>Usa el mismo patron de gestion del sistema para definir equivalencia y productos canjeables.</p>
                </div>
                <button
                  type="button"
                  className="inv-prod-drawer-close inv-ins-create-hero__close"
                  onClick={onClose}
                  title="Cerrar"
                  disabled={saving}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              <div className="inv-prod-pmodal__sections">
                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Regla principal</div>
                    <div className="inv-prod-pmodal__section-sub">Equivalencia base que usa el backend para acumulacion y canje.</div>
                  </div>

                  <div className="row g-3">
                    <div className="col-12">
                      <div className="form-check form-switch fidelizacion-config-modal__switch">
                        <input
                          type="checkbox"
                          role="switch"
                          className="form-check-input"
                          id="fidelizacion-acumulacion-habilitada"
                          checked={acumulacionHabilitada}
                          onChange={(event) => setAcumulacionHabilitada(event.target.checked)}
                          disabled={saving}
                        />
                        <label className="form-check-label" htmlFor="fidelizacion-acumulacion-habilitada">
                          Habilitar acumulacion automatica de puntos
                        </label>
                        <span
                          className={`badge ms-2 ${acumulacionHabilitada ? 'bg-success' : 'bg-secondary'}`}
                        >
                          {acumulacionHabilitada ? 'Activado' : 'Desactivado'}
                        </span>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label" htmlFor="fidelizacion-lempiras-por-punto">
                        Lempiras necesarios para obtener 1 punto
                      </label>
                      <input
                        id="fidelizacion-lempiras-por-punto"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={lempiras}
                        onChange={(event) => handleLempirasChange(event.target.value)}
                        className="form-control"
                        disabled={saving}
                      />
                      <div className="form-text">
                        El sistema divide el total de la factura entre esta cantidad y redondea hacia abajo.
                      </div>
                      {tasaValida ? (
                        <div className="form-text fidelizacion-config-modal__rate-meaning">
                          Con la tasa actual, el cliente obtiene 1 punto por cada L {formatCurrency(lempiras)} gastados.
                        </div>
                      ) : null}
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="fidelizacion-config-modal__summary">
                        <strong>{selectedCount}</strong>
                        <span>productos canjeables seleccionados</span>
                      </div>
                    </div>

                    {tasaValida ? (
                      <div className="col-12">
                        <div className="fidelizacion-config-modal__preview">
                          <div className="fidelizacion-config-modal__preview-title">Ejemplo de acumulacion</div>
                          <ul className="fidelizacion-config-modal__preview-list">
                            {RATE_PREVIEW_AMOUNTS.map((monto) => (
                              <li key={monto}>
                                <span>Compra de L {formatCurrency(monto)}</span>
                                <strong>
                                  {formatPoints(calculatePointsPreview({ amount: monto, lempirasPorPunto: lempiras }))} puntos
                                </strong>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : null}

                    {tasaSensible ? (
                      <div className="col-12">
                        <div className="alert alert-danger fidelizacion-config-modal__rate-warning" role="alert">
                          <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
                          <div>
                            <strong>Advertencia: esta tasa genera mas de 1 punto por cada lempira gastado.</strong>
                            <div>
                              Una compra de L {formatCurrency(RATE_CONFIRMATION_EXAMPLE_AMOUNT)} generaria{' '}
                              {formatPoints(puntosEjemploConfirmacion)} puntos.
                            </div>
                            <div>Verifica cuidadosamente la equivalencia antes de guardar.</div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {confirmationRequired ? (
                      <div className="col-12">
                        <div className="fidelizacion-config-modal__confirm form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id="fidelizacion-confirmar-equivalencia"
                            checked={rateConfirmed}
                            onChange={(event) => setRateConfirmed(event.target.checked)}
                            disabled={saving}
                          />
                          <label className="form-check-label" htmlFor="fidelizacion-confirmar-equivalencia">
                            Confirmo que 1 punto se obtendra por cada L {formatCurrency(lempiras)} gastados.
                            <span className="d-block">
                              Una compra de L {formatCurrency(RATE_CONFIRMATION_EXAMPLE_AMOUNT)} generara{' '}
                              {formatPoints(puntosEjemploConfirmacion)} puntos.
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Catalogo de productos</div>
                    <div className="inv-prod-pmodal__section-sub">Selecciona los productos que podran canjearse y define su costo en puntos.</div>
                  </div>

                  <div className="fidelizacion-config-modal__toolbar">
                    <input
                      type="search"
                      className="form-control"
                      placeholder="Buscar producto..."
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      disabled={loadingProductos}
                    />
                  </div>

                  {loadError ? (
                    <div className="alert alert-danger mb-0">{loadError}</div>
                  ) : loadingProductos ? (
                    <div className="ventas-detail-modal__loading">
                      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                      <span>Cargando productos...</span>
                    </div>
                  ) : filteredProductos.length === 0 ? (
                    <div className="ventas-detail-modal__empty">No se encontraron productos para la sucursal visible.</div>
                  ) : (
                    <div className="ventas-detail-modal__table-wrap fidelizacion-config-modal__table-wrap">
                      <table className="table ventas-detail-modal__table fidelizacion-config-modal__table">
                        <thead>
                          <tr>
                            <th>Canjeable</th>
                            <th>Producto</th>
                            <th>Precio</th>
                            <th>Stock visible</th>
                            <th>Costo en puntos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProductos.map((producto) => {
                            const state = selectedProductos[producto.id_producto] || { checked: false, puntos_requeridos_override: '' };
                            const stockVisible = Math.max(Number(producto.cantidad || 0) - Number(producto.stock_minimo || 0), 0);
                            const costoAutomatico = calculateRedemptionPointsPreview({
                              precio: producto.precio,
                              lempirasPorPunto: lempiras
                            });
                            const overrideInvalido = Boolean(state.checked) && isRedemptionPointsOverrideInvalid(state.puntos_requeridos_override);
                            const tieneOverridePersonalizado = Boolean(state.checked)
                              && String(state.puntos_requeridos_override ?? '').trim() !== ''
                              && !overrideInvalido;
                            return (
                              <tr key={producto.id_producto}>
                                <td>
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={Boolean(state.checked)}
                                    onChange={(event) => toggleProducto(producto.id_producto, event.target.checked)}
                                    disabled={saving}
                                  />
                                </td>
                                <td>
                                  <div className="fidelizacion-config-modal__product-cell">
                                    <ProductoThumb
                                      url={resolveInventarioImageUrl(producto.imagen_principal_url)}
                                      nombre={producto.nombre_producto}
                                    />
                                    <div className="fidelizacion-config-modal__product-name">
                                      <strong>{producto.nombre_producto}</strong>
                                      <small>ID {producto.id_producto}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>L. {formatCurrency(producto.precio)}</td>
                                <td>{formatPoints(stockVisible)}</td>
                                <td>
                                  <div className="fidelizacion-config-modal__points-cell">
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      inputMode="numeric"
                                      className={`form-control form-control-sm ${overrideInvalido ? 'is-invalid' : ''}`}
                                      placeholder={costoAutomatico !== null ? `Automatico: ${formatPoints(costoAutomatico)}` : 'Automatico'}
                                      value={state.puntos_requeridos_override}
                                      onChange={(event) => updateOverride(producto.id_producto, event.target.value)}
                                      disabled={!state.checked || saving}
                                    />
                                    {tieneOverridePersonalizado ? (
                                      <div className="fidelizacion-config-modal__points-hint">
                                        <span className="fidelizacion-config-modal__points-hint--custom">
                                          Personalizado: {formatPoints(Number(state.puntos_requeridos_override))} pts
                                        </span>
                                        {costoAutomatico !== null ? (
                                          <span>Automatico de referencia: {formatPoints(costoAutomatico)} pts</span>
                                        ) : null}
                                      </div>
                                    ) : overrideInvalido ? (
                                      <div className="fidelizacion-config-modal__points-hint fidelizacion-config-modal__points-hint--error">
                                        Ingresa un numero entero mayor que cero o deja el campo vacio para usar el costo automatico.
                                      </div>
                                    ) : (
                                      <div className="fidelizacion-config-modal__points-hint">
                                        {costoAutomatico !== null ? (
                                          <span>Automatico: {formatPoints(costoAutomatico)} pts</span>
                                        ) : null}
                                        <span>Deja el campo vacio para utilizar el costo automatico.</span>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-outline" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn inv-prod-btn-primary"
                disabled={!canSubmit}
              >
                {saving ? 'Guardando...' : 'Guardar reglas'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
