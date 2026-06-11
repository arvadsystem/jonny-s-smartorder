import React from 'react';

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
          <p>Seguimiento rápido de ventas del periodo seleccionado.</p>
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
          <span className="inicio-sales-panel__eyebrow">Ventas totales</span>
          <strong>{financial.loading ? 'Cargando...' : `L ${money(financial.totalVendido)}`}</strong>
          <p>{financial.rangeLabel}</p>
        </div>

        <div className="inicio-sales-panel__hero-meta">
          <span>{financial.summaryLabel}</span>
          <small>Última sincronización operativa del dashboard.</small>
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
        <div className="inicio-chart-note" role="status" aria-live="polite">
          Aún no hay un resumen financiero consolidado para este rango. Verifica si existen ventas cerradas en el periodo.
        </div>
      ) : null}

      <div className="inicio-sales-panel__stats">
        <article className="inicio-sales-stat">
          <span>Cantidad de ventas</span>
          <strong>{financial.loading ? '--' : financial.ventas}</strong>
          <small>Transacciones registradas en el periodo.</small>
        </article>

        <article className="inicio-sales-stat">
          <span>Ticket promedio</span>
          <strong>{financial.loading ? '--' : `L ${money(financial.ticketPromedio)}`}</strong>
          <small>Valor promedio por venta cerrada.</small>
        </article>

        <article className="inicio-sales-stat">
          <span>Completadas</span>
          <strong>{financial.loading ? '--' : financial.completadas}</strong>
          <small>
            {financial.loading ? 'Actualizando resumen del periodo.' : `${financial.pendientes} pendientes dentro del mismo rango.`}
          </small>
        </article>
      </div>
    </section>
  );
};

export default SalesSummaryPanel;
