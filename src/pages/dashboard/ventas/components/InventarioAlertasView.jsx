import { useCallback, useEffect, useMemo, useState } from 'react';
import ventasService from '../../../../services/ventasService';
import { extractApiMessage } from '../utils/ventasHelpers';

const ESTADO_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'REVISADA', label: 'Revisadas' },
  { value: 'RESUELTA', label: 'Resueltas' },
  { value: 'DESCARTADA', label: 'Descartadas' }
];

const MOTIVO_OPTIONS = [
  { value: '', label: 'Todos los motivos' },
  { value: 'STOCK_INSUFICIENTE', label: 'Stock insuficiente' },
  { value: 'RECETA_SIN_COMPONENTES', label: 'Receta sin componentes' },
  { value: 'COMBO_SIN_COMPONENTES', label: 'Combo sin componentes' },
  { value: 'ALMACEN_DE_OTRA_SUCURSAL', label: 'Almacen de otra sucursal' },
  { value: 'EXTRA_SIN_CONFIGURACION_INVENTARIO', label: 'Extra sin configuracion' }
];

const initialFilters = {
  estado: 'PENDIENTE',
  motivo: '',
  id_pedido: ''
};

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value) => {
  const number = toNumber(value);
  if (number === null) return '--';
  return new Intl.NumberFormat('es-HN', { maximumFractionDigits: 4 }).format(number);
};

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--';
  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const normalizeState = (value) => String(value || 'PENDIENTE').trim().toUpperCase();

const getStateMeta = (estado) => {
  const code = normalizeState(estado);
  if (code === 'RESUELTA') return { label: 'Resuelta', tone: 'success' };
  if (code === 'REVISADA') return { label: 'Revisada', tone: 'info' };
  if (code === 'DESCARTADA') return { label: 'Descartada', tone: 'muted' };
  return { label: 'Pendiente', tone: 'warning' };
};

const getResourceLabel = (alerta) => {
  const type = String(alerta?.tipo_recurso || '').trim();
  const id =
    alerta?.id_recurso ||
    alerta?.id_producto ||
    alerta?.id_insumo ||
    alerta?.id_receta ||
    alerta?.id_combo ||
    alerta?.id_extra;
  if (!type && !id) return 'Sin recurso especifico';
  return `${type || 'recurso'}${id ? ` #${id}` : ''}`;
};

const buildListParams = (filters, page) => ({
  page,
  limit: 30,
  estado: filters.estado,
  motivo: filters.motivo,
  id_pedido: filters.id_pedido
});

function AlertStateBadge({ estado }) {
  const meta = getStateMeta(estado);
  return (
    <span className={`ventas-inv-alerts__badge ventas-inv-alerts__badge--${meta.tone}`}>
      {meta.label}
    </span>
  );
}

function AlertDetailModal({ alerta, busy, actionError, actionNote, onNoteChange, onClose, onSetEstado }) {
  if (!alerta) return null;

  return (
    <div className="ventas-inv-alerts__backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="ventas-inv-alerts__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventas-inv-alerts-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ventas-inv-alerts__modal-head">
          <div>
            <span>Inventario</span>
            <h3 id="ventas-inv-alerts-detail-title">Alerta #{alerta.id_alerta}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar detalle">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="ventas-inv-alerts__modal-body">
          <div className="ventas-inv-alerts__detail-title">
            <strong>{alerta.motivo || 'Advertencia de inventario'}</strong>
            <AlertStateBadge estado={alerta.estado} />
          </div>
          <p>{alerta.mensaje || 'Sin mensaje registrado.'}</p>

          <div className="ventas-inv-alerts__detail-grid">
            <div><span>Pedido</span><strong>#{alerta.id_pedido}</strong></div>
            <div><span>Sucursal</span><strong>{alerta.pedido?.nombre_sucursal || '--'}</strong></div>
            <div><span>Recurso</span><strong>{getResourceLabel(alerta)}</strong></div>
            <div><span>Requerido</span><strong>{formatNumber(alerta.cantidad_requerida)}</strong></div>
            <div><span>Disponible</span><strong>{formatNumber(alerta.stock_disponible)}</strong></div>
            <div><span>Deficit</span><strong>{formatNumber(alerta.deficit)}</strong></div>
            <div><span>Creada</span><strong>{formatDateTime(alerta.created_at)}</strong></div>
            <div><span>Revisada</span><strong>{formatDateTime(alerta.resolved_at)}</strong></div>
          </div>

          {alerta.nota_resolucion ? (
            <div className="ventas-inv-alerts__note">
              <span>Nota registrada</span>
              <p>{alerta.nota_resolucion}</p>
            </div>
          ) : null}

          <label className="ventas-inv-alerts__note-field">
            <span>Nota de resolucion</span>
            <textarea
              value={actionNote}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Ej: insumo reabastecido o receta enviada a configuracion."
              rows={3}
            />
          </label>

          {actionError ? <div className="ventas-inv-alerts__error">{actionError}</div> : null}
        </div>

        <footer className="ventas-inv-alerts__modal-actions">
          <button type="button" onClick={() => onSetEstado('REVISADA')} disabled={busy}>
            Marcar revisada
          </button>
          <button type="button" className="is-primary" onClick={() => onSetEstado('RESUELTA')} disabled={busy}>
            Resolver
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function InventarioAlertasView() {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [alertas, setAlertas] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAlerta, setSelectedAlerta] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNote, setActionNote] = useState('');

  const pendingTotal = useMemo(
    () => alertas.filter((alerta) => normalizeState(alerta.estado) === 'PENDIENTE').length,
    [alertas]
  );

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await ventasService.listInventarioAlertas(buildListParams(filters, page));
      setAlertas(Array.isArray(response?.alertas) ? response.alertas : []);
      setPagination(response?.pagination || { page, limit: 30, total: 0, total_pages: 0 });
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudieron cargar las alertas de inventario.'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void fetchAlertas();
  }, [fetchAlertas]);

  const patchFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const openDetail = (alerta) => {
    setSelectedAlerta(alerta);
    setActionNote(alerta?.nota_resolucion || '');
    setActionError('');
  };

  const updateEstado = async (estado) => {
    if (!selectedAlerta?.id_alerta) return;
    setActionBusy(true);
    setActionError('');
    try {
      const response = await ventasService.updateInventarioAlertaEstado(selectedAlerta.id_alerta, {
        estado,
        nota_resolucion: actionNote
      });
      const updated = response?.alerta || { ...selectedAlerta, estado };
      setSelectedAlerta(updated);
      setAlertas((rows) => rows.map((row) => (row.id_alerta === updated.id_alerta ? updated : row)));
    } catch (err) {
      setActionError(extractApiMessage(err, 'No se pudo actualizar la alerta.'));
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <main className="ventas-inv-alerts">
      <header className="ventas-inv-alerts__header">
        <div>
          <span>Inventario</span>
          <h2>Alertas de cocina</h2>
          <p>Seguimiento administrativo de advertencias generadas al iniciar preparacion.</p>
        </div>
        <div className="ventas-inv-alerts__summary">
          <strong>{pagination.total || 0}</strong>
          <span>Total filtrado</span>
          <strong>{pendingTotal}</strong>
          <span>Pendientes visibles</span>
        </div>
      </header>

      <section className="ventas-inv-alerts__filters" aria-label="Filtros de alertas">
        <label>
          <span>Estado</span>
          <select value={filters.estado} onChange={(event) => patchFilter('estado', event.target.value)}>
            <option value="">Todos</option>
            {ESTADO_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Motivo</span>
          <select value={filters.motivo} onChange={(event) => patchFilter('motivo', event.target.value)}>
            {MOTIVO_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Pedido</span>
          <input
            type="number"
            min="1"
            value={filters.id_pedido}
            onChange={(event) => patchFilter('id_pedido', event.target.value)}
            placeholder="Ej: 118"
          />
        </label>
        <button type="button" onClick={fetchAlertas} disabled={loading}>
          <i className="bi bi-arrow-clockwise" />
          Actualizar
        </button>
      </section>

      {error ? <div className="ventas-inv-alerts__error">{error}</div> : null}

      <section className="ventas-inv-alerts__table-wrap">
        <table className="ventas-inv-alerts__table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Motivo</th>
              <th>Recurso</th>
              <th>Deficit</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7">Cargando alertas...</td></tr>
            ) : alertas.length === 0 ? (
              <tr><td colSpan="7">No hay alertas para los filtros seleccionados.</td></tr>
            ) : (
              alertas.map((alerta) => (
                <tr key={alerta.id_alerta}>
                  <td>#{alerta.id_pedido}</td>
                  <td>
                    <strong>{alerta.motivo}</strong>
                    <span>{alerta.mensaje}</span>
                  </td>
                  <td>{getResourceLabel(alerta)}</td>
                  <td>{formatNumber(alerta.deficit)}</td>
                  <td><AlertStateBadge estado={alerta.estado} /></td>
                  <td>{formatDateTime(alerta.created_at)}</td>
                  <td>
                    <button type="button" onClick={() => openDetail(alerta)}>Ver detalle</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <footer className="ventas-inv-alerts__pagination">
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
          Anterior
        </button>
        <span>Pagina {pagination.page || page} de {Math.max(1, pagination.total_pages || 1)}</span>
        <button
          type="button"
          disabled={page >= (pagination.total_pages || 1) || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          Siguiente
        </button>
      </footer>

      <AlertDetailModal
        alerta={selectedAlerta}
        busy={actionBusy}
        actionError={actionError}
        actionNote={actionNote}
        onNoteChange={setActionNote}
        onClose={() => setSelectedAlerta(null)}
        onSetEstado={updateEstado}
      />
    </main>
  );
}
