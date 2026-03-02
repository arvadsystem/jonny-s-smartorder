// NEW: switch compacto para alternar INSUMOS/PRODUCTOS en el header de Categorías.
// WHY: unificar la interacción en una pieza reutilizable sin tocar la lógica de datos/CRUD.
// IMPACT: solo UI/UX del toggle en Categorías; mantiene el mismo estado y handlers del contenedor.
const CompactHeaderSwitch = ({
  value = 'insumos',
  onChange,
  ariaLabel = 'Cambiar catálogo de categorías'
}) => {
  const safeValue = value === 'productos' ? 'productos' : 'insumos';

  const setScope = (nextScope) => {
    if (nextScope === safeValue) return;
    if (typeof onChange === 'function') onChange(nextScope);
  };

  // NEW: soporte teclado para alternar con Enter/Espacio/Flechas manteniendo accesibilidad del switch.
  // WHY: asegurar interacción consistente en desktop (teclado) y responsive (touch) sin librerías externas.
  // IMPACT: solo comportamiento del control; no altera el estado externo ni rutas de render.
  const onOptionKeyDown = (event, targetScope) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setScope(targetScope);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setScope('insumos');
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setScope('productos');
    }
  };

  return (
    <div
      className={`inv-cat-compact-switch ${safeValue === 'productos' ? 'is-productos' : 'is-insumos'}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <span className="inv-cat-compact-switch__thumb" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={safeValue === 'insumos'}
        className={`inv-cat-compact-switch__option ${safeValue === 'insumos' ? 'is-active' : ''}`}
        onClick={() => setScope('insumos')}
        onKeyDown={(event) => onOptionKeyDown(event, 'insumos')}
      >
        INSUMOS
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={safeValue === 'productos'}
        className={`inv-cat-compact-switch__option ${safeValue === 'productos' ? 'is-active' : ''}`}
        onClick={() => setScope('productos')}
        onKeyDown={(event) => onOptionKeyDown(event, 'productos')}
      >
        PRODUCTOS
      </button>
    </div>
  );
};

export default CompactHeaderSwitch;

