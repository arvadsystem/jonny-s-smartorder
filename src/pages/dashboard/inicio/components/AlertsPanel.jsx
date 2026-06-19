import React from 'react';
import { Link } from 'react-router-dom';

const levelMeta = {
  critical: { icon: 'bi-exclamation-octagon-fill', className: 'is-critical', label: 'Crítico' },
  warning: { icon: 'bi-exclamation-triangle-fill', className: 'is-warning', label: 'Advertencia' },
  ok: { icon: 'bi-check-circle-fill', className: 'is-ok', label: 'Estable' },
  neutral: { icon: 'bi-info-circle-fill', className: 'is-neutral', label: 'Informativo' }
};

const AlertsPanel = ({ alerts = [] }) => (
  <section className="inicio-panel inicio-panel--alerts">
    <header className="inicio-panel__head">
      <h2>Alertas operativas</h2>
      <p>Riesgos del turno con prioridad de atención y seguimiento rápido.</p>
    </header>

    <div className="inicio-alerts-list">
      {alerts.map((alert) => {
        const meta = levelMeta[alert.level] || levelMeta.warning;
        const canOpenDetail = Boolean(alert.detailTo);
        return (
          <article key={alert.id} className={`inicio-alert-item ${meta.className}`}>
            <div className="inicio-alert-item__top">
              <div className="inicio-alert-item__badge">
                <i className={`bi ${meta.icon}`} aria-hidden="true" />
                <span>{meta.label}</span>
              </div>
              {canOpenDetail ? (
                <Link
                  to={alert.detailTo}
                  className="inicio-alert-item__action"
                  title={alert.detailTitle || 'Ir al detalle relacionado'}
                >
                  Ver detalle
                </Link>
              ) : (
                <button
                  type="button"
                  className="inicio-alert-item__action"
                  disabled
                  aria-disabled="true"
                  title="Sin vista de detalle disponible para esta alerta"
                >
                  Ver detalle
                </button>
              )}
            </div>
            <strong className="inicio-alert-item__summary">{alert.text}</strong>
            {alert.recommendation ? (
              <small className="inicio-alert-item__recommendation">{alert.recommendation}</small>
            ) : null}
          </article>
        );
      })}
    </div>
  </section>
);

export default AlertsPanel;
