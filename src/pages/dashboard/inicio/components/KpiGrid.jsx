import React from 'react';
import MetricCard from './MetricCard';

const KpiGrid = ({ metrics, links = {} }) => {
  const criticalCards = [
    {
      id: 'kpi-pedidos',
      icon: 'bi-receipt',
      eyebrow: 'Prioridad operativa',
      label: 'Pedidos activos',
      value: metrics.totalPedidosOperacion,
      hint: `${metrics.pendientesPago} pendientes por pago`,
      emptyMessage: 'No hay pedidos activos por el momento.',
      badge: metrics.totalPedidosOperacion > 0 ? 'En curso' : 'Sin cola',
      tone: metrics.totalPedidosOperacion > 0 ? 'neutral' : 'success',
      size: 'critical',
      to: links['kpi-pedidos'] || ''
    },
    {
      id: 'kpi-cocina',
      icon: 'bi-fire',
      eyebrow: 'Producción',
      label: 'En cocina',
      value: metrics.enCocina,
      hint: 'Pedidos en preparación o en espera de despacho.',
      emptyMessage: 'No hay pedidos en cocina en este momento.',
      badge: metrics.enCocina > 0 ? 'Atender' : 'Estable',
      tone: metrics.enCocina > 0 ? 'warning' : 'success',
      size: 'critical'
    },
    {
      id: 'kpi-listos',
      icon: 'bi-check2-circle',
      eyebrow: 'Entrega',
      label: 'Listos para entrega',
      value: metrics.listosEntrega,
      hint: 'Pedidos listos para entregar o despachar.',
      emptyMessage: 'Aún no hay pedidos listos para entrega.',
      badge: metrics.listosEntrega > 0 ? 'Mover' : 'Sin espera',
      tone: metrics.listosEntrega > 0 ? 'accent' : 'success',
      size: 'critical'
    },
    {
      id: 'kpi-stock',
      icon: 'bi-exclamation-triangle',
      eyebrow: 'Inventario',
      label: 'Sin stock',
      value: metrics.agotados,
      hint: `${metrics.stockBajo} ítems siguen en observación por bajo stock`,
      emptyMessage: 'Inventario sin quiebres críticos.',
      badge: metrics.agotados > 0 ? 'Crítico' : 'Estable',
      tone: metrics.agotados > 0 ? 'danger' : 'success',
      size: 'critical',
      progressSegments: [
        { id: 'agotados', value: metrics.agotados, tone: 'danger' },
        { id: 'stock-bajo', value: metrics.stockBajo, tone: 'warning' }
      ],
      to: links['kpi-stock'] || ''
    }
  ];

  const supportCards = [
    {
      id: 'kpi-sucursales',
      icon: 'bi-shop',
      eyebrow: 'Cobertura',
      label: 'Sucursales operativas',
      value: `${metrics.sucursalesActivas}/${metrics.totalSucursales}`,
      hint: 'Estado operativo consolidado por sede.',
      badge: metrics.sucursalesActivas === metrics.totalSucursales ? 'Estables' : 'Parcial',
      tone: 'success',
      size: 'support',
      to: links['kpi-sucursales'] || ''
    },
    {
      id: 'kpi-bajo-stock',
      icon: 'bi-box-seam',
      eyebrow: 'Seguimiento',
      label: 'Bajo stock',
      value: metrics.stockBajo,
      hint: 'Ítems que requieren seguimiento antes del próximo pico.',
      emptyMessage: 'No hay alertas de bajo stock activas.',
      badge: metrics.stockBajo > 0 ? 'Vigilar' : 'Estable',
      tone: metrics.stockBajo > 0 ? 'warning' : 'success',
      size: 'support'
    },
    {
      id: 'kpi-catalogo',
      icon: 'bi-grid',
      eyebrow: 'Catálogo',
      label: 'Catálogo activo',
      value: metrics.catalogoActivo,
      hint: 'Ítems listos para vender y visibles para operación.',
      badge: 'Disponible',
      tone: 'accent',
      size: 'support',
      to: links['kpi-catalogo'] || ''
    }
  ];

  return (
    <section className="inicio-kpi-section" aria-label="Indicadores principales">
      <div className="inicio-kpi-section__head">
        <div>
          <h2>Indicadores principales</h2>
          <p>Primero lo crítico para operar; luego el contexto de apoyo.</p>
        </div>
      </div>

      <div className="inicio-kpi-grid inicio-kpi-grid--critical">
        {criticalCards.map((card) => (
          <MetricCard key={card.id} {...card} />
        ))}
      </div>

      <div className="inicio-kpi-grid inicio-kpi-grid--support">
        {supportCards.map((card) => (
          <MetricCard key={card.id} {...card} />
        ))}
      </div>
    </section>
  );
};

export default KpiGrid;
