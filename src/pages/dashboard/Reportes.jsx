import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SinPermiso from '../../components/common/SinPermiso';
import { usePermisos } from '../../context/PermisosContext';
import {
  MODULE_PRIMARY_PERMISSION,
  getAllowedTabs
} from '../../utils/permissions';
import { reportesService } from '../../services/reportesService';

const REPORT_KEYS = [
  'ventas-resumen',
  'ventas-metodos-pago',
  'caja-cierres',
  'caja-diferencias',
  'inventario-stock-critico',
  'inventario-kardex',
  'ventas-descuentos',
  'ventas-items'
];

const REPORT_HANDLERS = {
  'ventas-resumen': reportesService.getVentasResumen,
  'ventas-metodos-pago': reportesService.getVentasMetodosPago,
  'caja-cierres': reportesService.getCajaCierres,
  'caja-diferencias': reportesService.getCajaDiferencias,
  'inventario-stock-critico': reportesService.getInventarioStockCritico,
  'inventario-kardex': reportesService.getInventarioKardex,
  'ventas-descuentos': reportesService.getVentasDescuentos,
  'ventas-items': reportesService.getVentasItems
};

const INITIAL_FILTERS = {
  fecha_inicio: '',
  fecha_fin: '',
  sucursal: ''
};

const Reportes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, loading: permisosLoading, permisos } = usePermisos();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs('reportes', permisos, { isSuperAdmin }),
    [isSuperAdmin, permisos]
  );

  const fallbackTab = allowedTabs[0]?.key || null;
  const rawTab = String(searchParams.get('tab') || fallbackTab || '').toLowerCase();
  const normalizedTab = REPORT_KEYS.includes(rawTab) ? rawTab : fallbackTab;
  const activeTab = allowedTabs.some((tab) => tab.key === normalizedTab) ? normalizedTab : fallbackTab;

  useEffect(() => {
    if (permisosLoading || !activeTab) return;
    if (rawTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, rawTab, permisosLoading, searchParams, setSearchParams]);

  const runReport = async (tabKey) => {
    const fetcher = REPORT_HANDLERS[tabKey];
    if (!fetcher) return;

    setLoading(true);
    setError('');

    try {
      const data = await fetcher(filters);
      setPayload(data || null);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeTab) return;
    runReport(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (permisosLoading) return null;

  if (!fallbackTab) {
    return (
      <SinPermiso
        permiso={MODULE_PRIMARY_PERMISSION.reportes}
        detalle="No tienes acceso a ningun reporte habilitado."
      />
    );
  }

  return (
    <div className="container-fluid p-3 reportes-page">
      <div className="reportes-header">
        <div>
          <h2 className="reportes-title">Reportes</h2>
          <p className="reportes-subtitle">Base operativa de reporteria para Ventas, Caja e Inventario.</p>
        </div>
      </div>

      <div className="reportes-filters card border-0 shadow-sm">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label">Fecha inicio</label>
              <input
                type="date"
                className="form-control"
                value={filters.fecha_inicio}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, fecha_inicio: event.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Fecha fin</label>
              <input
                type="date"
                className="form-control"
                value={filters.fecha_fin}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, fecha_fin: event.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Sucursal</label>
              <input
                type="text"
                className="form-control"
                placeholder="ID o nombre"
                value={filters.sucursal}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, sucursal: event.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-3 d-grid">
              <button type="button" className="btn btn-primary" onClick={() => runReport(activeTab)} disabled={loading}>
                {loading ? 'Consultando...' : 'Aplicar filtros'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="reportes-tabs nav nav-pills" role="tablist" aria-label="Tipos de reporte">
        {allowedTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`nav-link ${tab.key === activeTab ? 'active' : ''}`}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', tab.key);
              setSearchParams(next);
            }}
          >
            <i className={`${tab.icon} me-2`} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card border-0 shadow-sm reportes-result">
        <div className="card-body">
          {error ? <div className="alert alert-danger mb-0">{error}</div> : null}

          {!error && payload ? (
            <>
              <div className="reportes-meta mb-3">
                <span className="badge text-bg-primary">{payload.reporte || activeTab}</span>
                <span className="badge text-bg-light">Fase 1</span>
              </div>
              <pre className="reportes-json mb-0">{JSON.stringify(payload, null, 2)}</pre>
            </>
          ) : null}

          {!error && !payload && !loading ? (
            <p className="text-muted mb-0">Sin datos para mostrar.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Reportes;
