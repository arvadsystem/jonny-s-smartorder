import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { inventarioService } from '../../../../services/inventarioService';
import { extractApiMessage, formatCurrency, formatPoints } from '../utils/fidelizacionHelpers';

const normalizeProductoCatalogo = (row) => ({
  id_producto: Number(row?.id_producto ?? 0) || null,
  nombre_producto: String(row?.nombre_producto ?? '').trim(),
  precio: Number(row?.precio ?? 0) || 0,
  cantidad: Number(row?.cantidad ?? 0) || 0,
  stock_minimo: Number(row?.stock_minimo ?? 0) || 0,
  id_almacen: Number(row?.id_almacen ?? 0) || null,
  estado: row?.estado !== undefined ? Boolean(row.estado) : true
});

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
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [selectedProductos, setSelectedProductos] = useState({});

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!show) return;

    const lempirasValue = configuracion?.configuracion?.lempiras_por_punto;
    setLempiras(lempirasValue ? String(lempirasValue) : '');
    setSearchTerm('');

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

  const handleSubmit = (event) => {
    event.preventDefault();
    const lempirasValue = Number(lempiras);
    if (!Number.isFinite(lempirasValue) || lempirasValue <= 0 || saving) return;

    const productos_canjeables = Object.entries(selectedProductos)
      .filter(([, value]) => value?.checked)
      .map(([idProducto, value]) => {
        const payload = {
          id_producto: Number(idProducto)
        };

        const override = String(value?.puntos_requeridos_override ?? '').trim();
        if (override) {
          payload.puntos_requeridos_override = Number(override);
        }

        return payload;
      });

    onSubmit({
      id_sucursal: configuracion?.id_sucursal || undefined,
      lempiras_por_punto: lempirasValue,
      productos_canjeables
    });
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
                    <div className="col-12 col-md-6">
                      <label className="form-label">Lempiras por punto</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={lempiras}
                        onChange={(event) => setLempiras(event.target.value)}
                        className="form-control"
                        disabled={saving}
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="fidelizacion-config-modal__summary">
                        <strong>{selectedCount}</strong>
                        <span>productos canjeables seleccionados</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="inv-prod-pmodal__section">
                  <div className="inv-prod-pmodal__section-head">
                    <div className="inv-prod-pmodal__section-title">Catalogo de productos</div>
                    <div className="inv-prod-pmodal__section-sub">Selecciona productos de la sucursal visible y define override opcional de puntos.</div>
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
                            <th>Override puntos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProductos.map((producto) => {
                            const state = selectedProductos[producto.id_producto] || { checked: false, puntos_requeridos_override: '' };
                            const stockVisible = Math.max(Number(producto.cantidad || 0) - Number(producto.stock_minimo || 0), 0);
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
                                  <div className="fidelizacion-config-modal__product-name">
                                    <strong>{producto.nombre_producto}</strong>
                                    <small>ID {producto.id_producto}</small>
                                  </div>
                                </td>
                                <td>L. {formatCurrency(producto.precio)}</td>
                                <td>{formatPoints(stockVisible)}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="form-control form-control-sm"
                                    placeholder="Automatico"
                                    value={state.puntos_requeridos_override}
                                    onChange={(event) => updateOverride(producto.id_producto, event.target.value)}
                                    disabled={!state.checked || saving}
                                  />
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
                disabled={saving || !lempiras || Number(lempiras) <= 0}
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
