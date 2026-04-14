import React from 'react';

const levelMeta = {
  critical: { icon: 'bi-exclamation-octagon-fill', className: 'is-critical', label: 'Critico' },
  warning: { icon: 'bi-exclamation-triangle-fill', className: 'is-warning', label: 'Advertencia' },
  ok: { icon: 'bi-check-circle-fill', className: 'is-ok', label: 'Estable' }
};

const AlertsPanel = ({ alerts = [] }) => (
  <section className="inicio-panel">
    <header className="inicio-panel__head">
      <h2>Alertas operativas</h2>
      <p>Riesgos detectados para el turno actual.</p>
    </header>

    <div className="inicio-alerts-list">
      {alerts.map((alert) => {
        const meta = levelMeta[alert.level] || levelMeta.warning;
        return (
          <article key={alert.id} className={`inicio-alert-item ${meta.className}`}>
            <div className="inicio-alert-item__badge">
              <i className={`bi ${meta.icon}`} aria-hidden="true" />
              <span>{meta.label}</span>
            </div>
            <p>{alert.text}</p>
          </article>
        );
      })}
    </div>
  </section>
);

export default AlertsPanel;

