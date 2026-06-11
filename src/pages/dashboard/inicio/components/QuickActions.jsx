import React from 'react';
import { Link } from 'react-router-dom';

const buildScopedLink = (path, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}${path.includes('?') ? '&' : '?'}${query}` : path;
};

const QuickActions = ({
  can,
  permissions,
  sucursalFilter = 'all',
  turnFilter = 'all',
  selectedDate = ''
}) => {
  const actions = [
    {
      id: 'ventas',
      to: buildScopedLink('/dashboard/ventas?tab=pedidos', {
        id_sucursal: sucursalFilter,
        turno: turnFilter,
        fecha: selectedDate
      }),
      icon: 'bi-receipt',
      label: 'Gestionar pedidos',
      description: 'Mover pedidos de pendientes a cocina y entrega.',
      enabled: can(permissions.VENTAS_VER)
    },
    {
      id: 'cocina',
      to: buildScopedLink('/dashboard/cocina', {
        id_sucursal: sucursalFilter,
        turno: turnFilter
      }),
      icon: 'bi-fire',
      label: 'Tablero cocina',
      description: 'Visualizar y priorizar órdenes de preparación.',
      enabled: can(permissions.COCINA_VER)
    },
    {
      id: 'inventario',
      to: buildScopedLink('/dashboard/inventario?tab=alertas', {
        id_sucursal: sucursalFilter
      }),
      icon: 'bi-box-seam',
      label: 'Revisar inventario',
      description: 'Atender stock bajo y agotados antes de hora pico.',
      enabled: can(permissions.INVENTARIO_VER)
    },
    {
      id: 'menu',
      to: buildScopedLink('/dashboard/menu?tab=publicacion', {
        id_sucursal: sucursalFilter
      }),
      icon: 'bi-journal-richtext',
      label: 'Publicar menú',
      description: 'Actualizar visibilidad y orden para menú cliente.',
      enabled: can(permissions.MENU_VER)
    }
  ];

  return (
    <section className="inicio-panel">
      <header className="inicio-panel__head">
        <h2>Acciones rápidas</h2>
        <p>Atajos operativos con el contexto actual del dashboard.</p>
      </header>

      <div className="inicio-actions-grid">
        {actions
          .filter((action) => action.enabled)
          .map((action) => (
            <Link key={action.id} to={action.to} className="inicio-action-card">
              <div className="inicio-action-card__icon" aria-hidden="true">
                <i className={`bi ${action.icon}`} />
              </div>
              <div className="inicio-action-card__content">
                <h3>{action.label}</h3>
                <p>{action.description}</p>
              </div>
              <span className="inicio-action-card__arrow" aria-hidden="true">
                <i className="bi bi-arrow-right" />
              </span>
            </Link>
          ))}
      </div>
    </section>
  );
};

export default QuickActions;
