import React from 'react';

const OperationsSnapshot = ({ metrics }) => (
  <section className="inicio-panel">
    <header className="inicio-panel__head">
      <h2>Estado de operacion</h2>
      <p>Vista rapida para priorizar caja, cocina e inventario.</p>
    </header>

    <div className="inicio-snapshot-grid">
      <article className="inicio-snapshot-card">
        <p>Pendientes por pagar</p>
        <strong>{metrics.pendientesPago}</strong>
      </article>
      <article className="inicio-snapshot-card">
        <p>En cocina</p>
        <strong>{metrics.enCocina}</strong>
      </article>
      <article className="inicio-snapshot-card">
        <p>Listos para entrega</p>
        <strong>{metrics.listosEntrega}</strong>
      </article>
      <article className="inicio-snapshot-card">
        <p>Sin stock</p>
        <strong>{metrics.agotados}</strong>
      </article>
    </div>
  </section>
);

export default OperationsSnapshot;

