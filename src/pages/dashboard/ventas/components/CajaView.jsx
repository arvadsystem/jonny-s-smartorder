import VentaComposerCatalog from './VentaComposerCatalog';
import VentaComposerSummary from './VentaComposerSummary';
import { useVentaComposer } from '../hooks/useVentaComposer';

export default function CajaView({
  sucursales,
  isSuperAdmin,
  defaultSucursalId,
  productos,
  categorias,
  tiposDepartamento,
  clientes,
  combos,
  recetas,
  descuentosCatalogo,
  catalogLoading,
  saving,
  onSubmit
}) {
  const composer = useVentaComposer({
    productos,
    categorias,
    tiposDepartamento,
    clientes,
    combos,
    recetas,
    descuentosCatalogo,
    sucursales,
    isSuperAdmin,
    defaultSucursalId,
    onSubmit
  });

  return (
    <div className="ventas-page ventas-caja-page">
      <div className="inv-catpro-card inv-prod-card ventas-caja-card">
        <form className="ventas-create-modal__body ventas-caja__body" onSubmit={composer.handleSubmit}>
          <VentaComposerCatalog composer={composer} catalogLoading={catalogLoading} />
          <VentaComposerSummary composer={composer} saving={saving} />
        </form>
      </div>
    </div>
  );
}
