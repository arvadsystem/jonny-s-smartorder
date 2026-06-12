import React from 'react';
import { Link } from 'react-router-dom';
import EmptyState from './EmptyState';

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
      tag: 'Operación',
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
      tag: 'Producción',
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
      tag: 'Control',
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
      tag: 'Catálogo',
      enabled: can(permissions.MENU_VER)
    }
  ].filter((action) => action.enabled);

  return (
    <section className="inicio-panel inicio-panel--quick-actions">
      <header className="inicio-panel__head">
        <h2>Acciones rápidas</h2>
        <p>Atajos con contexto operativo para actuar sin salir del flujo del turno.</p>
      </header>

      <div className="inicio-actions-grid">
        {actions.length ? (
          actions.map((action) => (
            <Link
              key={action.id}
              to={action.to}
              className="inicio-action-card"
              aria-label={`${action.label}. ${action.description}`}
            >
              <div className="inicio-action-card__icon" aria-hidden="true">
                <i className={`bi ${action.icon}`} />
              </div>
              <div className="inicio-action-card__content">
                <div className="inicio-action-card__meta">
                  <span className="inicio-action-card__tag">{action.tag}</span>
                </div>
                <h3>{action.label}</h3>
                <p>{action.description}</p>
              </div>
              <span className="inicio-action-card__arrow" aria-hidden="true">
                <i className="bi bi-arrow-right" />
              </span>
            </Link>
          ))
        ) : (
          <EmptyState
            icon="bi-lightning-charge"
            title="Sin acciones disponibles"
            description="No hay accesos habilitados para tu perfil dentro de este panel."
          />
        )}
      </div>
    </section>
  );
};

export default QuickActions;
