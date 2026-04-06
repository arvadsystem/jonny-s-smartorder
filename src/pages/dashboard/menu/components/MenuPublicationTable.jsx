import { useEffect, useMemo, useRef } from 'react';

// Tabla editable de visibilidad, precio publico y orden por item.
const formatMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'L. --';
  return `L. ${parsed.toFixed(2)}`;
};

const TypeBadge = ({ tipoItem }) => {
  const type = String(tipoItem || '').toUpperCase();
  const className =
    type === 'RECETA'
      ? 'menu-pub-admin__type-badge is-receta'
      : type === 'COMBO'
      ? 'menu-pub-admin__type-badge is-combo'
      : 'menu-pub-admin__type-badge is-producto';

  return <span className={className}>{type || 'ITEM'}</span>;
};

const MenuPublicationTable = ({
  items = [],
  loading = false,
  onToggleVisible,
  onToggleAllVisible,
  onChangePrecioPublico,
  onChangeOrden
}) => {
  const headerCheckboxRef = useRef(null);

  const safeItems = Array.isArray(items) ? items : [];
  const activableItems = useMemo(() => safeItems.filter((row) => Boolean(row?.estado_item)), [safeItems]);
  const totalActivable = activableItems.length;
  const visibleActivable = activableItems.filter((row) => Boolean(row?.visible)).length;
  const allChecked = totalActivable > 0 && visibleActivable === totalActivable;
  const someChecked = visibleActivable > 0 && visibleActivable < totalActivable;

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someChecked;
  }, [someChecked]);

  if (loading) {
    return <div className="text-center py-4">Cargando catalogo de publicacion...</div>;
  }

  if (safeItems.length === 0) {
    return (
      <div className="alert alert-warning mb-0">
        No hay items para publicar en esta sucursal.
      </div>
    );
  }

  return (
    <div className="table-responsive menu-pub-admin__table-wrap">
      <table className="table table-sm align-middle mb-0 menu-pub-admin__table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Item</th>
            <th>Estado</th>
            <th className="text-center">
              <div className="d-inline-flex align-items-center gap-2">
                <span>Visible</span>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="form-check-input"
                  checked={allChecked}
                  disabled={totalActivable === 0}
                  title="Seleccionar todos"
                  aria-label="Seleccionar todos los items visibles"
                  onChange={(event) => onToggleAllVisible?.(event.target.checked)}
                />
              </div>
            </th>
            <th>Precio publico</th>
            <th>Orden</th>
          </tr>
        </thead>
        <tbody>
          {safeItems.map((row) => {
            const isActive = Boolean(row?.estado_item);
            const basePrice = Number(row?.precio_base);
            return (
              <tr key={row.item_key}>
                <td>
                  <TypeBadge tipoItem={row.tipo_item} />
                </td>
                <td>
                  <div className="fw-semibold">{row.nombre_item}</div>
                  <div className="small text-muted">
                    #{row.id_item_origen} - Base: {formatMoney(basePrice)}
                  </div>
                </td>
                <td>
                  <span className={`menu-recetas-admin__estado-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                    {isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={Boolean(row.visible)}
                    onChange={(event) => onToggleVisible?.(row.item_key, event.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control form-control-sm"
                    value={row.precio_publico_input}
                    onChange={(event) => onChangePrecioPublico?.(row.item_key, event.target.value)}
                    placeholder={Number.isFinite(basePrice) ? String(basePrice) : 'Sin precio'}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="form-control form-control-sm"
                    value={row.orden_input}
                    onChange={(event) => onChangeOrden?.(row.item_key, event.target.value)}
                    disabled={!row.visible}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default MenuPublicationTable;