import RecetasEmptyState from './RecetasEmptyState';
import {
  formatMoney,
  resolveRecetaActiva,
  resolveRecetaImageCandidates,
  truncateText
} from '../utils/recetasAdminUtils';

const RecetasTable = ({
  loading,
  recetas,
  viewMode,
  togglingId,
  cardImageErrors,
  onCardImageError,
  onEditar,
  onCambiarEstado
}) => {
  if (loading) {
    return <div className="text-center py-4">Cargando recetas...</div>;
  }

  if (!Array.isArray(recetas) || recetas.length === 0) {
    return <RecetasEmptyState />;
  }

  if (viewMode === 'table') {
    return (
      <div className="table-responsive">
        <table className="table table-hover align-middle menu-recetas-admin__table mb-0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Estado</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recetas.map((receta) => {
              const id = Number(receta?.id_receta || 0);
              const estadoActivo = resolveRecetaActiva(receta);
              return (
                <tr key={id}>
                  <td>#{id}</td>
                  <td>{String(receta?.nombre_receta || '')}</td>
                  <td>{formatMoney(receta?.precio)}</td>
                  <td>
                    <span className={`menu-recetas-admin__estado-badge ${estadoActivo ? 'is-active' : 'is-inactive'}`}>
                      {estadoActivo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="menu-recetas-admin__row-actions">
                      <button
                        type="button"
                        className="btn inv-prod-btn-subtle btn-sm"
                        onClick={() => onEditar(id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${estadoActivo ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'}`}
                        onClick={() => onCambiarEstado(receta)}
                        disabled={togglingId === id}
                      >
                        {togglingId === id ? 'Procesando...' : estadoActivo ? 'Inactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="menu-recetas-admin__cards">
      {recetas.map((receta) => {
        const id = Number(receta?.id_receta || 0);
        const estadoActivo = resolveRecetaActiva(receta);
        const imageCandidates = resolveRecetaImageCandidates(receta);
        const imageAttempt = Math.max(0, Number(cardImageErrors?.[id] || 0));
        const imageUrl = imageCandidates[imageAttempt] || '';
        const hasImageUrl = imageCandidates.length > 0;
        const descripcion = truncateText(
          String(receta?.descripcion || '').trim() || 'Sin descripcion registrada.',
          104
        );
        const menuId = String(receta?.id_menu ?? '-');
        const departamentoId = String(receta?.id_tipo_departamento ?? '-');

        return (
          <article
            key={id}
            className={`menu-recetas-card ${estadoActivo ? 'is-active' : 'is-inactive'}`}
          >
            <header className="menu-recetas-card__media">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Imagen de ${String(receta?.nombre_receta || 'receta')}`}
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
                <span className="menu-recetas-card__price-pill">{formatMoney(receta?.precio)}</span>
              </div>
            </header>

            <div className="menu-recetas-card__body">
              <div className="menu-recetas-card__title-row">
                <h6>{String(receta?.nombre_receta || 'Receta sin nombre')}</h6>
                <span className="menu-recetas-card__id">#{id}</span>
              </div>

              <p className="menu-recetas-card__description">{descripcion}</p>

              <div className="menu-recetas-card__meta">
                <div>
                  <small>Menu</small>
                  <strong>{menuId}</strong>
                </div>
                <div>
                  <small>Departamento</small>
                  <strong>{departamentoId}</strong>
                </div>
                <div>
                  <small>Imagen</small>
                  <strong>{hasImageUrl ? 'Con URL' : 'Sin URL'}</strong>
                </div>
              </div>
            </div>

            <footer className="menu-recetas-card__actions">
              <button
                type="button"
                className="btn inv-prod-btn-subtle btn-sm"
                onClick={() => onEditar(id)}
              >
                Editar
              </button>
              <button
                type="button"
                className={`btn btn-sm ${estadoActivo ? 'inv-prod-btn-danger-lite' : 'inv-prod-btn-success-lite'}`}
                onClick={() => onCambiarEstado(receta)}
                disabled={togglingId === id}
              >
                {togglingId === id ? 'Procesando...' : estadoActivo ? 'Inactivar' : 'Activar'}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
};

export default RecetasTable;
