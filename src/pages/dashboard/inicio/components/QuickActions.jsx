import React from 'react';
import { Link } from 'react-router-dom';

const QuickActions = ({ can, permissions }) => {
  const actions = [
    {
      id: 'ventas',
      to: '/dashboard/ventas?tab=pedidos',
      icon: 'bi-receipt',
      label: 'Gestionar pedidos',
      description: 'Mover pedidos de pendientes a cocina y entrega.',
      enabled: can(permissions.VENTAS_VER)
    },
    {
      id: 'cocina',
      to: '/dashboard/cocina',
      icon: 'bi-fire',
      label: 'Tablero cocina',
      description: 'Visualizar y priorizar ordenes de preparacion.',
      enabled: can(permissions.COCINA_VER)
    },
    {
      id: 'inventario',
      to: '/dashboard/inventario?tab=alertas',
      icon: 'bi-box-seam',
      label: 'Revisar inventario',
      description: 'Atender stock bajo y agotados antes de hora pico.',
      enabled: can(permissions.INVENTARIO_VER)
    },
    {
      id: 'menu',
      to: '/dashboard/menu?tab=publicacion',
      icon: 'bi-journal-richtext',
      label: 'Publicar menu',
      description: 'Actualizar visibilidad y orden para menu cliente.',
      enabled: can(permissions.MENU_VER)
    }
  ];

  return (
    <section className="inicio-panel">
      <header className="inicio-panel__head">
        <h2>Acciones rapidas</h2>
        <p>Atajos operativos para decisiones de turno.</p>
      </header>

      <div className="inicio-actions-grid">
        {actions
          .filter((action) => action.enabled)
          .map((action) => (
            <Link key={action.id} to={action.to} className="inicio-action-card">
              <i className={`bi ${action.icon}`} aria-hidden="true" />
              <div>
                <h3>{action.label}</h3>
                <p>{action.description}</p>
              </div>
            </Link>
          ))}
      </div>
    </section>
  );
};

export default QuickActions;

