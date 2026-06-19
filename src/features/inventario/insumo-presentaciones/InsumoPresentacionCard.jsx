const isActive = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  return String(value ?? '').trim().toLowerCase() === 'true';
};

const formatQuantity = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '').trim() || '0';
  return new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4
  }).format(number);
};

const resolveUnitLabel = (name, symbol, fallback = 'Unidad') => {
  const cleanName = String(name || '').trim();
  const cleanSymbol = String(symbol || '').trim();
  return cleanName || cleanSymbol || fallback;
};

const buildEquivalenceLabel = (presentacion) => {
  const cantidadPresentacion = formatQuantity(presentacion?.cantidad_presentacion);
  const unidadPresentacion = resolveUnitLabel(
    presentacion?.unidad_presentacion_nombre,
    presentacion?.unidad_presentacion_simbolo,
    'Unidad de presentacion'
  );
  const cantidadBase = formatQuantity(presentacion?.cantidad_base);
  const unidadBase = resolveUnitLabel(
    presentacion?.unidad_base_nombre,
    presentacion?.unidad_base_simbolo,
    'Unidad de inventario'
  );

  return `${cantidadPresentacion} ${unidadPresentacion} = ${cantidadBase} ${unidadBase}`;
};

export default function InsumoPresentacionCard({
  presentacion,
  canEdit = false,
  canChangeEstado = false,
  changing = false,
  onEdit,
  onRequestEstado
}) {
  const active = isActive(presentacion?.estado);
  const usoCompra = Boolean(presentacion?.uso_compra);
  const usoReceta = Boolean(presentacion?.uso_receta);
  const predCompra = Boolean(presentacion?.es_predeterminada_compra);
  const predReceta = Boolean(presentacion?.es_predeterminada_receta);

  return (
    <article className={`ins-pres-card ${active ? 'is-active' : 'is-inactive'}`}>
      <div className="ins-pres-card__main">
        <div className="ins-pres-card__title-row">
          <h4>{presentacion?.nombre_presentacion || `Presentacion #${presentacion?.id_presentacion ?? '-'}`}</h4>
          <span className={`ins-pres-pill ${active ? 'is-ok' : 'is-muted'}`}>
            {active ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div className="ins-pres-card__equivalence">{buildEquivalenceLabel(presentacion)}</div>
        <div className="ins-pres-card__chips">
          {usoCompra ? <span className="ins-pres-chip"><i className="bi bi-bag-check" /> Compra</span> : null}
          {usoReceta ? <span className="ins-pres-chip"><i className="bi bi-journal-check" /> Receta</span> : null}
          {predCompra ? <span className="ins-pres-chip is-default"><i className="bi bi-star-fill" /> Pred. compra</span> : null}
          {predReceta ? <span className="ins-pres-chip is-default"><i className="bi bi-star-fill" /> Pred. receta</span> : null}
        </div>
      </div>

      <div className="ins-pres-card__actions">
        {canEdit ? (
          <button type="button" className="btn inv-prod-btn-outline ins-pres-action" onClick={() => onEdit?.(presentacion)}>
            <i className="bi bi-pencil-square" aria-hidden="true" />
            <span>Editar</span>
          </button>
        ) : null}
        {canChangeEstado ? (
          <button
            type="button"
            className={`btn ins-pres-action ${active ? 'inv-prod-btn-inactivate' : 'inv-prod-btn-success-lite'}`}
            onClick={() => onRequestEstado?.(presentacion, !active)}
            disabled={changing}
          >
            <i className={`bi ${active ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
            <span>{changing ? 'Guardando...' : active ? 'Inactivar' : 'Activar'}</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
