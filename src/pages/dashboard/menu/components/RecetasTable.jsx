import { useEffect, useMemo, useState } from 'react';
import RecetasEmptyState from './RecetasEmptyState';
import {
  formatMoney,
  resolveRecetaActiva,
  resolveRecetaImageCandidates,
  truncateText
} from '../utils/recetasAdminUtils';

const CARDS_PER_PAGE = 10;

const RecetasTable = ({
  loading,
  recetas,
  showInactiveOnly = false,
  viewMode,
  togglingId,
  cardImageErrors,
  onCardImageError,
  onEditar,
  onCambiarEstado
}) => {
  const [cardsPageIndex, setCardsPageIndex] = useState(0);

  const totalCards = Array.isArray(recetas) ? recetas.length : 0;
  const recetasCardsPages = useMemo(() => {
    const rows = Array.isArray(recetas) ? recetas : [];
    const pages = [];
    for (let i = 0; i < rows.length; i += CARDS_PER_PAGE) pages.push(rows.slice(i, i + CARDS_PER_PAGE));
    return pages;
  }, [recetas]);
  const totalCardsPages = Math.max(1, recetasCardsPages.length || 0);
  const safeCardsPageIndex = Math.min(cardsPageIndex, totalCardsPages - 1);
  const recetasCardsPage = recetasCardsPages[safeCardsPageIndex] || [];

  useEffect(() => {
    setCardsPageIndex((prev) => Math.min(Math.max(0, prev), Math.max(0, totalCardsPages - 1)));
  }, [totalCardsPages]);

  useEffect(() => {
    setCardsPageIndex(0);
  }, [viewMode]);

  if (loading) {
    return <div className="text-center py-4">Cargando recetas...</div>;
  }

  if (!Array.isArray(recetas) || recetas.length === 0) {
    return (
      <RecetasEmptyState
        message={showInactiveOnly ? 'No hay recetas inactivas para mostrar.' : 'No hay recetas para mostrar.'}
      />
    );
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
                        onClick={() => onCambiarEstado(receta)}
                        disabled={togglingId === id}
                        title={estadoActivo ? 'Inactivar' : 'Activar'}
                      >
                        <i className={`bi ${estadoActivo ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
                        <span className="inv-catpro-action-label">
                          {togglingId === id ? 'Procesando' : estadoActivo ? 'Inactivar' : 'Activar'}
                        </span>
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
    <>
      <div className="inv-ins-carousel-shell">
        <div className="inv-ins-carousel-meta">
          <span>{`Pagina ${safeCardsPageIndex + 1} de ${totalCardsPages}`}</span>
          <span>{`${totalCards} recetas visibles`}</span>
        </div>
        <div className="inv-prod-carousel-stage inv-ins-carousel-stage">
          <button
            type="button"
            className={`btn inv-prod-carousel-float is-prev ${safeCardsPageIndex > 0 ? 'is-visible' : ''}`}
            aria-label="Pagina anterior del carrusel de recetas"
            onClick={() => setCardsPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeCardsPageIndex <= 0}
          >
            <i className="bi bi-chevron-left" />
          </button>

          <div className="inv-ins-carousel-page menu-recetas-admin__carousel-page" key={`recetas-cards-page-${safeCardsPageIndex}`}>
            {recetasCardsPage.map((receta) => {
        const id = Number(receta?.id_receta || 0);
        const estadoActivo = resolveRecetaActiva(receta);
        const imageCandidates = resolveRecetaImageCandidates(receta);
        const imageAttempt = Math.max(0, Number(cardImageErrors?.[id] || 0));
        const imageUrl = imageCandidates[imageAttempt] || '';
        const descripcion = truncateText(
          String(receta?.descripcion || '').trim() || 'Sin descripcion registrada.',
          104
        );
        const menuId = String(receta?.id_menu ?? '-');
        const departamentoId = String(receta?.id_tipo_departamento ?? '-');

        return (
          <article
            key={id}
            className={`menu-recetas-card menu-recetas-card--compact ${estadoActivo ? 'is-active' : 'is-inactive'}`}
          >
            <header className="menu-recetas-card__media">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={`Imagen de ${String(receta?.nombre_receta || 'receta')}`}
                  referrerPolicy="no-referrer"
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
                onClick={() => onCambiarEstado(receta)}
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

          <button
            type="button"
            className={`btn inv-prod-carousel-float is-next ${safeCardsPageIndex < totalCardsPages - 1 ? 'is-visible' : ''}`}
            aria-label="Pagina siguiente del carrusel de recetas"
            onClick={() => setCardsPageIndex((prev) => Math.min(totalCardsPages - 1, prev + 1))}
            disabled={safeCardsPageIndex >= totalCardsPages - 1}
          >
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>
    </>
  );
};

export default RecetasTable;

