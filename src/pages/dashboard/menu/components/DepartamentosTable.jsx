import { useMemo, useState } from 'react';
import DepartamentosEmptyState from './DepartamentosEmptyState';
import {
  resolveDepartamentoActivo,
  truncateText
} from '../utils/departamentosAdminUtils';

const CARDS_PER_PAGE = 10;

const getDepartamentoId = (departamento) => Number(departamento?.id_tipo_departamento || 0);

const DepartamentoActions = ({
  departamento,
  togglingId,
  canEdit,
  canToggleState,
  onEditar,
  onCambiarEstado
}) => {
  const id = getDepartamentoId(departamento);
  const estadoActivo = resolveDepartamentoActivo(departamento);

  return (
    <>
      <button
        type="button"
        className="inv-catpro-action edit inv-catpro-action-compact menu-recetas-admin__edit-action"
        onClick={() => onEditar(id)}
        title="Editar"
        disabled={!canEdit}
      >
        <i className="bi bi-pencil-square" aria-hidden="true" />
        <span className="inv-catpro-action-label">Editar</span>
      </button>
      <button
        type="button"
        className={`inv-catpro-action ${estadoActivo ? 'state-off' : 'state-on'} inv-catpro-action-compact menu-recetas-admin__state-action`}
        onClick={() => onCambiarEstado(departamento)}
        disabled={togglingId === id || !canToggleState}
        title={estadoActivo ? 'Inactivar' : 'Activar'}
      >
        <i className={`bi ${estadoActivo ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
        <span className="inv-catpro-action-label">
          {togglingId === id ? 'Procesando' : estadoActivo ? 'Inactivar' : 'Activar'}
        </span>
      </button>
    </>
  );
};

const DepartamentosTable = ({
  loading,
  departamentos,
  showInactiveOnly = false,
  viewMode,
  togglingId,
  canEdit = true,
  canToggleState = true,
  onEditar,
  onCambiarEstado
}) => {
  const [cardsPageIndex, setCardsPageIndex] = useState(0);
  const totalCards = Array.isArray(departamentos) ? departamentos.length : 0;
  const departamentosCardsPages = useMemo(() => {
    const rows = Array.isArray(departamentos) ? departamentos : [];
    const pages = [];
    for (let i = 0; i < rows.length; i += CARDS_PER_PAGE) pages.push(rows.slice(i, i + CARDS_PER_PAGE));
    return pages;
  }, [departamentos]);
  const totalCardsPages = Math.max(1, departamentosCardsPages.length || 0);
  const safeCardsPageIndex = Math.min(cardsPageIndex, totalCardsPages - 1);
  const departamentosCardsPage = departamentosCardsPages[safeCardsPageIndex] || [];

  if (loading) {
    return <div className="text-center py-4">Cargando departamentos...</div>;
  }

  if (!Array.isArray(departamentos) || departamentos.length === 0) {
    return (
      <DepartamentosEmptyState
        message={showInactiveOnly ? 'No hay departamentos inactivos para mostrar.' : 'No hay departamentos para mostrar.'}
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
              <th>Codigo</th>
              <th>Descripcion</th>
              <th>Orden</th>
              <th>Estado</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {departamentos.map((departamento) => {
              const id = getDepartamentoId(departamento);
              const estadoActivo = resolveDepartamentoActivo(departamento);
              return (
                <tr key={id}>
                  <td>#{id}</td>
                  <td>{String(departamento?.nombre_departamento || '')}</td>
                  <td>{String(departamento?.codigo_departamento || '-')}</td>
                  <td>{String(departamento?.descripcion || '-')}</td>
                  <td>{Number(departamento?.orden_menu || 0) || '-'}</td>
                  <td>
                    <span className={`menu-recetas-admin__estado-badge ${estadoActivo ? 'is-active' : 'is-inactive'}`}>
                      {estadoActivo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="menu-recetas-admin__row-actions">
                      <DepartamentoActions
                        departamento={departamento}
                        togglingId={togglingId}
                        canEdit={canEdit}
                        canToggleState={canToggleState}
                        onEditar={onEditar}
                        onCambiarEstado={onCambiarEstado}
                      />
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
    <div className="inv-ins-carousel-shell">
      <div className="inv-ins-carousel-meta">
        <span>{`Pagina ${safeCardsPageIndex + 1} de ${totalCardsPages}`}</span>
        <span>{`${totalCards} departamentos visibles`}</span>
      </div>
      <div className="inv-prod-carousel-stage inv-ins-carousel-stage">
        <button
          type="button"
          className={`btn inv-prod-carousel-float is-prev ${safeCardsPageIndex > 0 ? 'is-visible' : ''}`}
          aria-label="Pagina anterior del carrusel de departamentos"
          onClick={() => setCardsPageIndex((prev) => Math.max(0, prev - 1))}
          disabled={safeCardsPageIndex <= 0}
        >
          <i className="bi bi-chevron-left" />
        </button>

        <div className="inv-ins-carousel-page menu-recetas-admin__carousel-page" key={`departamentos-cards-page-${safeCardsPageIndex}`}>
          {departamentosCardsPage.map((departamento) => {
            const id = getDepartamentoId(departamento);
            const estadoActivo = resolveDepartamentoActivo(departamento);
            const descripcion = truncateText(
              String(departamento?.descripcion || '').trim() || 'Sin descripcion registrada.',
              104
            );
            const orden = Number(departamento?.orden_menu || 0);

            return (
              <article
                key={id}
                className={`menu-recetas-card menu-recetas-card--compact ${estadoActivo ? 'is-active' : 'is-inactive'}`}
              >
                <header className="menu-recetas-card__media">
                  <div className="menu-recetas-card__placeholder">
                    <i className="bi bi-diagram-3" />
                    <span>Departamento</span>
                  </div>
                  <div className="menu-recetas-card__media-top">
                    <span className={`menu-recetas-admin__estado-badge ${estadoActivo ? 'is-active' : 'is-inactive'}`}>
                      {estadoActivo ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="menu-recetas-card__price-pill">{`Orden ${orden || '-'}`}</span>
                  </div>
                </header>

                <div className="menu-recetas-card__body">
                  <div className="menu-recetas-card__title-row">
                    <h6>{String(departamento?.nombre_departamento || 'Departamento sin nombre')}</h6>
                    <span className="menu-recetas-card__id">#{id}</span>
                  </div>

                  <p className="menu-recetas-card__description">{descripcion}</p>

                  <div className="menu-recetas-card__meta">
                    <div>
                      <small>Codigo</small>
                      <strong>{String(departamento?.codigo_departamento || '-')}</strong>
                    </div>
                    <div>
                      <small>Orden</small>
                      <strong>{orden || '-'}</strong>
                    </div>
                    <div>
                      <small>Estado</small>
                      <strong>{estadoActivo ? 'Activo' : 'Inactivo'}</strong>
                    </div>
                  </div>
                </div>

                <footer className="menu-recetas-card__actions">
                  <DepartamentoActions
                    departamento={departamento}
                    togglingId={togglingId}
                    canEdit={canEdit}
                    canToggleState={canToggleState}
                    onEditar={onEditar}
                    onCambiarEstado={onCambiarEstado}
                  />
                </footer>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className={`btn inv-prod-carousel-float is-next ${safeCardsPageIndex < totalCardsPages - 1 ? 'is-visible' : ''}`}
          aria-label="Pagina siguiente del carrusel de departamentos"
          onClick={() => setCardsPageIndex((prev) => Math.min(totalCardsPages - 1, prev + 1))}
          disabled={safeCardsPageIndex >= totalCardsPages - 1}
        >
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
};

export default DepartamentosTable;
