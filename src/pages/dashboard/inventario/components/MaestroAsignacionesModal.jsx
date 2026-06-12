import { useCallback, useEffect, useMemo, useState } from 'react';

const normalizeApiMessage = (error, fallbackMessage) => {
  const status = Number(error?.status || 0);
  const data = error?.data;
  const message = String(
    (data && typeof data === 'object' && (data.message || data.mensaje))
      || error?.message
      || fallbackMessage
      || 'No se pudo completar la accion. Verifica los datos e intenta de nuevo.'
  ).trim();

  if (status >= 500) return 'No se pudo completar la accion. Verifica los datos e intenta de nuevo.';
  return message;
};

const normalizeAssignments = (payload) => {
  if (Array.isArray(payload?.asignaciones)) return payload.asignaciones;
  if (Array.isArray(payload)) return payload;
  return [];
};

const normalizeAvailableWarehouses = (payload) => {
  if (Array.isArray(payload?.almacenes_disponibles)) return payload.almacenes_disponibles;
  if (Array.isArray(payload)) return payload;
  return [];
};

const boolish = (value) => (
  value === true
  || value === 1
  || value === '1'
  || String(value ?? '').trim().toLowerCase() === 'true'
);

const formatNumeric = (value) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return '0';
  if (Number.isInteger(numericValue)) return String(numericValue);
  return numericValue.toFixed(2);
};

function MaestroAsignacionesModal({
  show,
  entityLabel,
  selectedItem,
  onClose,
  onNotify,
  loadAssignments,
  loadAvailableWarehouses,
  assignToWarehouse,
  deactivateAssignment,
  canAssign = false,
  canDeactivate = false
}) {
  const [assignments, setAssignments] = useState([]);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [assigningWarehouseId, setAssigningWarehouseId] = useState(null);
  const [deactivatingWarehouseId, setDeactivatingWarehouseId] = useState(null);

  const selectedId = useMemo(() => {
    if (!selectedItem || typeof selectedItem !== 'object') return null;
    return selectedItem.id_producto ?? selectedItem.id_insumo ?? null;
  }, [selectedItem]);

  const selectedName = useMemo(() => {
    if (!selectedItem || typeof selectedItem !== 'object') return '';
    return selectedItem.nombre_producto ?? selectedItem.nombre_insumo ?? '';
  }, [selectedItem]);

  const modalTitle = useMemo(() => `Gestionar sucursales de ${entityLabel}`, [entityLabel]);

  const notify = useCallback((title, message, variant = 'success') => {
    if (typeof onNotify === 'function') onNotify(title, message, variant);
  }, [onNotify]);

  const reloadData = useCallback(async () => {
    if (!show || !selectedId) return;
    setLoading(true);
    setError('');
    try {
      const [assignmentsPayload, availablePayload] = await Promise.all([
        loadAssignments(selectedId),
        loadAvailableWarehouses(selectedId)
      ]);
      setAssignments(normalizeAssignments(assignmentsPayload));
      setAvailableWarehouses(normalizeAvailableWarehouses(availablePayload));
    } catch (err) {
      setError(normalizeApiMessage(err, 'No se pudo cargar la informacion de sucursales.'));
    } finally {
      setLoading(false);
    }
  }, [loadAssignments, loadAvailableWarehouses, selectedId, show]);

  useEffect(() => {
    void reloadData();
  }, [reloadData]);

  const handleAssign = useCallback(async (warehouse) => {
    if (!selectedId || !warehouse?.id_almacen || !canAssign) return;
    setAssigningWarehouseId(Number(warehouse.id_almacen));
    setError('');
    try {
      await assignToWarehouse(selectedId, warehouse.id_almacen);
      notify('ASIGNADO', `${entityLabel} asignado correctamente al almacen seleccionado.`, 'success');
      await reloadData();
    } catch (err) {
      const message = normalizeApiMessage(err, `No se pudo asignar el ${entityLabel.toLowerCase()} seleccionado.`);
      setError(message);
      notify(
        Number(err?.status || 0) === 409 ? 'CONFLICTO' : Number(err?.status || 0) === 403 ? 'SIN PERMISOS' : 'ERROR',
        message,
        Number(err?.status || 0) >= 500 ? 'danger' : 'warning'
      );
    } finally {
      setAssigningWarehouseId(null);
    }
  }, [assignToWarehouse, canAssign, entityLabel, notify, reloadData, selectedId]);

  const handleDeactivate = useCallback(async (assignment) => {
    if (!selectedId || !assignment?.id_almacen || !canDeactivate) return;
    const confirmed = window.confirm(`¿Deseas inactivar la asignacion local en ${assignment?.sucursal || 'la sucursal'} / ${assignment?.almacen || 'el almacen'}?`);
    if (!confirmed) return;

    setDeactivatingWarehouseId(Number(assignment.id_almacen));
    setError('');
    try {
      await deactivateAssignment(selectedId, assignment.id_almacen);
      notify('INACTIVADO', `La asignacion local del ${entityLabel.toLowerCase()} se inactivo correctamente.`, 'success');
      await reloadData();
    } catch (err) {
      const message = normalizeApiMessage(err, `No se pudo inactivar la asignacion local del ${entityLabel.toLowerCase()}.`);
      setError(message);
      notify(
        Number(err?.status || 0) === 403 ? 'SIN PERMISOS' : 'ERROR',
        message,
        Number(err?.status || 0) >= 500 ? 'danger' : 'warning'
      );
    } finally {
      setDeactivatingWarehouseId(null);
    }
  }, [canDeactivate, deactivateAssignment, entityLabel, notify, reloadData, selectedId]);

  if (!show) return null;

  return (
    <div
      className="modal fade show inv-prod-modal-backdrop inv-master-assign-modal-backdrop"
      style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2600 }}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable inv-prod-modal-dialog inv-master-assign-modal-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-content shadow inv-prod-modal-content inv-master-assign-modal">
          <div className="modal-header inv-master-assign-modal__header">
            <div>
              <div className="fw-semibold">{modalTitle}</div>
              <div className="small text-muted">{selectedName || `${entityLabel} seleccionado`}</div>
            </div>
            <button type="button" className="btn btn-sm btn-light inv-prod-modal-close" onClick={onClose} aria-label="Cerrar">
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="modal-body inv-prod-modal-body inv-master-assign-modal__body">
            <div className="inv-master-assign-modal__intro">
              <div><strong>{entityLabel}:</strong> {selectedName || '-'}</div>
              <div className="text-muted">Consulta las asignaciones actuales, usa “Asignar” para reactivar o crear una asignacion local y usa “Inactivar” solo para el almacen seleccionado.</div>
            </div>

            {error ? (
              <div className="alert alert-warning inv-master-assign-modal__alert" role="alert">
                {error}
              </div>
            ) : null}

            <div className="inv-master-assign-modal__section">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <h6 className="mb-0">Asignaciones actuales</h6>
                {loading ? <span className="small text-muted">Cargando...</span> : <span className="small text-muted">{assignments.length} registro(s)</span>}
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle inv-master-assign-modal__table">
                  <thead>
                    <tr>
                      <th>Sucursal</th>
                      <th>Almacen</th>
                      <th>Cantidad</th>
                      <th>Stock minimo</th>
                      <th>Estado local</th>
                      <th className="text-end">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && assignments.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-3 text-muted">No hay asignaciones registradas.</td>
                      </tr>
                    ) : null}
                    {assignments.map((assignment) => {
                      const assignmentIsActive = boolish(assignment?.activo);
                      const isProcessing = deactivatingWarehouseId === Number(assignment?.id_almacen);
                      return (
                        <tr key={`assigned-${assignment?.id_almacen}`}>
                          <td data-label="Sucursal">{assignment?.sucursal || '-'}</td>
                          <td data-label="Almacen">{assignment?.almacen || '-'}</td>
                          <td data-label="Cantidad">{formatNumeric(assignment?.cantidad)}</td>
                          <td data-label="Stock minimo">{formatNumeric(assignment?.stock_minimo)}</td>
                          <td data-label="Estado local">
                            <span className={`badge ${assignmentIsActive ? 'text-bg-success' : 'text-bg-secondary'}`}>
                              {assignmentIsActive ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="text-end" data-label="Accion">
                            {canDeactivate && assignmentIsActive ? (
                              <button
                                type="button"
                                className="btn btn-sm inv-prod-btn-inactivate"
                                onClick={() => handleDeactivate(assignment)}
                                disabled={isProcessing || assigningWarehouseId !== null}
                              >
                                {isProcessing ? 'Inactivando...' : 'Inactivar'}
                              </button>
                            ) : (
                              <span className="small text-muted">Sin accion</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="inv-master-assign-modal__section">
              <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                <h6 className="mb-0">Almacenes disponibles</h6>
                {!loading ? <span className="small text-muted">{availableWarehouses.length} opcion(es)</span> : null}
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle inv-master-assign-modal__table">
                  <thead>
                    <tr>
                      <th>Sucursal</th>
                      <th>Almacen</th>
                      <th className="text-end">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && availableWarehouses.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center py-3 text-muted">No hay almacenes disponibles para asignar.</td>
                      </tr>
                    ) : null}
                    {availableWarehouses.map((warehouse) => {
                      const isProcessing = assigningWarehouseId === Number(warehouse?.id_almacen);
                      return (
                        <tr key={`available-${warehouse?.id_almacen}`}>
                          <td data-label="Sucursal">{warehouse?.sucursal || '-'}</td>
                          <td data-label="Almacen">{warehouse?.almacen || '-'}</td>
                          <td className="text-end" data-label="Accion">
                            {canAssign ? (
                              <button
                                type="button"
                                className="btn btn-sm inv-prod-btn-primary"
                                onClick={() => handleAssign(warehouse)}
                                disabled={isProcessing || deactivatingWarehouseId !== null}
                              >
                                {isProcessing ? 'Asignando...' : 'Asignar'}
                              </button>
                            ) : (
                              <span className="small text-muted">Sin permisos</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MaestroAsignacionesModal;
