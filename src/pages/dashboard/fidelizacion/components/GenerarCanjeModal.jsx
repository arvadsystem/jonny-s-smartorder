import { useEffect, useMemo, useState } from 'react';
import ToolbarSucursalSelect from '../../../../components/common/ToolbarSucursalSelect';
import fidelizacionService from '../../../../services/fidelizacionService';
import { resolveInventarioImageUrl } from '../../../../utils/inventarioImagenes';
import {
  computeCanjeCartAfterAdd,
  computeCanjeConfirmDisabled,
  consumeHandledAsyncError,
  extractApiMessage,
  formatCurrency,
  formatPoints
} from '../utils/fidelizacionHelpers';

const buildEmptyStateMessage = (backendMessage, saldoDisponible, sucursalMissing) => {
  if (sucursalMissing) return 'Selecciona la sucursal donde se realizara el canje.';
  if (backendMessage) return backendMessage;
  if (Number(saldoDisponible || 0) <= 0) return 'Debe acumular mas puntos para realizar un canje.';
  return 'No hay productos canjeables disponibles en la sucursal seleccionada.';
};

// Mismo patron de imagen/placeholder que VentaComposerCatalog.jsx (.vcp-card):
// sin manejo de estado en React, la propia imagen oculta su <img> y revela
// el placeholder hermano si la URL falla (onError). imagen_principal_url ya
// viene resuelta a URL absoluta desde el backend (attachImagenPrincipalUrls),
// pero igual se pasa por resolveInventarioImageUrl aqui -mismo punto unico de
// resolucion que usa VentaComposerCatalog.jsx- para cubrir rutas relativas o
// del bucket (jonnys-assets/...) si algun dia dejan de llegar absolutas, y
// para nunca pasar una cadena vacia como si fuera una URL valida.
const ProductoCanjeableMedia = ({ imagenUrl, nombre, puntos }) => (
  <div className="vcp-card__media">
    <span className="fidelizacion-canje-modal__points-badge">{formatPoints(puntos)} pts</span>
    {imagenUrl ? (
      <img
        src={imagenUrl}
        alt={nombre}
        className="vcp-card__image"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          const next = event.currentTarget.nextElementSibling;
          if (next) next.classList.remove('d-none');
        }}
      />
    ) : null}
    <div className={`vcp-card__placeholder ${imagenUrl ? 'd-none' : ''}`}>
      <i className="bi bi-image vcp-card__placeholder-icon" aria-hidden="true" />
    </div>
  </div>
);

export default function GenerarCanjeModal({
  open,
  onClose,
  cliente,
  canjeablesData,
  loadingCanjeables,
  onLoadCanjeables,
  onResetCanjeables,
  canSelectSucursal,
  sucursales,
  loadingSucursales,
  userSucursalId,
  userSucursalNombre,
  saving,
  onSubmit
}) {
  const [carrito, setCarrito] = useState([]);
  const [observacion, setObservacion] = useState('');
  const [selectedSucursalId, setSelectedSucursalId] = useState('');
  const [sesiones, setSesiones] = useState([]);
  const [selectedSesionId, setSelectedSesionId] = useState('');
  const [loadingSesiones, setLoadingSesiones] = useState(false);
  const [sesionesError, setSesionesError] = useState('');

  const canjeables = Array.isArray(canjeablesData?.items) ? canjeablesData.items : [];
  const saldoDisponible = Number(canjeablesData?.saldoCliente?.puntos_disponibles ?? cliente?.puntos_disponibles ?? 0);
  const sucursalNumerica = Number.parseInt(String(selectedSucursalId || ''), 10);
  const hasSucursalSeleccionada = Number.isInteger(sucursalNumerica) && sucursalNumerica > 0;
  const sucursalMissing = canSelectSucursal && !hasSucursalSeleccionada;
  const sessionMissing = canSelectSucursal
    && hasSucursalSeleccionada
    && !loadingSesiones
    && (!sesiones.length || !selectedSesionId);

  // Al abrir el modal (o cambiar de cliente): carrito vacio y sucursal
  // vacia para SUPER_ADMIN (nunca precargada con userSucursalId en
  // silencio); para un usuario local, la sucursal operativa se fija de
  // inmediato y no es editable desde aqui.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setCarrito([]);
      setObservacion('');
      setSelectedSucursalId(canSelectSucursal ? '' : (userSucursalId ? String(userSucursalId) : ''));
      setSesiones([]);
      setSelectedSesionId('');
      setSesionesError('');
      if (onResetCanjeables) onResetCanjeables();
    });
    return () => {
      cancelled = true;
    };
  }, [open, cliente?.id_cliente, canSelectSucursal, userSucursalId, onResetCanjeables]);

  // Carga (o recarga) el catalogo de canjeables cada vez que hay una
  // sucursal resuelta: nunca antes de que exista una (SUPER_ADMIN sin
  // seleccionar todavia no dispara ninguna peticion).
  useEffect(() => {
    if (!open || !cliente?.id_cliente || !hasSucursalSeleccionada) return undefined;
    void consumeHandledAsyncError(() => onLoadCanjeables(cliente.id_cliente, { id_sucursal: sucursalNumerica }));
    return undefined;
  }, [open, cliente?.id_cliente, hasSucursalSeleccionada, sucursalNumerica, onLoadCanjeables]);

  useEffect(() => {
    if (!open || !canSelectSucursal || !hasSucursalSeleccionada) return undefined;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setLoadingSesiones(true);
        setSesionesError('');
      }
    });
    fidelizacionService.listCanjeSesiones({ id_sucursal: sucursalNumerica })
      .then((response) => {
        if (cancelled) return;
        const items = Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.data?.items) ? response.data.items : [];
        setSesiones(items);
        setSelectedSesionId(items.length === 1 ? String(items[0].id_sesion_caja) : '');
      })
      .catch((requestError) => {
        if (cancelled) return;
        setSesiones([]);
        setSelectedSesionId('');
        setSesionesError(extractApiMessage(requestError, 'No se pudieron cargar las sesiones de caja.'));
      })
      .finally(() => {
        if (!cancelled) setLoadingSesiones(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canSelectSucursal, hasSucursalSeleccionada, open, sucursalNumerica]);

  useEffect(() => {
    if (!open || saving) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, saving]);

  const handleSucursalChange = (value) => {
    // Cambiar de sucursal vacia el carrito y los totales: los items
    // seleccionados en la sucursal anterior no tienen sentido en la nueva
    // (stock/almacen distintos). El catalogo se recarga solo (efecto de
    // arriba, reacciona a selectedSucursalId).
    setSelectedSucursalId(value);
    setCarrito([]);
    setObservacion('');
    setSesiones([]);
    setSelectedSesionId('');
    setSesionesError('');
  };

  const carritoMap = useMemo(
    () => new Map(carrito.map((item) => [item.id_producto, item])),
    [carrito]
  );

  const puntosTotalesCanje = useMemo(
    () => carrito.reduce((sum, item) => sum + Number(item.puntos_requeridos || 0) * Number(item.cantidad || 0), 0),
    [carrito]
  );

  const puntosRestantes = saldoDisponible - puntosTotalesCanje;
  const saldoInsuficiente = puntosRestantes < 0;

  const handleAgregar = (producto) => {
    setCarrito((prev) => computeCanjeCartAfterAdd(prev, producto));
  };

  const handleQuitar = (idProducto) => {
    setCarrito((prev) => {
      const current = prev.find((item) => item.id_producto === idProducto);
      if (!current) return prev;
      if (current.cantidad <= 1) {
        return prev.filter((item) => item.id_producto !== idProducto);
      }
      return prev.map((item) =>
        item.id_producto === idProducto ? { ...item, cantidad: item.cantidad - 1 } : item
      );
    });
  };

  const { algunProductoExcedeStock, disabled: confirmDisabled } = computeCanjeConfirmDisabled({
    saving,
    loadingCanjeables,
    sucursalMissing,
    carrito,
    saldoInsuficiente
  });
  const finalConfirmDisabled = confirmDisabled || loadingSesiones || sessionMissing;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (finalConfirmDisabled) return;

    await onSubmit(
      carrito.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad
      })),
      observacion.trim(),
      sucursalNumerica,
      canSelectSucursal ? Number(selectedSesionId) : null
    );
  };

  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={saving ? undefined : onClose}>
      <section
        className="ventas-modal fidelizacion-canje-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fidelizacion-canje-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-gift-fill" />
            </span>
            <div>
              <h3 id="fidelizacion-canje-title">Canje presencial</h3>
              <p>{cliente?.nombre || 'Cliente seleccionado'}</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar" disabled={saving}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <form className="ventas-modal__body ventas-create-modal__body fidelizacion-canje-modal__body" onSubmit={handleSubmit}>
          <div className="ventas-create-modal__catalog">
            <div className="fidelizacion-canje-modal__sucursal-bar">
              {canSelectSucursal ? (
                <ToolbarSucursalSelect
                  value={selectedSucursalId}
                  onChange={handleSucursalChange}
                  options={sucursales}
                  loading={loadingSucursales}
                  label="Sucursal del canje"
                  emptyLabel="Selecciona una sucursal"
                  className="fidelizacion-canje-modal__sucursal-select"
                />
              ) : (
                <div className="fidelizacion-canje-modal__sucursal-readonly" aria-label="Sucursal operativa">
                  <i className="bi bi-shop" aria-hidden="true" />
                  <span>{userSucursalNombre || 'Sucursal operativa'}</span>
                </div>
              )}
            </div>

            {canSelectSucursal && hasSucursalSeleccionada ? (
              <div className="fidelizacion-canje-modal__session-bar">
                <label className="form-label" htmlFor="fidelizacion-canje-sesion">Sesión de caja</label>
                {loadingSesiones ? (
                  <div className="form-control bg-light">Cargando sesiones abiertas...</div>
                ) : sesiones.length === 1 ? (
                  <div className="form-control bg-light" id="fidelizacion-canje-sesion">
                    {sesiones[0].codigo_caja || `Caja #${sesiones[0].id_caja}`} · Sesión #{sesiones[0].id_sesion_caja}
                  </div>
                ) : sesiones.length > 1 ? (
                  <select id="fidelizacion-canje-sesion" className="form-select" value={selectedSesionId} onChange={(event) => setSelectedSesionId(event.target.value)} required>
                    <option value="">Selecciona una sesión</option>
                    {sesiones.map((sesion) => (
                      <option key={sesion.id_sesion_caja} value={sesion.id_sesion_caja}>
                        {sesion.codigo_caja || `Caja #${sesion.id_caja}`} · {sesion.nombre_caja || 'Caja'} · Sesión #{sesion.id_sesion_caja}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="alert alert-warning mb-0">No hay sesiones de caja abiertas disponibles en esta sucursal.</div>
                )}
                {sesionesError ? <div className="alert alert-danger mt-2 mb-0">{sesionesError}</div> : null}
              </div>
            ) : null}

            {sucursalMissing ? (
              <div className="ventas-create-modal__empty fidelizacion-canje-modal__empty">
                <div className="ventas-create-modal__cart-empty-icon">
                  <i className="bi bi-signpost-split" />
                </div>
                <span>{buildEmptyStateMessage(canjeablesData?.message, saldoDisponible, true)}</span>
              </div>
            ) : loadingCanjeables ? (
              <div className="ventas-detail-modal__loading fidelizacion-canje-modal__loading">
                <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                <span>Cargando productos...</span>
              </div>
            ) : canjeables.length === 0 ? (
              <div className="ventas-create-modal__empty fidelizacion-canje-modal__empty">
                <div className="ventas-create-modal__cart-empty-icon">
                  <i className="bi bi-stars" />
                </div>
                <span>{buildEmptyStateMessage(canjeablesData?.message, saldoDisponible, false)}</span>
              </div>
            ) : (
              <div className="fidelizacion-canje-modal__products ventas-catalog-grid">
                {canjeables.map((producto) => {
                  const selected = carritoMap.get(producto.id_producto);
                  const sinStock = Number(producto.stock_disponible || 0) <= 0;
                  const imagenResuelta = resolveInventarioImageUrl(producto.imagen_principal_url);
                  return (
                    <article
                      key={producto.id_producto}
                      className={`vcp-card ventas-catalog-card-compact canjeable-card ${selected ? 'selected' : ''} ${sinStock ? 'is-out-of-stock' : ''}`}
                      onClick={() => {
                        if (sinStock) return;
                        handleAgregar(producto);
                      }}
                      data-testid="fidelizacion-canjeable-card"
                    >
                      <ProductoCanjeableMedia
                        imagenUrl={imagenResuelta}
                        nombre={producto.nombre_producto}
                        puntos={producto.puntos_requeridos}
                      />
                      <div className="vcp-card__body">
                        <div className="vcp-card__meta-row">
                          <span className="vcp-card__kind">PRODUCTO</span>
                          {selected ? (
                            <span className="fidelizacion-canje-modal__selected-chip">Seleccionado: {selected.cantidad}</span>
                          ) : null}
                        </div>

                        <h6 className="vcp-card__name" title={producto.nombre_producto}>{producto.nombre_producto}</h6>

                        <div className={`vcp-card__stock ${sinStock ? 'is-empty' : ''}`}>
                          {sinStock ? 'Agotado' : `Disponible: ${formatPoints(producto.stock_disponible)}`}
                        </div>

                        <div className="vcp-card__footer">
                          <span className="vcp-card__price">L {formatCurrency(producto.precio)}</span>
                          <button
                            type="button"
                            className="vcp-card__add-btn"
                            disabled={sinStock}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (sinStock) return;
                              handleAgregar(producto);
                            }}
                            aria-label={`Agregar ${producto.nombre_producto}`}
                          >
                            {sinStock ? 'Sin stock' : 'Agregar +'}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="fidelizacion-canje-modal__aside">
            <div className="fidelizacion-canje-modal__summary-card">
              <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <h6 className="fw-bold text-dark mb-0">{cliente?.nombre || 'Cliente'}</h6>
                <span className="badge bg-primary rounded-pill px-3 py-2 fw-medium">
                  ID: {cliente?.id_cliente || '-'}
                </span>
              </div>

              <div className="d-flex justify-content-between text-muted small fw-medium mb-1">
                <span>Sucursal del canje</span>
                <span className="text-end">
                  {canSelectSucursal
                    ? (sucursales.find((row) => String(row.id_sucursal) === selectedSucursalId)?.nombre_sucursal || 'Sin seleccionar')
                    : (userSucursalNombre || 'Sucursal operativa')}
                </span>
              </div>
              <div className="d-flex justify-content-between text-muted small fw-medium mb-1">
                <span>Puntos disponibles</span>
                <span>{formatPoints(saldoDisponible)} pts</span>
              </div>
              <div className="d-flex justify-content-between text-danger small fw-medium mb-1">
                <span>Total del canje</span>
                <span>- {formatPoints(puntosTotalesCanje)} pts</span>
              </div>
              <hr className="my-2" />
              <div className="d-flex justify-content-between fw-bold">
                <span>Saldo restante</span>
                <span className={saldoInsuficiente ? 'text-danger fw-bolder' : 'text-success'}>
                  {formatPoints(puntosRestantes)} pts
                </span>
              </div>
              {saldoInsuficiente ? (
                <div className="alert alert-danger mt-3 mb-0 py-2 small border-0 fw-medium">
                  <i className="bi bi-exclamation-triangle-fill me-2" />
                  El backend rechazara el canje si el saldo no alcanza.
                </div>
              ) : null}
              {algunProductoExcedeStock ? (
                <div className="alert alert-danger mt-3 mb-0 py-2 small border-0 fw-medium">
                  <i className="bi bi-exclamation-triangle-fill me-2" />
                  Alguna cantidad seleccionada supera el stock disponible.
                </div>
              ) : null}
            </div>

            <div className="fidelizacion-canje-modal__cart">
              <div className="ventas-detail-modal__section-title mb-3">Items a canjear</div>
              {carrito.length === 0 ? (
                <div className="ventas-detail-modal__empty">Selecciona al menos un producto para canjear.</div>
              ) : (
                // Lista compacta de dos renglones por item (nunca una tabla
                // con columnas fijas): el nombre/subtotal ya no compiten en
                // ancho con los botones de cantidad, asi que el carrito no
                // necesita scroll horizontal ni en el panel angosto.
                <div className="fidelizacion-canje-modal__cart-list">
                  {carrito.map((item) => (
                    <div key={item.id_producto} className="fidelizacion-canje-modal__cart-item">
                      <div className="fidelizacion-canje-modal__cart-item-row">
                        <strong className="fidelizacion-canje-modal__cart-item-name">{item.nombre_producto}</strong>
                        <span className="fidelizacion-canje-modal__cart-item-subtotal">
                          {formatPoints(item.puntos_requeridos * item.cantidad)} pts
                        </span>
                      </div>
                      <div className="fidelizacion-canje-modal__cart-item-row">
                        <div className="btn-group btn-group-sm fidelizacion-canje-modal__qty">
                          <button type="button" className="btn btn-outline-secondary" onClick={() => handleQuitar(item.id_producto)}>
                            -
                          </button>
                          <button type="button" className="btn btn-light text-dark fw-bold px-3 border-secondary border-opacity-25" disabled>
                            {item.cantidad}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => handleAgregar(item)}
                            disabled={Number(item.stock_disponible || 0) > 0 && item.cantidad >= Number(item.stock_disponible)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold small text-muted">Observacion (opcional)</label>
              <textarea
                className="form-control rounded-3 border-light shadow-sm"
                rows="3"
                placeholder="Anotacion del cajero..."
                maxLength="200"
                value={observacion}
                onChange={(event) => setObservacion(event.target.value)}
                disabled={saving}
              />
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary rounded-3 px-4 fw-medium" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={finalConfirmDisabled}
                className="btn btn-danger rounded-3 px-5 fw-bold shadow-sm"
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Procesando...
                  </>
                ) : 'Confirmar canje'}
              </button>
            </div>
          </aside>
        </form>
      </section>
    </div>
  );
}
