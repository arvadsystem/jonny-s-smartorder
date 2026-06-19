import { useEffect, useMemo, useState } from 'react';
import {
  formatMoney,
  resolveComboActivo,
  resolveComboImageCandidates,
  resolveComboNombre
} from '../utils/combosAdminUtils';

const CARDS_PER_PAGE = 10;

const CombosTable = ({
  loading,
  combos,
  togglingId,
  cardImageErrors,
  onCardImageError,
  onEditar,
  onCambiarEstado,
  canEdit = true,
  canToggleState = true
}) => {
  const [cardsPageIndex, setCardsPageIndex] = useState(0);

  const totalCards = Array.isArray(combos) ? combos.length : 0;
  const combosCardsPages = useMemo(() => {
    const rows = Array.isArray(combos) ? combos : [];
    const pages = [];
    for (let i = 0; i < rows.length; i += CARDS_PER_PAGE) pages.push(rows.slice(i, i + CARDS_PER_PAGE));
    return pages;
  }, [combos]);
  const totalCardsPages = Math.max(1, combosCardsPages.length || 0);
  const safeCardsPageIndex = Math.min(cardsPageIndex, totalCardsPages - 1);
  const combosCardsPage = combosCardsPages[safeCardsPageIndex] || [];

  useEffect(() => {
    setCardsPageIndex((prev) => Math.min(Math.max(0, prev), Math.max(0, totalCardsPages - 1)));
  }, [totalCardsPages]);

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
    <>
      <div className="inv-ins-carousel-shell">
        <div className="inv-ins-carousel-meta">
          <span>{`Pagina ${safeCardsPageIndex + 1} de ${totalCardsPages}`}</span>
          <span>{`${totalCards} combos visibles`}</span>
        </div>
        <div className="inv-prod-carousel-stage inv-ins-carousel-stage">
          <button
            type="button"
            className={`btn inv-prod-carousel-float is-prev ${safeCardsPageIndex > 0 ? 'is-visible' : ''}`}
            aria-label="Pagina anterior del carrusel de combos"
            onClick={() => setCardsPageIndex((prev) => Math.max(0, prev - 1))}
            disabled={safeCardsPageIndex <= 0}
          >
            <i className="bi bi-chevron-left" />
          </button>

          <div className="inv-ins-carousel-page menu-recetas-admin__carousel-page" key={`combos-cards-page-${safeCardsPageIndex}`}>
            {combosCardsPage.map((combo) => {
        const id = Number(combo?.id_combo || 0);
        const estadoActivo = resolveComboActivo(combo);
        const imageCandidates = resolveComboImageCandidates(combo);
        const imageAttempt = Math.max(0, Number(cardImageErrors?.[id] || 0));
        const imageUrl = imageCandidates[imageAttempt] || '';

        return (
          <article
            key={id}
            className={`menu-recetas-card menu-recetas-card--compact ${estadoActivo ? 'is-active' : 'is-inactive'}`}
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
                <div>
                  <small>Sucursales</small>
                  <strong>{Number(combo?.total_sucursales || 0)}</strong>
                </div>
              </div>
            </div>

            <footer className="menu-recetas-card__actions">
              <button
                type="button"
                // Replica el boton Editar de Inventarios > Categorias para mantener consistencia visual.
                className="inv-catpro-action edit inv-catpro-action-compact menu-recetas-admin__edit-action"
                onClick={() => onEditar(id)}
                disabled={!canEdit}
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
                disabled={!canToggleState || togglingId === id}
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
            aria-label="Pagina siguiente del carrusel de combos"
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

export default CombosTable;



