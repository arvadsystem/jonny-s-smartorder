import React from 'react';
import OperationStatusCard from './OperationStatusCard';

const OperationsSnapshot = ({ metrics }) => {
  const items = [
    {
      id: 'pendientes',
      title: 'Pendientes por pagar',
      value: metrics.pendientesPago,
      icon: 'bi-wallet2',
      tone: 'warning'
    },
    {
      id: 'cocina',
      title: 'En cocina',
      value: metrics.enCocina,
      icon: 'bi-fire',
      tone: 'cooking'
    },
    {
      id: 'listos',
      title: 'Listos para entrega',
      value: metrics.listosEntrega,
      icon: 'bi-check2-circle',
      tone: 'success'
    },
    {
      id: 'agotados',
      title: 'Sin stock',
      value: metrics.agotados,
      icon: 'bi-exclamation-diamond',
      tone: 'danger'
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
