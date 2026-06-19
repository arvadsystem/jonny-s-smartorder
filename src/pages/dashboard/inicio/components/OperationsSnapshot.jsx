import React from 'react';
import OperationStatusCard from './OperationStatusCard';

const OperationsSnapshot = ({ metrics }) => {
  const items = [
    {
      id: 'pendientes',
      title: 'Pendientes por pagar',
      value: metrics.pendientesPago,
      icon: 'bi-wallet2',
      tone: metrics.pendientesPago > 0 ? 'warning' : 'success',
      statusLabel: metrics.pendientesPago > 0 ? 'Seguimiento' : 'Estable',
      description: metrics.pendientesPago > 0
        ? 'Conviene resolverlos antes de presionar cocina.'
        : 'No hay cola de pagos pendiente.'
    },
    {
      id: 'cocina',
      title: 'En cocina',
      value: metrics.enCocina,
      icon: 'bi-fire',
      tone: metrics.enCocina > 0 ? 'cooking' : 'success',
      statusLabel: metrics.enCocina > 0 ? 'Producción' : 'Estable',
      description: metrics.enCocina > 0
        ? 'Pedidos actualmente en preparación.'
        : 'No hay preparación activa en este momento.'
    },
    {
      id: 'listos',
      title: 'Listos para entrega',
      value: metrics.listosEntrega,
      icon: 'bi-check2-circle',
      tone: metrics.listosEntrega > 0 ? 'accent' : 'success',
      statusLabel: metrics.listosEntrega > 0 ? 'Entrega' : 'Sin espera',
      description: metrics.listosEntrega > 0
        ? 'Hay pedidos listos para despachar o entregar.'
        : 'No hay pedidos esperando entrega.'
    },
    {
      id: 'agotados',
      title: 'Sin stock',
      value: metrics.agotados,
      icon: 'bi-exclamation-diamond',
      tone: metrics.agotados > 0 ? 'danger' : 'success',
      statusLabel: metrics.agotados > 0 ? 'Crítico' : 'Controlado',
      description: metrics.agotados > 0
        ? 'Existen quiebres de inventario visibles.'
        : 'No hay quiebres críticos detectados.'
    }
  ];

  return (
    <section className="inicio-panel">
      <header className="inicio-panel__head">
        <h2>Estado de operación</h2>
        <p>Vista compacta para priorizar caja, cocina e inventario durante el turno.</p>
      </header>

      <div className="inicio-snapshot-grid">
        {items.map((item) => (
          <OperationStatusCard key={item.id} {...item} />
        ))}
      </div>
    </section>
  );
};

export default OperationsSnapshot;
