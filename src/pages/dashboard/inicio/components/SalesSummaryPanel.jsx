import React from 'react';
import EmptyState from './EmptyState';

const money = (value) =>
  Number(value || 0).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const RANGE_OPTIONS = [
  { key: 'day', label: 'Día' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' }
];

const SalesSummaryPanel = ({
  financial,
  selectedRange = 'day',
  onRangeChange
}) => {
  if (!financial?.visible) {
    return (
      <section className="inicio-panel inicio-sales-panel">
        <header className="inicio-panel__head">
          <h2>Resumen financiero</h2>
          <p>Disponible para roles con acceso al módulo de ventas.</p>
        </header>

        <div className="inicio-sales-panel__empty">
          <i className="bi bi-cash-coin" aria-hidden="true" />
          <p>No tienes permisos visibles para consultar las ventas del dashboard.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="inicio-panel inicio-sales-panel">
      <header className="inicio-panel__head inicio-sales-panel__head">
        <div>
          <h2>Resumen financiero</h2>
          <p>Lectura ejecutiva del rendimiento comercial para el rango seleccionado.</p>
        </div>

        <div className="inicio-sales-panel__range" role="tablist" aria-label="Rango financiero">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`inicio-sales-panel__range-btn ${selectedRange === option.key ? 'is-active' : ''}`}
              onClick={() => onRangeChange?.(option.key)}
              aria-pressed={selectedRange === option.key}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="inicio-sales-panel__hero">
        <div className="inicio-sales-panel__hero-copy">
          <span className="inicio-sales-panel__eyebrow">Ventas del rango</span>
          <strong>{financial.loading ? 'Cargando...' : `L ${money(financial.totalVendido)}`}</strong>
          <p>{financial.rangeLabel}</p>
        </div>

        <div className="inicio-sales-panel__hero-meta">
          <span>{financial.summaryLabel}</span>
          <small>
            {financial.hasSummary
              ? 'Resumen consolidado para lectura rápida.'
              : 'Sin consolidado financiero disponible todavía.'}
          </small>
        </div>
      </div>

      <div className="inicio-sales-panel__comparison">
        <article className={`inicio-comparison-card is-${financial.deltaDirection || 'flat'}`}>
          <span>Comparativo</span>
          <strong>
            {financial.loading
              ? '...'
              : `${financial.deltaDirection === 'up' ? '+' : ''}${financial.deltaPercent.toFixed(1)}%`}
          </strong>
          <small>
            {financial.comparisonLabel
              ? `Contra ${financial.comparisonLabel}`
              : 'Sin comparativo consolidado'}
          </small>
        </article>

        <article className="inicio-comparison-card">
          <span>Periodo previo</span>
          <strong>{financial.loading ? '...' : `L ${money(financial.comparisonTotal)}`}</strong>
          <small>Base usada para el contraste actual.</small>
        </article>
      </div>

      {financial.error ? (
        <div className="inicio-chart-note" role="status" aria-live="polite">
          {financial.error} Se conserva el resto del dashboard operativo.
        </div>
      ) : null}

      {!financial.loading && !financial.error && !financial.hasSummary ? (
        <div className="inicio-sales-panel__empty-state">
          <EmptyState
            icon="bi-graph-down-arrow"
            title="Sin ventas registradas en este rango"
            description="Cuando existan ventas cerradas, aquí verás el total, el comparativo y el ticket promedio."
            compact
          />
        </div>
      ) : null}

      <div className="inicio-sales-panel__stats">
        <article className="inicio-sales-stat">
          <span>Cantidad de ventas</span>
          <strong>{financial.loading ? '--' : financial.ventas}</strong>
          <small>
            {financial.loading
              ? 'Actualizando transacciones del periodo.'
              : financial.ventas > 0
                ? 'Transacciones cerradas registradas en el periodo.'
                : 'Sin ventas registradas en este rango.'}
          </small>
        </article>

        <article className="inicio-sales-stat">
          <span>Ticket promedio</span>
          <strong>{financial.loading ? '--' : `L ${money(financial.ticketPromedio)}`}</strong>
          <small>
            {financial.loading
              ? 'Calculando promedio por venta.'
              : financial.ticketPromedio > 0
                ? 'Valor promedio por venta cerrada.'
                : 'Aún no hay base suficiente para calcular ticket promedio.'}
          </small>
        </article>

        <article className="inicio-sales-stat">
          <span>Completadas</span>
          <strong>{financial.loading ? '--' : financial.completadas}</strong>
          <small>
            {financial.loading
              ? 'Actualizando resumen del periodo.'
              : financial.completadas > 0
                ? `${financial.pendientes} pendientes dentro del mismo rango.`
                : 'Sin ventas completadas detectadas en este rango.'}
          </small>
        </article>
      </div>
    </section>
  );
};

export default SalesSummaryPanel;
