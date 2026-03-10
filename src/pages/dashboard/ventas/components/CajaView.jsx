import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';

export default function CajaView({
  productos,
  categorias,
  clientes,
  combos,
  recetas,
  catalogLoading,
  saving,
  onSubmit
}) {
  const composer = useVentaComposer({
    productos,
    categorias,
    clientes,
    combos,
    recetas,
    onSubmit
  });

  return (
    <div className="ventas-page ventas-caja-page">
      <div className="inv-catpro-card inv-prod-card ventas-caja-card">
        <div className="inv-prod-header ventas-caja__header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-cart3 inv-prod-title-icon" />
              <span className="inv-prod-title">Caja</span>
            </div>
            <div className="inv-prod-subtitle">
              Punto de venta rapido con captura amplia para productos, combos y recetas.
            </div>
          </div>

          <div className="ventas-caja__header-badge">
            <i className="bi bi-display" />
            <span>Vista de caja</span>
          </div>
        </div>

        <form className="ventas-create-modal__body ventas-caja__body" onSubmit={composer.handleSubmit}>
          <VentaComposerCatalog composer={composer} catalogLoading={catalogLoading} />
          <VentaComposerSummary composer={composer} saving={saving} />
        </form>
      </div>
    </div>
  );
}
