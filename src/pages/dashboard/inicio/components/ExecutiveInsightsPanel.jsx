import React from 'react';

const money = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const ExecutiveInsightsPanel = ({
  insights = [],
  branchRanking = [],
  healthSemaphores = [],
  visible = false,
  financial,
  metrics
}) => {
  if (!visible) return null;

  return (
    <section className="inicio-panel inicio-executive-panel">
      <header className="inicio-panel__head inicio-executive-panel__head">
        <div>
          <h2>Vista ejecutiva</h2>
          <p>Lectura rápida de salud operativa, tendencia comercial y cumplimiento del turno.</p>
        </div>
        <div className="inicio-executive-panel__summary">
          <span>Ventas del rango</span>
          <strong>{financial.loading ? 'Cargando...' : `L ${money(financial.totalVendido)}`}</strong>
          <small>{financial.summaryLabel || 'Resumen consolidado actual'}</small>
        </div>
      </header>

      <div className="inicio-executive-grid">
        {insights.map((insight) => (
          <article key={insight.id} className={`inicio-executive-card is-${insight.tone || 'neutral'}`}>
            <span>{insight.title}</span>
            <strong>{insight.value}</strong>
            <p>{insight.description}</p>
          </article>
        ))}

        <article className="inicio-executive-card is-neutral">
          <span>Resumen del turno</span>
          <strong>{metrics.totalPedidosOperacion} pedidos</strong>
          <p>{metrics.listosEntrega} listos, {metrics.enCocina} en cocina y {metrics.pendientesPago} pendientes.</p>
        </article>
      </div>

      <div className="inicio-executive-lower">
        <section className="inicio-executive-subpanel">
          <header className="inicio-executive-subpanel__head">
            <h3>Semáforos operativos</h3>
            <p>Resumen ejecutivo por frente crítico del dashboard.</p>
          </header>

          <div className="inicio-semaphore-list">
            {healthSemaphores.map((item) => (
              <article key={item.id} className={`inicio-semaphore-card is-${item.state}`}>
                <span className="inicio-semaphore-card__dot" aria-hidden="true" />
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="inicio-executive-subpanel">
          <header className="inicio-executive-subpanel__head">
            <h3>Rendimiento por sucursal</h3>
            <p>Identifica rápidamente las sedes con mayor presión operativa visible.</p>
          </header>

          <div className="inicio-branch-ranking">
            {branchRanking.length ? (
              branchRanking.map((branch, index) => (
                <article key={branch.id} className={`inicio-branch-card is-${branch.tone}`}>
                  <span className="inicio-branch-card__index">#{index + 1}</span>
                  <div className="inicio-branch-card__content">
                    <strong>{branch.label}</strong>
                    <p>{branch.pedidos} pedidos visibles · {branch.status}</p>
                  </div>
                  <span className="inicio-branch-card__score">{branch.score}</span>
                </article>
              ))
            ) : (
              <div className="inicio-chart-note">Aún no hay suficientes datos por sucursal para construir el ranking.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
};

export default ExecutiveInsightsPanel;
