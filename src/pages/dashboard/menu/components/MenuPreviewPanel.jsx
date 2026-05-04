import { useMemo, useState } from 'react';

const normalizeString = (value) => String(value || '').trim();

// Convierte la URL de cliente a modo espejo embebido en /menu-publico/menu.
const buildEmbeddedPreviewUrl = (openAsClientUrl) => {
  const raw = normalizeString(openAsClientUrl);
  const fallback = '/menu-publico/menu?preview_admin=1&auto=1&tipo_pedido=dine-in';
  if (!raw || typeof window === 'undefined') return fallback;

  try {
    const parsed = new URL(raw, window.location.origin);
    const params = new URLSearchParams(parsed.search);
    params.set('preview_admin', '1');
    params.set('auto', '1');
    if (!params.get('tipo_pedido')) params.set('tipo_pedido', 'dine-in');
    return `/menu-publico/menu?${params.toString()}`;
  } catch {
    return fallback;
  }
};

const MenuPreviewPanel = ({
  loading = false,
  error = '',
  preview = null,
  openAsClientUrl = '/menu-publico/sucursal'
}) => {
  const [reloadToken, setReloadToken] = useState(0);
  const mirrorUrl = useMemo(() => buildEmbeddedPreviewUrl(openAsClientUrl), [openAsClientUrl]);

  return (
    <section className="menu-pub-admin__preview" aria-label="Preview del menu publico real">
      <div className="menu-pub-admin__preview-head">
        <h6 className="mb-0">Vista espejo cliente</h6>
        <div className="menu-pub-admin__preview-head-actions">
          <button
            type="button"
            className="btn btn-sm inv-prod-btn-subtle"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            Recargar preview
          </button>
          <button
            type="button"
            className="btn btn-sm inv-prod-btn-primary"
            onClick={() => window.open(openAsClientUrl, '_blank', 'noopener,noreferrer')}
          >
            Abrir como cliente
          </button>
        </div>
      </div>

      <div className="menu-pub-admin__preview-layout">
        <div className="menu-pub-admin__preview-mirror">
          {loading ? (
            <div className="menu-pub-admin__preview-overlay">Cargando preview...</div>
          ) : null}

          {error ? (
            <div className="menu-pub-admin__preview-overlay is-error">{error}</div>
          ) : (
            <iframe
              key={`${mirrorUrl}-${reloadToken}`}
              src={mirrorUrl}
              className="menu-pub-admin__preview-iframe"
              title="Vista espejo del menu publico"
              loading="lazy"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default MenuPreviewPanel;
