import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import EmptyState from './EmptyState';

const InventoryRiskChart = ({ data = [] }) => {
  const total = data.reduce((acc, item) => acc + (Number(item?.value) || 0), 0);
  const hasData = total > 0;

  return (
    <section className="inicio-panel inicio-panel--chart">
      <header className="inicio-panel__head">
        <h2>Riesgo de inventario</h2>
        <p>Distribución entre ítems agotados y con stock bajo.</p>
      </header>

      <div className={`inicio-chart-card inicio-chart-card--donut ${!hasData ? 'is-empty' : ''}`}>
        {hasData ? (
          <>
            <div className="inicio-chart-card__viz">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={3}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="inicio-chart-card__center">
                <span>Total</span>
                <strong>{total}</strong>
              </div>
            </div>

            <div className="inicio-chart-card__legend">
              {data.map((entry) => (
                <div key={entry.id} className="inicio-chart-card__legend-item">
                  <span className="inicio-chart-card__legend-dot" style={{ backgroundColor: entry.color }} />
                  <div>
                    <strong>{entry.name}</strong>
                    <p>{entry.value} registros</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            icon="bi-shield-check"
            title="Inventario estable"
            description="No hay quiebres críticos ni señales activas de riesgo en esta vista."
          />
        )}
      </div>
    </section>
  );
};

export default InventoryRiskChart;
