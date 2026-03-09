import { useEffect } from 'react';
import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';

export default function NuevaVentaModal({
  open,
  saving,
  catalogLoading,
  productos,
  categorias,
  clientes,
  combos,
  recetas,
  onClose,
  onSubmit
}) {
  const composer = useVentaComposer({
    productos,
    categorias,
    clientes,
    combos,
    recetas,
    onSubmit,
    resetKey: open
  });

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, saving]);

  if (!open) return null;

  return (
    <div className="ventas-modal-backdrop" role="presentation" onClick={!saving ? onClose : undefined}>
      <section
        className="ventas-modal ventas-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-create-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon" aria-hidden="true">
              <i className="bi bi-cart3" />
            </span>
            <div>
              <h3 id="ventas-create-title">Nueva Venta</h3>
              <p>Punto de venta rapido</p>
            </div>
          </div>

          <div className="ventas-modal__header-actions">
            <button type="button" className="ventas-modal__ghost-btn" title="Atajos">
              <i className="bi bi-keyboard" />
            </button>
            <button
              type="button"
              className="ventas-modal__close-btn"
              onClick={onClose}
              disabled={saving}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </header>

        <form className="ventas-modal__body ventas-create-modal__body" onSubmit={composer.handleSubmit}>
          <VentaComposerCatalog composer={composer} catalogLoading={catalogLoading} />
          <VentaComposerSummary composer={composer} saving={saving} />
        </form>
      </section>
    </div>
  );
}
