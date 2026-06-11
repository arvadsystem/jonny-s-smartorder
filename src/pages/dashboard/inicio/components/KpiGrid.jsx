import React from 'react';
import MetricCard from './MetricCard';

const KpiGrid = ({ metrics, links = {} }) => {
  const cards = [
    {
      id: 'kpi-pedidos',
      icon: 'bi-receipt',
      label: 'Pedidos en operación',
      value: metrics.totalPedidosOperacion,
      hint: `${metrics.pendientesPago} pendientes, ${metrics.enCocina} en cocina`,
      badge: metrics.totalPedidosOperacion > 0 ? 'En curso' : 'Sin cola',
      tone: 'neutral',
      to: links['kpi-pedidos'] || ''
    },
    {
      id: 'kpi-stock',
      icon: 'bi-exclamation-triangle',
      label: 'Riesgo de inventario',
      value: metrics.stockBajo + metrics.agotados,
      hint: `${metrics.agotados} agotados y ${metrics.stockBajo} en bajo stock`,
      badge: metrics.agotados > 0 ? 'Crítico' : 'Vigilancia',
      tone: metrics.agotados > 0 ? 'danger' : 'warning',
      progressSegments: [
        { id: 'agotados', value: metrics.agotados, tone: 'danger' },
        { id: 'stock-bajo', value: metrics.stockBajo, tone: 'warning' }
      ],
      to: links['kpi-stock'] || ''
    },
    {
      id: 'kpi-sucursales',
      icon: 'bi-shop',
      label: 'Sucursales activas',
      value: `${metrics.sucursalesActivas}/${metrics.totalSucursales}`,
      hint: 'Estado operativo por sede',
      badge: metrics.sucursalesActivas === metrics.totalSucursales ? 'Estables' : 'Parcial',
      tone: 'success',
      to: links['kpi-sucursales'] || ''
    },
    {
      id: 'kpi-catalogo',
      icon: 'bi-grid',
      label: 'Catálogo activo',
      value: metrics.catalogoActivo,
      hint: 'Ítems del catálogo listos para vender',
      badge: 'Disponible',
      tone: 'accent',
      to: links['kpi-catalogo'] || ''
    }
  ];

  return (
    <section className="inicio-kpi-grid" aria-label="Indicadores principales">
      {cards.map((card) => (
        <MetricCard key={card.id} {...card} />
      ))}
    </section>
  );
};

export default KpiGrid;
