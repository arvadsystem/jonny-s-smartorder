import {
  formatMoney,
  resolveComboActivo,
  resolveComboImageCandidates,
  resolveComboNombre
} from '../utils/combosAdminUtils';

const CombosTable = ({
  loading,
  combos,
  togglingId,
  cardImageErrors,
  onCardImageError,
  onEditar,
  onCambiarEstado
}) => {
  if (loading) {
    return <div className="text-center py-4">Cargando combos...</div>;
  }

  if (!Array.isArray(combos) || combos.length === 0) {
    return (
      <div className="text-center py-5 text-muted">
        <i className="bi bi-collection fs-3 d-block mb-2" />
        No hay combos para mostrar.
      </div>
    );
  }

  return (
    <div className="menu-recetas-admin__cards">
      {combos.map((combo) => {
        const id = Number(combo?.id_combo || 0);
        const estadoActivo = resolveComboActivo(combo);
        const imageCandidates = resolveComboImageCandidates(combo);
        const imageAttempt = Math.max(0, Number(cardImageErrors?.[id] || 0));
        const imageUrl = imageCandidates[imageAttempt] || '';

        return (
          <article
            key={id}
            className={`menu-recetas-card ${estadoActivo ? 'is-active' : 'is-inactive'}`}
          >
            <header className="menu-recetas-card__media">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Imagen de combo ${String(resolveComboNombre(combo) || id)}`}
                  onError={() => onCardImageError(id)}
                />
              ) : (
                <div className="menu-recetas-card__placeholder">
                  <i className="bi bi-image" />
                  <span>Sin imagen</span>
                </div>
              )}
              <div className="menu-recetas-card__media-top">
                <span className={`menu-recetas-admin__estado-badge ${estadoActivo ? 'is-active' : 'is-inactive'}`}>
                  {estadoActivo ? 'Activo' : 'Inactivo'}
                </span>
                <span className="menu-recetas-card__price-pill">{formatMoney(combo?.precio)}</span>
              </div>
            </header>

            <div className="menu-recetas-card__body">
              <div className="menu-recetas-card__title-row">
                <h6>{String(resolveComboNombre(combo) || `Combo #${id}`)}</h6>
                <span className="menu-recetas-card__id">#{id}</span>
              </div>

              <div className="menu-recetas-card__meta">
                <div>
                  <small>Menu</small>
                  <strong>{String(combo?.id_menu ?? '-')}</strong>
                </div>
                <div>
                  <small>Personas</small>
                  <strong>{String(combo?.cant_personas ?? '-')}</strong>
                </div>
                <div>
                  <small>Detalle</small>
                  <strong>{Number(combo?.total_detalle || 0)} recetas</strong>
                </div>
              </div>
            </div>

            <footer className="menu-recetas-card__actions">
              <button
                type="button"
                // Replica el boton Editar de Inventarios > Categorias para mantener consistencia visual.
                className="inv-catpro-action edit inv-catpro-action-compact menu-recetas-admin__edit-action"
                onClick={() => onEditar(id)}
                title="Editar"
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                <span className="inv-catpro-action-label">Editar</span>
              </button>
              <button
                type="button"
                // Replica el boton de estado de Inventarios > Categorias (Inactivar/Activar).
                className={`inv-catpro-action ${estadoActivo ? 'state-off' : 'state-on'} inv-catpro-action-compact menu-recetas-admin__state-action`}
                onClick={() => onCambiarEstado(combo)}
                disabled={togglingId === id}
                title={estadoActivo ? 'Inactivar' : 'Activar'}
              >
                <i className={`bi ${estadoActivo ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
                <span className="inv-catpro-action-label">
                  {togglingId === id ? 'Procesando' : estadoActivo ? 'Inactivar' : 'Activar'}
                </span>
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
};

export default CombosTable;



