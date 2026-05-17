import { useEffect, useMemo, useRef, useState } from 'react';

const initialOpenForm = Object.freeze({
  id_sucursal: '',
  id_caja: '',
  monto_apertura: '',
  observacion_apertura: ''
});

const toPositiveNumber = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveCajaLabel = (caja) => {
  if (!caja) return 'Caja asignada';
  return caja.nombre_caja || caja.codigo_caja || `Caja #${caja.id_caja}`;
};

const buildInitialCreateForm = (defaultSucursalId = '') => ({
  id_sucursal: defaultSucursalId || '',
  codigo_caja: 'CAJA-1',
  nombre_caja: 'Caja 1',
  observacion: '',
  id_usuario: '',
  rol_operativo: 'RESPONSABLE'
});
const resolveNextCajaSuggestion = (rows) => {
  const items = Array.isArray(rows) ? rows : [];
  let next = 1;
  items.forEach((row) => {
    const raw = String(row?.codigo_caja || '').trim().toUpperCase();
    const match = /^CAJA-(\d+)$/.exec(raw);
    if (!match) return;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isInteger(parsed) && parsed >= next) next = parsed + 1;
  });
  return {
    codigo_caja: `CAJA-${next}`,
    nombre_caja: `Caja ${next}`
  };
};

export default function CierreCajaAbrirModal({
  open,
  mode,
  cajasDisponibles,
  loadingCajas,
  saving,
  canSelectSucursal,
  selectedSucursalId,
  sucursales,
  usuariosDisponibles,
  loadingUsuarios,
  useAssignedCajaOnly = false,
  assignedCaja = null,
  loadingAssignedCaja = false,
  assignedCajaMissing = false,
  assignedCajaError = '',
  assignedCajaSessionActive = false,
  onRequestCajas,
  onRequestUsuarios,
  onClose,
  onSubmitOpenSesion,
  onSubmitCreateCaja
}) {
  const [openForm, setOpenForm] = useState(() => ({
    ...initialOpenForm,
    id_sucursal: selectedSucursalId || ''
  }));
  const [createForm, setCreateForm] = useState(() => buildInitialCreateForm(selectedSucursalId));
  const lastRequestedUsuariosKeyRef = useRef(null);
  const lastRequestedCajasRef = useRef(null);
  const assignedCajaMode = mode === 'existente' && useAssignedCajaOnly;
  const assignedCajaId = toPositiveNumber(assignedCaja?.id_caja);

  useEffect(() => {
    if (!open || assignedCajaMode || (mode !== 'existente' && mode !== 'nueva')) return;
    const sourceSucursal = mode === 'nueva' ? createForm.id_sucursal : openForm.id_sucursal;
    const idSucursalTarget = Number.parseInt(String(sourceSucursal || ''), 10);
    if (!Number.isInteger(idSucursalTarget) || idSucursalTarget <= 0) return;
    const requestKey = `${mode}:${idSucursalTarget}`;
    if (lastRequestedCajasRef.current === requestKey) return;
    lastRequestedCajasRef.current = requestKey;
    if (typeof onRequestCajas === 'function') {
      void Promise.resolve(onRequestCajas(idSucursalTarget)).catch(() => {});
    }
  }, [assignedCajaMode, createForm.id_sucursal, mode, onRequestCajas, open, openForm.id_sucursal]);

  useEffect(() => {
    if (!open || mode !== 'nueva') return;
    const idSucursalTarget = Number.parseInt(String(createForm.id_sucursal || ''), 10);
    const rolOperativo = String(createForm.rol_operativo || 'RESPONSABLE').trim().toUpperCase();
    if (!Number.isInteger(idSucursalTarget) || idSucursalTarget <= 0) return;
    const requestKey = `${idSucursalTarget}:${rolOperativo}`;
    if (lastRequestedUsuariosKeyRef.current === requestKey) return;
    lastRequestedUsuariosKeyRef.current = requestKey;
    if (typeof onRequestUsuarios === 'function') {
      void Promise.resolve(onRequestUsuarios(idSucursalTarget, rolOperativo)).catch(() => {});
    }
  }, [createForm.id_sucursal, createForm.rol_operativo, mode, onRequestUsuarios, open]);

  useEffect(() => {
    if (!open || mode !== 'nueva') return;
    const suggestion = resolveNextCajaSuggestion(cajasDisponibles);
    setCreateForm((current) => {
      if (current.codigo_caja === suggestion.codigo_caja && current.nombre_caja === suggestion.nombre_caja) {
        return current;
      }
      return { ...current, ...suggestion };
    });
  }, [cajasDisponibles, mode, open]);

  useEffect(() => {
    if (open) return;
    lastRequestedUsuariosKeyRef.current = null;
    lastRequestedCajasRef.current = null;
  }, [open]);

  const isOpenValid = useMemo(() => {
    const monto = Number(openForm.monto_apertura);
    const hasSucursal =
      assignedCajaMode || !canSelectSucursal || Number.parseInt(String(openForm.id_sucursal || ''), 10) > 0;
    const hasCaja = assignedCajaMode ? Boolean(assignedCajaId) : Boolean(openForm.id_caja);
    const assignmentBlocksOpen =
      assignedCajaMode &&
      (loadingAssignedCaja ||
        assignedCajaMissing ||
        Boolean(assignedCajaError) ||
        assignedCajaSessionActive ||
        assignedCaja?.caja_abierta_por_otro_responsable ||
        assignedCaja?.puede_abrir === false);
    return hasSucursal && hasCaja && Number.isFinite(monto) && monto >= 0 && !assignmentBlocksOpen;
  }, [
    assignedCaja?.caja_abierta_por_otro_responsable,
    assignedCaja?.puede_abrir,
    assignedCajaError,
    assignedCajaId,
    assignedCajaMissing,
    assignedCajaMode,
    assignedCajaSessionActive,
    canSelectSucursal,
    loadingAssignedCaja,
    openForm.id_caja,
    openForm.id_sucursal,
    openForm.monto_apertura
  ]);

  const isCreateValid = useMemo(() => {
    const hasNombre = String(createForm.nombre_caja || '').trim().length > 0;
    const hasUsuario = Number.parseInt(String(createForm.id_usuario || ''), 10) > 0;
    const hasRole = ['RESPONSABLE', 'AUXILIAR'].includes(String(createForm.rol_operativo || '').trim().toUpperCase());
    const hasSucursal = !canSelectSucursal || Number.parseInt(String(createForm.id_sucursal || ''), 10) > 0;
    return hasNombre && hasUsuario && hasRole && hasSucursal;
  }, [canSelectSucursal, createForm]);

  if (!open) return null;

  const submitExisting = async (event) => {
    event.preventDefault();
    if (!isOpenValid || saving) return;

    try {
      const payload = {
        id_sucursal: Number.parseInt(String(openForm.id_sucursal || ''), 10) || null,
        monto_apertura: Number(openForm.monto_apertura),
        observacion_apertura: openForm.observacion_apertura.trim() || null
      };
      if (!assignedCajaMode) payload.id_caja = Number(openForm.id_caja);
      await onSubmitOpenSesion(payload);
    } catch {
      // El hook ya muestra toast; evitamos uncaught promise.
    }
  };

  const submitNewCaja = async (event) => {
    event.preventDefault();
    if (!isCreateValid || saving) return;

    const idSucursal = Number.parseInt(String(createForm.id_sucursal || ''), 10) || null;
    const idUsuario = Number.parseInt(String(createForm.id_usuario || ''), 10) || null;

    try {
      await onSubmitCreateCaja({
        id_sucursal: idSucursal,
        codigo_caja: createForm.codigo_caja.trim(),
        nombre_caja: createForm.nombre_caja.trim(),
        observacion: createForm.observacion.trim() || null,
        asignacion_inicial: {
          id_usuario: idUsuario,
          puede_responsable: createForm.rol_operativo === 'RESPONSABLE',
          puede_auxiliar: createForm.rol_operativo === 'AUXILIAR',
          observacion: 'Asignación inicial desde nueva caja'
        }
      });
    } catch {
      // El hook ya muestra toast; evitamos uncaught promise.
    }
  };

  return (
    <div className="ventas-modal-backdrop" role="presentation">
      <section
        className="ventas-modal cierres-caja-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cierres-caja-abrir-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-safe2-fill" />
            </span>
            <div>
              <h3 id="cierres-caja-abrir-title">{mode === 'nueva' ? 'Nueva caja' : 'Abrir sesión'}</h3>
              <p>
                {mode === 'nueva'
                  ? 'Crea una caja nueva y deja su asignación operativa configurada.'
                  : assignedCajaMode
                    ? 'Abre sesión sobre tu caja asignada.'
                    : 'Abre una sesión sobre una caja existente.'}
              </p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        {mode === 'existente' ? (
          <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={submitExisting}>
            {canSelectSucursal && !assignedCajaMode ? (
              <label className="ventas-create-modal__field">
                <span>Sucursal</span>
                <select
                  className="ventas-create-modal__select"
                  value={openForm.id_sucursal}
                  onChange={(event) =>
                    setOpenForm((current) => ({
                      ...current,
                      id_sucursal: event.target.value,
                      id_caja: ''
                    }))
                  }
                >
                  <option value="">Selecciona una sucursal</option>
                  {sucursales.map((sucursal) => (
                    <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                      {sucursal.nombre_sucursal}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {assignedCajaMode ? (
              <div className="ventas-create-modal__field">
                <span>Caja asignada</span>
                {loadingAssignedCaja ? (
                  <div className="cierres-caja-action-modal__readonly">Consultando caja asignada...</div>
                ) : assignedCajaMissing ? (
                  <div className="ventas-create-modal__error">
                    No tienes una caja asignada activa. Solicita asignación a un administrador.
                  </div>
                ) : assignedCajaError ? (
                  <div className="ventas-create-modal__error">{assignedCajaError}</div>
                ) : assignedCaja ? (
                  <>
                    <div className="ventas-caja-apertura-modal__assigned">
                      <div>
                        <span>Caja</span>
                        <strong>{resolveCajaLabel(assignedCaja)}</strong>
                      </div>
                      <div>
                        <span>Código</span>
                        <strong>{assignedCaja.codigo_caja || `Caja #${assignedCaja.id_caja}`}</strong>
                      </div>
                      <div>
                        <span>Sucursal</span>
                        <strong>{assignedCaja.nombre_sucursal || 'Sucursal asignada'}</strong>
                      </div>
                    </div>
                    {assignedCajaSessionActive ? (
                      <div className="cierres-caja-action-modal__readonly">
                        Ya tienes una sesión activa en esta caja.
                      </div>
                    ) : assignedCaja?.caja_abierta_por_otro_responsable ? (
                      <div className="ventas-create-modal__error">
                        La caja asignada ya tiene una sesión abierta por otro responsable.
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="ventas-create-modal__error">
                    No tienes una caja asignada activa. Solicita asignación a un administrador.
                  </div>
                )}
              </div>
            ) : (
              <label className="ventas-create-modal__field">
                <span>Caja existente</span>
                <select
                  className="ventas-create-modal__select"
                  value={openForm.id_caja}
                  onChange={(event) =>
                    setOpenForm((current) => ({ ...current, id_caja: event.target.value }))
                  }
                  disabled={loadingCajas}
                >
                  <option value="">
                    {loadingCajas ? 'Cargando cajas...' : 'Selecciona una caja'}
                  </option>
                  {cajasDisponibles.map((caja) => (
                    <option key={caja.id_caja} value={caja.id_caja}>
                      {caja.nombre_caja} ({caja.codigo_caja || 'Sin código'})
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="ventas-create-modal__field">
              <span>Monto de apertura</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={openForm.monto_apertura}
                onChange={(event) =>
                  setOpenForm((current) => ({ ...current, monto_apertura: event.target.value }))
                }
                placeholder="0.00"
              />
            </label>

            <label className="ventas-create-modal__field">
              <span>Observación de apertura</span>
              <textarea
                className="ventas-create-modal__note-input"
                rows="3"
                value={openForm.observacion_apertura}
                onChange={(event) =>
                  setOpenForm((current) => ({ ...current, observacion_apertura: event.target.value }))
                }
                placeholder="Detalle operativo opcional..."
              />
            </label>

            <footer className="ventas-detail-modal__footer">
              <div className="ventas-detail-modal__footer-actions">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={!isOpenValid || saving}>
                  {saving ? 'Abriendo...' : 'Abrir sesión'}
                </button>
              </div>
            </footer>
          </form>
        ) : (
          <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={submitNewCaja}>
            <div className="cierres-caja-action-modal__grid">
              {canSelectSucursal ? (
                <label className="ventas-create-modal__field">
                  <span>Sucursal</span>
                  <select
                    className="ventas-create-modal__select"
                    value={createForm.id_sucursal}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        id_sucursal: event.target.value,
                        id_usuario: ''
                      }))
                    }
                  >
                    <option value="">Selecciona una sucursal</option>
                    {sucursales.map((sucursal) => (
                      <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>
                        {sucursal.nombre_sucursal}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="ventas-create-modal__field">
                <span>Nombre de caja</span>
                <input
                  type="text"
                  value={createForm.nombre_caja}
                  readOnly
                  disabled
                />
              </label>

              <label className="ventas-create-modal__field">
                <span>Código de caja</span>
                <input
                  type="text"
                  value={createForm.codigo_caja}
                  readOnly
                  disabled
                />
              </label>

              <label className="ventas-create-modal__field">
                <span>Rol operativo</span>
                <select
                  className="ventas-create-modal__select"
                  value={createForm.rol_operativo}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      rol_operativo: event.target.value,
                      id_usuario: ''
                    }))
                  }
                >
                  <option value="RESPONSABLE">Responsable</option>
                  <option value="AUXILIAR">Auxiliar</option>
                </select>
              </label>

              <label className="ventas-create-modal__field">
                <span>Usuario asignado</span>
                <select
                  className="ventas-create-modal__select"
                  value={createForm.id_usuario}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, id_usuario: event.target.value }))
                  }
                  disabled={loadingUsuarios}
                >
                  <option value="">
                    {loadingUsuarios ? 'Cargando usuarios...' : 'Selecciona un usuario'}
                  </option>
                  {usuariosDisponibles.map((usuario) => (
                    <option key={usuario.id_usuario} value={usuario.id_usuario}>
                      {usuario.nombre_completo || usuario.nombre_usuario}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="ventas-create-modal__field">
              <span>Observación de caja</span>
              <textarea
                className="ventas-create-modal__note-input"
                rows="2"
                value={createForm.observacion}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, observacion: event.target.value }))
                }
                placeholder="Notas administrativas opcionales..."
              />
            </label>

            <footer className="ventas-detail-modal__footer">
              <div className="ventas-detail-modal__footer-actions">
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger" disabled={!isCreateValid || saving}>
                  {saving ? 'Guardando...' : 'Crear caja'}
                </button>
              </div>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
