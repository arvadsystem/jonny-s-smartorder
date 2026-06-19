// AM: switch compacto reutilizable para alternar dos vistas dentro del header del modulo.
// AM: mantiene defaults INSUMOS/PRODUCTOS para compatibilidad con Categorias.
const CompactHeaderSwitch = ({
  value = 'insumos',
  onChange,
  ariaLabel = 'Cambiar catalogo',
  leftValue = 'insumos',
  rightValue = 'productos',
  leftLabel = 'INSUMOS',
  rightLabel = 'PRODUCTOS'
}) => {
  const safeLeftValue = String(leftValue || 'insumos');
  const safeRightValue = String(rightValue || 'productos');
  const safeValue = String(value) === safeRightValue ? safeRightValue : safeLeftValue;

  const setScope = (nextScope) => {
    if (nextScope === safeValue) return;
    if (typeof onChange === 'function') onChange(nextScope);
  };

  // AM: soporte teclado para mantener accesibilidad del switch en desktop y mobile.
  const onOptionKeyDown = (event, targetScope) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setScope(targetScope);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setScope(safeLeftValue);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setScope(safeRightValue);
    }
  };

  return (
    <div
      className={`inv-cat-compact-switch ${safeValue === safeRightValue ? 'is-productos' : 'is-insumos'}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <span className="inv-cat-compact-switch__thumb" aria-hidden="true" />
      <button
        type="button"
        role="tab"
        aria-selected={safeValue === safeLeftValue}
        className={`inv-cat-compact-switch__option ${safeValue === safeLeftValue ? 'is-active' : ''}`}
        onClick={() => setScope(safeLeftValue)}
        onKeyDown={(event) => onOptionKeyDown(event, safeLeftValue)}
      >
        {leftLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={safeValue === safeRightValue}
        className={`inv-cat-compact-switch__option ${safeValue === safeRightValue ? 'is-active' : ''}`}
        onClick={() => setScope(safeRightValue)}
        onKeyDown={(event) => onOptionKeyDown(event, safeRightValue)}
      >
        {rightLabel}
      </button>
    </div>
  );
};

export default CompactHeaderSwitch;

