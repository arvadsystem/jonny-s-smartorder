import { useMemo } from 'react';

// Preview embebido reutilizando el endpoint publico real del menu cliente.

const formatMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'L. --';
  return `L. ${parsed.toFixed(2)}`;
};

const MenuPreviewPanel = ({
  loading = false,
  error = '',
  preview = null,
  openAsClientUrl = '/menu-publico/sucursal'
}) => {
  const groupedItems = useMemo(() => {
    const groups = new Map();
    const rows = Array.isArray(preview?.items) ? preview.items : [];

    rows.forEach((item) => {
      const categoryName = item?.categoria?.nombre || 'Sin categoria';
      if (!groups.has(categoryName)) groups.set(categoryName, []);
      groups.get(categoryName).push(item);
    });

    return Array.from(groups.entries());
  }, [preview?.items]);

  const stats = preview?.stats || { total: 0, disponibles: 0, agotados: 0 };

  return (
    <section className="menu-pub-admin__preview" aria-label="Preview del menu publico">
      <div className="menu-pub-admin__preview-head">
        <h6 className="mb-1">Preview cliente</h6>
        <button
          type="button"
          className="btn btn-sm inv-prod-btn-subtle"
          onClick={() => window.open(openAsClientUrl, '_blank', 'noopener,noreferrer')}
        >
          Abrir como cliente
        </button>
      </div>

      {loading ? <div className="text-center py-3">Cargando preview...</div> : null}

      {!loading && error ? (
        <div className="alert alert-danger py-2 mb-2">{error}</div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="menu-pub-admin__preview-stats">
            <span>Total: <strong>{Number(stats.total || 0)}</strong></span>
            <span>Disponibles: <strong>{Number(stats.disponibles || 0)}</strong></span>
            <span>Agotados: <strong>{Number(stats.agotados || 0)}</strong></span>
          </div>

          {groupedItems.length === 0 ? (
            <div className="alert alert-warning mb-0 py-2">
              Esta sucursal no tiene menu disponible en este momento.
            </div>
          ) : (
            <div className="menu-pub-admin__preview-list">
              {groupedItems.map(([categoryName, rows]) => (
                <article key={categoryName} className="menu-pub-admin__preview-category">
                  <header>{categoryName}</header>
                  <ul>
                    {rows.map((item) => (
                      <li key={item.id_detalle_menu || `${item.tipo_item}-${item.id_item_base}`}>
                        <div>
                          <strong>{item.nombre}</strong>
                          <small>{item.tipo_item}</small>
                        </div>
                        <div className="text-end">
                          <div>{formatMoney(item?.precio?.final)}</div>
                          <small className={item?.disponibilidad?.available ? 'text-success' : 'text-danger'}>
                            {item?.disponibilidad?.available ? 'Disponible' : 'No disponible'}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
};

export default MenuPreviewPanel;
