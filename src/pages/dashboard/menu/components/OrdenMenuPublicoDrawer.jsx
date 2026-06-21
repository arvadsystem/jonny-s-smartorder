import { useCallback, useEffect, useMemo, useState } from 'react';
import menuPublicacionAdminService from '../services/menuPublicacionAdminService';
import { notifyPublicMenuCatalogChanged } from '../../../../modules/public-menu/utils/publicMenuCatalogRefresh';

const TYPE_LABELS = Object.freeze({
  PRODUCTO: 'Producto',
  RECETA: 'Receta'
});

const VISIBILITY_LABELS = Object.freeze({
  VISIBLE: 'Visible',
  SIN_CONTENIDO: 'Sin contenido',
  INACTIVO: 'Inactivo',
  SIN_PUBLICACION: 'Sin publicacion'
});

const getItemId = (item) => Number(item?.id_menu_publicacion_regla || 0);

const moveItem = (items, fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

const normalizeOrdenPayload = (items) =>
  (Array.isArray(items) ? items : []).map((item, index) => ({
    id_menu_publicacion_regla: getItemId(item),
    orden: index + 1
  }));

const formatContentCount = (item) => {
  const count = Number(item?.cantidad_contenido || 0);
  const type = String(item?.tipo_item || '').toUpperCase();
  if (type === 'RECETA') return `${count} ${count === 1 ? 'receta' : 'recetas'}`;
  return `${count} ${count === 1 ? 'producto' : 'productos'}`;
};

const OrdenMenuPublicoDrawer = ({
  open,
  onClose,
  onSaved
}) => {
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [items, setItems] = useState([]);
  const [initialSignature, setInitialSignature] = useState('');
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draggedId, setDraggedId] = useState(null);

  const currentSignature = useMemo(() => JSON.stringify(normalizeOrdenPayload(items)), [items]);
  const hasChanges = currentSignature !== initialSignature;

  const loadBranches = useCallback(async () => {
    const rows = await menuPublicacionAdminService.getSucursales();
    setBranches(rows);
    const firstBranch = rows.find((branch) => branch?.estado && branch?.tiene_menu_vigente) || rows[0] || null;
    if (firstBranch) setSelectedBranchId(String(firstBranch.id_sucursal));
  }, []);

  const loadOrder = useCallback(async (branchId) => {
    if (!branchId) return;
    try {
      setLoading(true);
      setError('');
      const response = await menuPublicacionAdminService.getCategoriasOrden(branchId);
      const rows = Array.isArray(response?.data) ? response.data : [];
      setItems(rows);
      setInitialSignature(JSON.stringify(normalizeOrdenPayload(rows)));
      setMeta(response?.meta || {});
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el orden del menu publico.');
      setItems([]);
      setInitialSignature('');
      setMeta({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadBranches();
  }, [loadBranches, open]);

  useEffect(() => {
    if (!open || !selectedBranchId) return;
    void loadOrder(selectedBranchId);
  }, [loadOrder, open, selectedBranchId]);

  const handleMove = useCallback((fromIndex, toIndex) => {
    setItems((current) => moveItem(current, fromIndex, toIndex));
  }, []);

  const handleDragStart = (item) => {
    setDraggedId(getItemId(item));
  };

  const handleDrop = (targetItem) => {
    const sourceId = Number(draggedId || 0);
    const targetId = getItemId(targetItem);
    if (!sourceId || !targetId || sourceId === targetId) {
      setDraggedId(null);
      return;
    }
    setItems((current) => {
      const fromIndex = current.findIndex((item) => getItemId(item) === sourceId);
      const toIndex = current.findIndex((item) => getItemId(item) === targetId);
      return moveItem(current, fromIndex, toIndex);
    });
    setDraggedId(null);
  };

  const handleSave = async () => {
    if (!selectedBranchId || saving || !hasChanges) return;
    try {
      setSaving(true);
      setError('');
      const payload = normalizeOrdenPayload(items);
      await menuPublicacionAdminService.saveCategoriasOrden({
        idSucursal: selectedBranchId,
        items: payload
      });
      notifyPublicMenuCatalogChanged({ branchId: selectedBranchId });
      setInitialSignature(JSON.stringify(payload));
      onSaved?.('Orden del menu publico actualizado correctamente.');
      await loadOrder(selectedBranchId);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el orden del menu publico.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="inv-prod-pmodal inv-prod-pmodal--public-order show">
      <div className="inv-prod-pmodal__overlay" onClick={onClose} />
      <div className="inv-prod-pmodal__viewport">
        <section
          id="menu-publico-orden-drawer"
          className="inv-prod-pmodal__panel inv-prod-pmodal__panel--public-order"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-publico-orden-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create">
            <div className="inv-prod-pmodal__body">
              <div className="inv-ins-create-hero is-create">
                <button
                  type="button"
                  className="inv-prod-drawer-close inv-ins-create-hero__close"
                  onClick={onClose}
                  title="Cerrar"
                  aria-label="Cerrar ordenador"
                  disabled={saving}
                >
                  <i className="bi bi-x-lg" />
                </button>
                <div className="inv-ins-create-hero__icon">
                  <i className="bi bi-list-ol" aria-hidden="true" />
                </div>
                <div className="inv-ins-create-hero__copy">
                  <div className="inv-ins-create-hero__kicker">CONFIGURACION PUBLICA</div>
                  <div id="menu-publico-orden-title" className="inv-ins-create-hero__title">
                    Ordenar menu publico
                  </div>
                </div>
              </div>

              <div className="inv-prod-pmodal__sections mt-3">
                <section className="inv-prod-pmodal__section">
                  <p className="menu-public-order__help">
                    Arrastra las categorias para definir el orden en que apareceran en el menu publico.
                    Solo se mostraran al cliente las categorias activas que tengan contenido publicado.
                  </p>

                  <label className="form-label" htmlFor="menu-public-order-branch">Sucursal</label>
                  <select
                    id="menu-public-order-branch"
                    className="form-select"
                    value={selectedBranchId}
                    onChange={(event) => setSelectedBranchId(event.target.value)}
                    disabled={loading || saving}
                  >
                    {branches.map((branch) => (
                      <option key={branch.id_sucursal} value={branch.id_sucursal}>
                        {branch.nombre_sucursal}
                      </option>
                    ))}
                  </select>

                  {meta?.message ? <div className="inv-ins-help mt-2">{meta.message}</div> : null}
                  {error ? <div className="alert alert-danger inv-prod-alert mt-3">{error}</div> : null}

                  <div className="menu-public-order__list mt-3">
                    {loading ? (
                      <div className="text-center py-4">Cargando categorias...</div>
                    ) : items.length === 0 ? (
                      <div className="menu-public-order__empty">No hay categorias configuradas para ordenar.</div>
                    ) : (
                      items.map((item, index) => {
                        const type = String(item?.tipo_item || '').toUpperCase();
                        const visibility = String(item?.estado_visibilidad || '').toUpperCase();
                        return (
                          <div
                            key={getItemId(item)}
                            className="menu-public-order__row"
                            draggable={!saving}
                            onDragStart={() => handleDragStart(item)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleDrop(item)}
                          >
                            <span className="menu-public-order__handle" aria-hidden="true">
                              <i className="bi bi-grip-vertical" />
                            </span>
                            <strong className="menu-public-order__position">{index + 1}</strong>
                            <div className="menu-public-order__main">
                              <span title={item.nombre_publico}>{item.nombre_publico}</span>
                              <small>{formatContentCount(item)}</small>
                            </div>
                            <span className={`menu-pub-admin__type-badge is-${type === 'RECETA' ? 'receta' : 'producto'}`}>
                              {TYPE_LABELS[type] || 'Item'}
                            </span>
                            <span className={`menu-recetas-admin__estado-badge ${visibility === 'VISIBLE' ? 'is-active' : visibility === 'INACTIVO' ? 'is-inactive' : 'is-neutral'}`}>
                              {VISIBILITY_LABELS[visibility] || 'Sin contenido'}
                            </span>
                            <div className="menu-public-order__actions">
                              <button
                                type="button"
                                className="inv-prod-toolbar-btn"
                                onClick={() => handleMove(index, index - 1)}
                                disabled={saving || index === 0}
                                aria-label={`Subir ${item.nombre_publico}`}
                                title="Subir"
                              >
                                <i className="bi bi-arrow-up" />
                              </button>
                              <button
                                type="button"
                                className="inv-prod-toolbar-btn"
                                onClick={() => handleMove(index, index + 1)}
                                disabled={saving || index === items.length - 1}
                                aria-label={`Bajar ${item.nombre_publico}`}
                                title="Bajar"
                              >
                                <i className="bi bi-arrow-down" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            </div>

            <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn inv-prod-btn-primary"
                onClick={handleSave}
                disabled={saving || loading || !hasChanges}
              >
                {saving ? 'Guardando...' : 'Guardar orden'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrdenMenuPublicoDrawer;
