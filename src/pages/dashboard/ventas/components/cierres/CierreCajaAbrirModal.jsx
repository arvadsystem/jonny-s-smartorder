import { useEffect, useMemo, useRef, useState } from 'react';

const initialOpenForm = Object.freeze({
  id_sucursal: '',
  id_caja: '',
  monto_apertura: '',
  observacion_apertura: ''
});

const buildInitialCreateForm = (defaultSucursalId = '') => ({
  id_sucursal: defaultSucursalId || '',
  codigo_caja: '',
  nombre_caja: '',
  observacion: '',
  id_usuario: '',
  rol_operativo: 'RESPONSABLE'
});

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

  useEffect(() => {
    if (!open || mode !== 'existente') return;
    const idSucursalTarget = Number.parseInt(String(openForm.id_sucursal || ''), 10);
    if (!Number.isInteger(idSucursalTarget) || idSucursalTarget <= 0) return;
    if (lastRequestedCajasRef.current === idSucursalTarget) return;
    lastRequestedCajasRef.current = idSucursalTarget;
    if (typeof onRequestCajas === 'function') {
      void Promise.resolve(onRequestCajas(idSucursalTarget)).catch(() => {});
    }
  }, [mode, onRequestCajas, open, openForm.id_sucursal]);

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
    if (open) return;
    lastRequestedUsuariosKeyRef.current = null;
    lastRequestedCajasRef.current = null;
  }, [open]);

  const isOpenValid = useMemo(() => {
    const monto = Number(openForm.monto_apertura);
    const hasSucursal =
      !canSelectSucursal || Number.parseInt(String(openForm.id_sucursal || ''), 10) > 0;
    return hasSucursal && Boolean(openForm.id_caja) && Number.isFinite(monto) && monto >= 0;
  }, [canSelectSucursal, openForm.id_caja, openForm.id_sucursal, openForm.monto_apertura]);

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
      await onSubmitOpenSesion({
        id_sucursal: Number.parseInt(String(openForm.id_sucursal || ''), 10) || null,
        id_caja: Number(openForm.id_caja),
        monto_apertura: Number(openForm.monto_apertura),
        observacion_apertura: openForm.observacion_apertura.trim() || null
      });
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
        codigo_caja: createForm.codigo_caja.trim() || null,
        nombre_caja: createForm.nombre_caja.trim(),
        observacion: createForm.observacion.trim() || null,
        asignacion_inicial: {
          id_usuario: idUsuario,
          puede_responsable: createForm.rol_operativo === 'RESPONSABLE',
          puede_auxiliar: createForm.rol_operativo === 'AUXILIAR',
          observacion: 'Asignacion inicial desde nueva caja'
        }
      });
    } catch {
      // El hook ya muestra toast; evitamos uncaught promise.
    }
  };

  return (
    <div className="ventas-modal-backdrop" onClick={onClose}>
      <section
        className="ventas-modal cierres-caja-action-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="ventas-modal__header">
          <div className="ventas-modal__title-wrap">
            <span className="ventas-modal__icon">
              <i className="bi bi-safe2-fill" />
            </span>
            <div>
              <h3>{mode === 'nueva' ? 'Nueva caja' : 'Abrir sesion'}</h3>
              <p>
                {mode === 'nueva'
                  ? 'Crea una caja nueva y deja su asignacion operativa configurada.'
                  : 'Abre una sesion sobre una caja existente.'}
              </p>
            </div>
          </div>
          <button type="button" className="ventas-modal__close-btn" onClick={onClose} aria-label="Cerrar">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        {mode === 'existente' ? (
          <form className="ventas-modal__body cierres-caja-action-modal__body" onSubmit={submitExisting}>
            {canSelectSucursal ? (
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
                    {caja.nombre_caja} ({caja.codigo_caja || 'Sin codigo'})
                  </option>
                ))}
              </select>
            </label>

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
              <span>Observacion de apertura</span>
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
                  {saving ? 'Guardando...' : 'Abrir sesion'}
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
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, nombre_caja: event.target.value }))
                  }
                  placeholder="Caja principal"
                />
              </label>

              <label className="ventas-create-modal__field">
                <span>Codigo de caja</span>
                <input
                  type="text"
                  value={createForm.codigo_caja}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, codigo_caja: event.target.value }))
                  }
                  placeholder="CAJA-01"
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
              <span>Observacion de caja</span>
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
