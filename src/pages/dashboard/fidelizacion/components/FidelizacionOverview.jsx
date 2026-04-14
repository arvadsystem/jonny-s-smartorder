import { useState } from 'react';
import { formatFechaHora, formatPoints } from '../utils/fidelizacionHelpers';
import CollapsibleSearchInput from '../../../../components/common/CollapsibleSearchInput';
import ToolbarSucursalSelect from '../../../../components/common/ToolbarSucursalSelect';

const Pagination = ({ meta, loading, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil((meta?.total || 0) / (meta?.limit || 20)));
  const currentPage = meta?.page || 1;

  return (
    <div className="ventas-page__pagination">
      <span>
        Mostrando {meta?.total || 0} clientes
      </span>
      <div className="d-flex align-items-center gap-2">
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={loading || currentPage <= 1}
        >
          Anterior
        </button>
        <span className="small text-muted fw-semibold">
          Pagina {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={loading || currentPage >= totalPages}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
};

export default function FidelizacionOverview({
  panelData,
  clientes,
  clientesMeta,
  loadingPanel,
  loadingClientes,
  canConfigure,
  onOpenConfiguracion,
  onOpenDetalle,
  onOpenCanje,
  canViewClientes,
  canCanjear,
  canSelectSucursal,
  selectedSucursalId,
  sucursales,
  loadingSucursales,
  currentSearch,
  onSearch,
  onPageChange,
  onSucursalChange,
  onRefresh
}) {
  const [searchTerm, setSearchTerm] = useState(currentSearch || '');

  const isViewingAllSucursales = canSelectSucursal && !selectedSucursalId;
  const configuracionBadge = isViewingAllSucursales
    ? {
        text: 'Selecciona una sucursal',
        helper: 'La configuracion se consulta por sucursal.',
        className: 'bg-light border-secondary text-secondary'
      }
    : panelData?.configuracion_activa
    ? {
        text: 'Configuradas y vigentes',
        helper: `1 punto = L. ${formatPoints(panelData.configuracion_activa.lempiras_por_punto)}`,
        className: 'bg-success border-success text-white'
      }
    : {
        text: 'Pendientes de configurar',
        helper: 'Aun no hay reglas vigentes para esta sucursal.',
        className: 'bg-warning border-warning text-dark'
      };

  const handleSearch = (value) => {
    onSearch(String(value || '').trim());
  };

  const renderClienteContacto = (cliente) => {
    if (cliente.identificador) return cliente.identificador;
    if (cliente.nombre_usuario) return `@${cliente.nombre_usuario}`;
    return `Cliente #${cliente.id_cliente}`;
  };

  return (
    <div className="fidelizacion-page d-flex flex-column gap-3 h-100 min-h-0">
      <div className="inv-catpro-card inv-prod-card flex-grow-1 d-flex flex-column border-0 bg-transparent shadow-none" style={{ minHeight: 0 }}>
        <div className="inv-prod-header ventas-page__toolbar align-items-center bg-transparent px-0 pb-3" style={{ borderBottom: 'none' }}>
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-people-fill text-danger inv-prod-title-icon" style={{ background: 'rgba(220,53,69,0.1)' }} />
              <span className="inv-prod-title">Cartera de clientes</span>
            </div>
            <div className="inv-prod-subtitle">
              Saldo global de puntos y ultima actividad del programa de fidelizacion.
            </div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions fidelizacion-toolbar">
            <CollapsibleSearchInput
              value={searchTerm}
              onValueChange={setSearchTerm}
              onSubmit={handleSearch}
              placeholder="Buscar por nombre, correo, telefono o documento..."
              ariaLabel="Buscar clientes de fidelizacion"
            />

            {canSelectSucursal ? (
              <ToolbarSucursalSelect
                value={selectedSucursalId}
                onChange={onSucursalChange}
                options={sucursales}
                loading={loadingSucursales}
              />
            ) : null}

            <button
              type="button"
              className="inv-prod-toolbar-btn bg-white border"
              onClick={onRefresh}
              disabled={loadingPanel || loadingClientes}
              style={{ color: 'rgba(82, 44, 34, 0.86)' }}
            >
              <i className="bi bi-arrow-clockwise" />
              <span>Refrescar</span>
            </button>

            {canConfigure ? (
              <button
                type="button"
                className="inv-prod-toolbar-btn bg-white border"
                onClick={onOpenConfiguracion}
                style={{ color: 'rgba(82, 44, 34, 0.86)' }}
              >
                <i className="bi bi-gear" />
                <span>Configurar reglas</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="inv-prod-kpis ventas-page__stats mb-3" aria-label="Resumen de fidelizacion">
          <div className="inv-prod-kpi ventas-page__stat-card">
            <div className="ventas-page__stat-icon bg-opacity-10 text-primary border-0 shadow-none">
              <i className="bi bi-people" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Clientes con puntos</span>
              <strong>
                {loadingPanel ? <div className="spinner-border spinner-border-sm" /> : formatPoints(panelData?.resumen?.clientes_con_puntos || 0)}
              </strong>
            </div>
          </div>

          <div className="inv-prod-kpi ventas-page__stat-card is-warning">
            <div className="ventas-page__stat-icon text-warning border-0 bg-white">
              <i className="bi bi-star-fill" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Puntos disponibles de clientes</span>
              <strong>
                {loadingPanel ? <div className="spinner-border spinner-border-sm" /> : formatPoints(panelData?.resumen?.puntos_disponibles_totales || 0)}
              </strong>
              <small className="fidelizacion-kpi__helper">Saldo sumado del alcance visible.</small>
            </div>
          </div>

          <div className="inv-prod-kpi ventas-page__stat-card is-success">
            <div className="ventas-page__stat-icon text-success border-0 bg-white">
              <i className="bi bi-gift" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Canjes de hoy</span>
              <strong>
                {loadingPanel ? <div className="spinner-border spinner-border-sm" /> : formatPoints(panelData?.resumen?.canjes_hoy || 0)}
              </strong>
            </div>
          </div>

          <div className="inv-prod-kpi ventas-page__stat-card is-accent">
            <div className="ventas-page__stat-icon text-danger border-0 bg-white">
              <i className="bi bi-shield-check" />
            </div>
            <div className="inv-prod-kpi-content">
              <span>Reglas de fidelizacion</span>
              <div className="mt-1">
                <span className={`ventas-page__table-pill ${configuracionBadge.className}`}>
                  {configuracionBadge.text}
                </span>
              </div>
              <small className="fidelizacion-kpi__helper">{configuracionBadge.helper}</small>
            </div>
          </div>
        </div>

        <div className="ventas-page__table-card flex-grow-1 d-flex flex-column min-h-0 mt-2">
          <div className="ventas-page__table-wrap flex-grow-1 fidelizacion-table-desktop">
            <table className="table ventas-page__table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Ultima actividad</th>
                  <th className="text-center">Pts acumulados</th>
                  <th className="text-center">Pts canjeados</th>
                  <th className="text-center">Saldo disp.</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {!canViewClientes ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-shield-lock text-secondary" />
                        </div>
                        <span>No tiene permisos para ver la cartera de clientes.</span>
                      </div>
                    </td>
                  </tr>
                ) : loadingClientes ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="spinner-border text-danger" />
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                        <div className="ventas-create-modal__cart-empty-icon">
                          <i className="bi bi-inbox text-secondary" />
                        </div>
                        <span>No se encontraron clientes con el filtro aplicado.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  clientes.map((cli) => (
                    <tr key={cli.id_cliente} className="ventas-page__table-row" onClick={() => onOpenDetalle(cli)}>
                      <td>
                        <div className="ventas-page__table-sale fidelizacion-table__client">
                          <strong>{cli.nombre}</strong>
                          <span>{renderClienteContacto(cli)}</span>
                          {cli.correo ? <small>{cli.correo}</small> : null}
                        </div>
                      </td>
                      <td className="align-middle">
                        <div className="fidelizacion-table__activity">
                          <strong>{cli.nombre_sucursal_ultima_actividad || 'Sin actividad'}</strong>
                          <span>{formatFechaHora(cli.fecha_ultima_actividad)}</span>
                        </div>
                      </td>
                      <td className="text-center align-middle">
                        <span className="ventas-page__table-pill bg-white">{formatPoints(cli.puntos_acumulados_total)}</span>
                      </td>
                      <td className="text-center align-middle">
                        <span className="ventas-page__table-pill bg-white text-danger">{formatPoints(cli.puntos_canjeados_total)}</span>
                      </td>
                      <td className="text-center align-middle">
                        <span className={`ventas-page__table-pill ${cli.puntos_disponibles > 0 ? 'border-success text-success bg-white' : 'bg-light text-muted'}`}>
                          {formatPoints(cli.puntos_disponibles)} pts
                        </span>
                      </td>
                      <td className="text-end align-middle">
                        <div className="d-inline-flex gap-2" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="ventas-page__table-detail-btn"
                            title="Ver detalle"
                            onClick={() => onOpenDetalle(cli)}
                          >
                            <i className="bi bi-eye" />
                          </button>
                          {canCanjear ? (
                            <button
                              type="button"
                              className="ventas-page__table-detail-btn bg-white border-danger text-danger"
                              title="Canjear"
                              onClick={() => onOpenCanje(cli)}
                              disabled={cli.puntos_disponibles <= 0}
                            >
                              <i className="bi bi-gift-fill" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="fidelizacion-mobile-list">
            {!canViewClientes ? (
              <div className="text-center py-4">
                <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                  <div className="ventas-create-modal__cart-empty-icon">
                    <i className="bi bi-shield-lock text-secondary" />
                  </div>
                  <span>No tiene permisos para ver la cartera de clientes.</span>
                </div>
              </div>
            ) : loadingClientes ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" />
              </div>
            ) : clientes.length === 0 ? (
              <div className="text-center py-4">
                <div className="ventas-create-modal__empty shadow-none border-0 bg-transparent">
                  <div className="ventas-create-modal__cart-empty-icon">
                    <i className="bi bi-inbox text-secondary" />
                  </div>
                  <span>No se encontraron clientes con el filtro aplicado.</span>
                </div>
              </div>
            ) : (
              clientes.map((cli) => (
                <article key={cli.id_cliente} className="fidelizacion-mobile-card">
                  <div className="fidelizacion-mobile-card__head">
                    <div>
                      <strong>{cli.nombre}</strong>
                      <small>{renderClienteContacto(cli)}</small>
                    </div>
                    <span
                      className={`ventas-page__table-pill ${
                        cli.puntos_disponibles > 0
                          ? 'border-success text-success bg-white'
                          : 'bg-light text-muted'
                      }`}
                    >
                      {formatPoints(cli.puntos_disponibles)} pts
                    </span>
                  </div>

                  <div className="fidelizacion-mobile-card__body">
                    <div>
                      <span>Pts acumulados</span>
                      <strong>{formatPoints(cli.puntos_acumulados_total)}</strong>
                    </div>
                    <div>
                      <span>Pts canjeados</span>
                      <strong>{formatPoints(cli.puntos_canjeados_total)}</strong>
                    </div>
                    <div>
                      <span>Ultima actividad</span>
                      <strong>{formatFechaHora(cli.fecha_ultima_actividad)}</strong>
                    </div>
                    <div>
                      <span>Sucursal</span>
                      <strong>{cli.nombre_sucursal_ultima_actividad || 'Sin actividad'}</strong>
                    </div>
                  </div>

                  <div className="fidelizacion-mobile-card__actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => onOpenDetalle(cli)}
                    >
                      Ver detalle
                    </button>
                    {canCanjear ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onOpenCanje(cli)}
                        disabled={cli.puntos_disponibles <= 0}
                      >
                        Canjear
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {canViewClientes ? (
          <Pagination meta={clientesMeta} loading={loadingClientes} onPageChange={onPageChange} />
        ) : null}
      </div>
    </div>
  );
}
