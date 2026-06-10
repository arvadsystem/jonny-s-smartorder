import { useMemo, useState } from 'react';
import InsumoPresentacionCard from './InsumoPresentacionCard';
import InsumoPresentacionForm from './InsumoPresentacionForm';
import { useInsumoPresentaciones } from './useInsumoPresentaciones';
import './insumoPresentaciones.css';

const isActive = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  return String(value ?? '').trim().toLowerCase() === 'true';
};

const getUnitLabel = (unidad) => {
  const nombre = String(unidad?.nombre || '').trim();
  const simbolo = String(unidad?.simbolo || '').trim();
  if (nombre && simbolo) return `${nombre} (${simbolo})`;
  return nombre || simbolo || 'Sin unidad';
};

const resolveInsumoUnidad = (insumo, unidadesMedida = []) => {
  const idUnidad = String(insumo?.id_unidad_medida ?? '').trim();
  if (!idUnidad) return null;
  return (Array.isArray(unidadesMedida) ? unidadesMedida : []).find(
    (unidad) => String(unidad?.id_unidad_medida) === idUnidad
  ) || {
    id_unidad_medida: idUnidad,
    nombre: insumo?.unidad_medida_nombre || insumo?.unidad_nombre || '',
    simbolo: insumo?.unidad_medida_simbolo || insumo?.unidad_simbolo || ''
  };
};

export default function InsumoPresentacionesModal({
  show = false,
  insumo = null,
  unidadesMedida = [],
  canEdit = false,
  canChangeEstado = false,
  onClose,
  onNotify
}) {
  const [formMode, setFormMode] = useState(null);
  const [editingPresentacion, setEditingPresentacion] = useState(null);
  const [confirmState, setConfirmState] = useState({ show: false, presentacion: null, nextEstado: false, error: '' });

  const insumoActivo = isActive(insumo?.estado ?? insumo?.activo ?? true);
  const unidadBase = useMemo(
    () => resolveInsumoUnidad(insumo, unidadesMedida),
    [insumo, unidadesMedida]
  );
  const canCreate = canEdit && insumoActivo && Boolean(unidadBase?.id_unidad_medida);

  const {
    presentaciones,
    loading,
    error,
    saving,
    changingEstadoId,
    reload,
    savePresentacion,
    changeEstado
  } = useInsumoPresentaciones({
    idInsumo: insumo?.id_insumo,
    open: show,
    onNotify
  });

  if (!show || !insumo) return null;

  const closeForm = () => {
    setFormMode(null);
    setEditingPresentacion(null);
  };

  const openCreateForm = () => {
    if (!canCreate) return;
    setEditingPresentacion(null);
    setFormMode('create');
  };

  const openEditForm = (presentacion) => {
    if (!canEdit) return;
    setEditingPresentacion(presentacion);
    setFormMode('edit');
  };

  const submitForm = async (payload) => {
    const result = await savePresentacion({
      mode: formMode === 'edit' ? 'edit' : 'create',
      idPresentacion: editingPresentacion?.id_presentacion,
      data: payload
    });
    if (result?.ok) closeForm();
    return result;
  };

  const requestEstado = (presentacion, nextEstado) => {
    if (!canChangeEstado) return;
    if (nextEstado && !insumoActivo) {
      onNotify?.('INSUMO INACTIVO', 'No se puede activar una presentacion si el insumo esta inactivo.', 'warning');
      return;
    }
    if (!nextEstado) {
      setConfirmState({ show: true, presentacion, nextEstado, error: '' });
      return;
    }
    void confirmEstadoChange(presentacion, nextEstado);
  };

  const confirmEstadoChange = async (
    presentacion = confirmState.presentacion,
    nextEstado = confirmState.nextEstado
  ) => {
    const result = await changeEstado(presentacion, nextEstado);
    if (result?.ok) {
      setConfirmState({ show: false, presentacion: null, nextEstado: false, error: '' });
      return;
    }
    setConfirmState((current) => ({ ...current, error: result?.message || 'No se pudo cambiar el estado.' }));
  };

  const closeConfirm = () => {
    if (changingEstadoId) return;
    setConfirmState({ show: false, presentacion: null, nextEstado: false, error: '' });
  };

  return (
    <>
      <div className="modal fade show inv-prod-modal-backdrop ins-pres-modal-backdrop" style={{ display: 'block' }} role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable ins-pres-modal-dialog" onClick={(event) => event.stopPropagation()}>
          <div className="modal-content shadow inv-prod-modal-content ins-pres-modal">
            <div className="modal-header ins-pres-modal__header">
              <div className="ins-pres-modal__title-wrap">
                <div className="ins-pres-modal__icon" aria-hidden="true">
                  <i className="bi bi-arrow-left-right" />
                </div>
                <div>
                  <div className="ins-pres-modal__title">Presentaciones y conversiones</div>
                  <div className="ins-pres-modal__subtitle">
                    Configura como se compra o consume este insumo sin cambiar su unidad base de inventario.
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-sm inv-ins-detail-modal__close" onClick={onClose} aria-label="Cerrar">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="modal-body ins-pres-modal__body">
              <section className="ins-pres-context">
                <div>
                  <span>Insumo</span>
                  <strong>{insumo?.nombre_insumo || `Insumo #${insumo?.id_insumo ?? '-'}`}</strong>
                </div>
                <div>
                  <span>Unidad de inventario</span>
                  <strong>{unidadBase ? getUnitLabel(unidadBase) : 'Sin unidad definida'}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong className={insumoActivo ? 'is-active' : 'is-inactive'}>{insumoActivo ? 'Activo' : 'Inactivo'}</strong>
                </div>
              </section>

              <div className="ins-pres-note">
                <i className="bi bi-info-circle" aria-hidden="true" />
                <span>Todas las equivalencias se convierten a la unidad base del inventario. El stock oficial continua en esa unidad.</span>
              </div>

              {!unidadBase?.id_unidad_medida ? (
                <div className="alert alert-warning mb-0">
                  Define primero la unidad de medida del insumo para crear presentaciones.
                </div>
              ) : null}

              {!insumoActivo ? (
                <div className="alert alert-secondary mb-0">
                  Este insumo esta inactivo. Puedes consultar sus presentaciones, pero no crear ni activar nuevas.
                </div>
              ) : null}

              {formMode ? (
                <section className="ins-pres-form-shell">
                  <div className="ins-pres-section-head">
                    <div>
                      <span>{formMode === 'edit' ? 'Editar conversion' : 'Nueva conversion'}</span>
                      <strong>{formMode === 'edit' ? editingPresentacion?.nombre_presentacion : 'Agregar presentacion'}</strong>
                    </div>
                  </div>
                  <InsumoPresentacionForm
                    key={`${formMode}-${editingPresentacion?.id_presentacion ?? 'new'}`}
                    mode={formMode}
                    presentacion={editingPresentacion}
                    unidadesMedida={unidadesMedida}
                    unidadBase={unidadBase}
                    insumoActivo={insumoActivo}
                    saving={saving}
                    onCancel={closeForm}
                    onSubmit={submitForm}
                  />
                </section>
              ) : (
                <section className="ins-pres-list-shell">
                  <div className="ins-pres-section-head">
                    <div>
                      <span>Listado</span>
                      <strong>{presentaciones.length} presentacion{presentaciones.length === 1 ? '' : 'es'}</strong>
                    </div>
                    {canCreate ? (
                      <button type="button" className="btn inv-prod-btn-primary" onClick={openCreateForm}>
                        <i className="bi bi-plus-lg" aria-hidden="true" />
                        <span>Agregar presentacion</span>
                      </button>
                    ) : null}
                  </div>

                  {loading ? (
                    <div className="ins-pres-state">
                      <div className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      <span>Cargando presentaciones...</span>
                    </div>
                  ) : null}

                  {error && !loading ? (
                    <div className="alert alert-danger mb-0">
                      <div>{error}</div>
                      <button type="button" className="btn btn-sm btn-outline-danger mt-2" onClick={reload}>Reintentar</button>
                    </div>
                  ) : null}

                  {!loading && !error && presentaciones.length === 0 ? (
                    <div className="ins-pres-empty">
                      <i className="bi bi-inboxes" aria-hidden="true" />
                      <strong>Este insumo todavia no tiene presentaciones configuradas.</strong>
                      {canCreate ? (
                        <button type="button" className="btn inv-prod-btn-primary" onClick={openCreateForm}>
                          Agregar presentacion
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {!loading && !error && presentaciones.length > 0 ? (
                    <div className="ins-pres-list">
                      {presentaciones.map((presentacion) => (
                        <InsumoPresentacionCard
                          key={presentacion.id_presentacion}
                          presentacion={presentacion}
                          canEdit={canEdit}
                          canChangeEstado={canChangeEstado}
                          changing={Number(changingEstadoId) === Number(presentacion.id_presentacion)}
                          onEdit={openEditForm}
                          onRequestEstado={requestEstado}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )}
            </div>

            <div className="modal-footer ins-pres-modal__footer">
              <button type="button" className="btn inv-prod-btn-subtle" onClick={onClose}>Cerrar</button>
              {!formMode && canCreate ? (
                <button type="button" className="btn inv-prod-btn-primary" onClick={openCreateForm}>
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                  <span>Agregar presentacion</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {confirmState.show ? (
        <div className="inv-pro-confirm-backdrop ins-pres-confirm" role="dialog" aria-modal="true" onClick={closeConfirm}>
          <div className="inv-pro-confirm-panel inv-pro-confirm-panel--danger" onClick={(event) => event.stopPropagation()}>
            <div className="inv-pro-confirm-glow" aria-hidden="true" />
            <div className="inv-pro-confirm-head">
              <div className="inv-pro-confirm-head-main">
                <div className="inv-pro-confirm-head-icon">
                  <i className="bi bi-slash-circle" aria-hidden="true" />
                </div>
                <div className="inv-pro-confirm-head-copy">
                  <div className="inv-pro-confirm-kicker">Presentaciones</div>
                  <div className="inv-pro-confirm-title">Confirmar inactivacion</div>
                  <div className="inv-pro-confirm-sub">La presentacion no se eliminara.</div>
                </div>
              </div>
              <button type="button" className="inv-pro-confirm-close" onClick={closeConfirm} aria-label="Cerrar" disabled={Boolean(changingEstadoId)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="inv-pro-confirm-body">
              <div className="inv-pro-confirm-note">
                <i className="bi bi-shield-exclamation" aria-hidden="true" />
                <span>La presentacion dejara de estar disponible para nuevas operaciones, pero no se eliminara.</span>
              </div>
              <div className="inv-pro-confirm-name">
                <div className="inv-pro-confirm-name-label">Presentacion seleccionada</div>
                <div className="inv-pro-confirm-name-value">
                  <i className="bi bi-arrow-left-right" aria-hidden="true" />
                  <span>{confirmState.presentacion?.nombre_presentacion || 'Presentacion'}</span>
                </div>
              </div>
              {confirmState.error ? <div className="alert alert-danger py-2 mt-3 mb-0">{confirmState.error}</div> : null}
            </div>
            <div className="inv-pro-confirm-footer">
              <button className="btn inv-pro-btn-cancel" type="button" onClick={closeConfirm} disabled={Boolean(changingEstadoId)}>Cancelar</button>
              <button className="btn inv-pro-btn-danger" type="button" onClick={() => confirmEstadoChange()} disabled={Boolean(changingEstadoId)}>
                <i className="bi bi-slash-circle" aria-hidden="true" />
                <span>{changingEstadoId ? 'Inactivando...' : 'Inactivar'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
