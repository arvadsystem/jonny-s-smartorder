import React from 'react';

const KpiCard = ({ icon, label, value, hint }) => (
  <article className="inicio-kpi-card">
    <div className="inicio-kpi-card__icon" aria-hidden="true">
      <i className={`bi ${icon}`} />
    </div>
    <div className="inicio-kpi-card__content">
      <p className="inicio-kpi-card__label">{label}</p>
      <h3 className="inicio-kpi-card__value">{value}</h3>
      <p className="inicio-kpi-card__hint">{hint}</p>
    </div>
  </article>
);

const KpiGrid = ({ metrics }) => {
  const cards = [
    {
      id: 'kpi-pedidos',
      icon: 'bi-receipt',
      label: 'Pedidos en operacion',
      value: metrics.totalPedidosOperacion,
      hint: `${metrics.pendientesPago} pendientes, ${metrics.enCocina} en cocina`
    },
    {
      id: 'kpi-stock',
      icon: 'bi-exclamation-triangle',
      label: 'Riesgo de inventario',
      value: metrics.stockBajo + metrics.agotados,
      hint: `${metrics.agotados} agotados y ${metrics.stockBajo} en bajo stock`
    },
    {
      id: 'kpi-sucursales',
      icon: 'bi-shop',
      label: 'Sucursales activas',
      value: `${metrics.sucursalesActivas}/${metrics.totalSucursales}`,
      hint: 'Estado operativo por sede'
    },
    {
      id: 'kpi-catalogo',
      icon: 'bi-grid',
      label: 'Catalogo activo',
      value: metrics.catalogoActivo,
      hint: 'Productos e insumos listos para vender'
    }
  ];

  return (
    <section className="inicio-kpi-grid" aria-label="Indicadores principales">
      {cards.map((card) => (
        <KpiCard key={card.id} {...card} />
      ))}
    </section>
  );
};

export default KpiGrid;

