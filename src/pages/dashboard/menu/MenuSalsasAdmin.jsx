import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../services/api';
import MenuActionToast from './components/MenuActionToast';

const createLocalRule = () => ({
  id_local: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  min_unidades: '1',
  max_unidades: '',
  salsas_requeridas: '1'
});

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toIntOrNull = (value, options = {}) => {
  if (value === null || value === undefined || value === '') return options.allowNull ? null : null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  return parsed;
};

const parseBool = (value) => {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'si', 'activo', 'activa'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'inactivo', 'inactiva'].includes(normalized)) return false;
  return null;
};

const isRowActive = (value) => {
  const parsed = parseBool(value);
  return parsed === null ? true : parsed;
};

const DEFAULT_FORM = Object.freeze({
  nombre: '',
  nivel_picante: '1',
  orden: ''
});

const MenuSalsasAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [savingSalsa, setSavingSalsa] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [salsas, setSalsas] = useState([]);
  const [recetas, setRecetas] = useState([]);

  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingSalsaId, setEditingSalsaId] = useState(null);

  const [selectedRecetaId, setSelectedRecetaId] = useState('');
  const [selectedSauceIds, setSelectedSauceIds] = useState([]);
  const [rules, setRules] = useState([createLocalRule()]);

  const activeSalsas = useMemo(
    () => salsas.filter((row) => isRowActive(row?.estado)),
    [salsas]
  );

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [salsasRows, recetasRows] = await Promise.all([
        apiFetch('/api/admin/salsas?include_inactive=1', 'GET', null, { noCache: true }),
        apiFetch('/api/admin/salsas/catalogos/recetas', 'GET', null, { noCache: true })
      ]);

      const normalizedSalsas = Array.isArray(salsasRows) ? salsasRows : [];
      const normalizedRecetas = Array.isArray(recetasRows) ? recetasRows : [];

      setSalsas(normalizedSalsas);
      setRecetas(normalizedRecetas);

      setSelectedRecetaId((current) => {
        if (normalizedRecetas.some((row) => String(row?.id_receta) === String(current))) {
          return current;
        }
        return normalizedRecetas[0]?.id_receta ? String(normalizedRecetas[0].id_receta) : '';
      });
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el modulo de salsas.');
      setSalsas([]);
      setRecetas([]);
      setSelectedRecetaId('');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecipeConfig = useCallback(async (idReceta) => {
    const id = toPositiveInt(idReceta);
    if (!id) {
      setSelectedSauceIds([]);
      setRules([createLocalRule()]);
      return;
    }

    try {
      setError('');
      const response = await apiFetch(`/api/admin/salsas/recetas/${id}/config`, 'GET', null, { noCache: true });
      const assigned = Array.isArray(response?.salsas_asignadas)
        ? response.salsas_asignadas.map((row) => Number(row)).filter((row) => Number.isInteger(row) && row > 0)
        : [];
      const incomingRules = Array.isArray(response?.reglas) ? response.reglas : [];

      setSelectedSauceIds(assigned);
      setRules(
        incomingRules.length > 0
          ? incomingRules.map((rule) => ({
            id_local: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            min_unidades: String(rule?.min_unidades ?? 1),
            max_unidades: rule?.max_unidades === null || rule?.max_unidades === undefined ? '' : String(rule.max_unidades),
            salsas_requeridas: String(rule?.salsas_requeridas ?? 0)
          }))
          : [createLocalRule()]
      );
    } catch (e) {
      setError(e?.message || 'No se pudo cargar la configuracion de salsas por receta.');
      setSelectedSauceIds([]);
      setRules([createLocalRule()]);
    }
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!selectedRecetaId) return;
    void loadRecipeConfig(selectedRecetaId);
  }, [loadRecipeConfig, selectedRecetaId]);

  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
    setEditingSalsaId(null);
  }, []);

  const onChangeForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const onSubmitSalsa = async (event) => {
    event.preventDefault();

    const payload = {
      nombre: String(form.nombre || '').trim(),
      nivel_picante: toIntOrNull(form.nivel_picante, { min: 0, max: 10 }),
      orden: toIntOrNull(form.orden, { min: 0, max: 9999, allowNull: true })
    };

    if (!payload.nombre) {
      setError('Nombre de salsa es obligatorio.');
      return;
    }
    if (payload.nivel_picante === null) {
      setError('Nivel picante debe ser entero entre 0 y 10.');
      return;
    }
    if (form.orden !== '' && payload.orden === null) {
      setError('Orden debe ser entero positivo o 0.');
      return;
    }

    try {
      setSavingSalsa(true);
      setError('');

      if (editingSalsaId) {
        await apiFetch(`/api/admin/salsas/${editingSalsaId}`, 'PUT', payload);
        setSuccess('Salsa actualizada correctamente.');
      } else {
        await apiFetch('/api/admin/salsas', 'POST', payload);
        setSuccess('Salsa creada correctamente.');
      }

      resetForm();
      await loadBase();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar la salsa.');
    } finally {
      setSavingSalsa(false);
    }
  };

  const onEditSalsa = (salsa) => {
    setEditingSalsaId(Number(salsa?.id_salsa || 0) || null);
    setForm({
      nombre: String(salsa?.nombre || ''),
      nivel_picante: String(Number(salsa?.nivel_picante || 0)),
      orden: salsa?.orden === null || salsa?.orden === undefined ? '' : String(salsa.orden)
    });
  };

  const onToggleSalsaEstado = async (salsa) => {
    const idSalsa = toPositiveInt(salsa?.id_salsa);
    if (!idSalsa) return;

    try {
      setError('');
      const nextEstado = !isRowActive(salsa?.estado);
      await apiFetch(`/api/admin/salsas/${idSalsa}/estado`, 'PATCH', { estado: nextEstado });
      setSuccess(nextEstado ? 'Salsa activada correctamente.' : 'Salsa inactivada correctamente.');
      await loadBase();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar estado de la salsa.');
    }
  };

  const onToggleAssignedSauce = (idSalsa) => {
    const parsedId = toPositiveInt(idSalsa);
    if (!parsedId) return;

    setSelectedSauceIds((current) => (
      current.includes(parsedId)
        ? current.filter((value) => value !== parsedId)
        : [...current, parsedId]
    ));
  };

  const onChangeRule = (idLocal, field, value) => {
    setRules((current) => current.map((rule) => (
      rule.id_local === idLocal
        ? { ...rule, [field]: value }
        : rule
    )));
  };

  const onAddRule = () => {
    setRules((current) => [...current, createLocalRule()]);
  };

  const onRemoveRule = (idLocal) => {
    setRules((current) => {
      const next = current.filter((rule) => rule.id_local !== idLocal);
      return next.length > 0 ? next : [createLocalRule()];
    });
  };

  const normalizeRulesForSave = () => {
    const output = [];
    for (let index = 0; index < rules.length; index += 1) {
      const row = rules[index];
      const min = toIntOrNull(row.min_unidades, { min: 1, max: 9999 });
      const max = row.max_unidades === '' || row.max_unidades === null || row.max_unidades === undefined
        ? null
        : toIntOrNull(row.max_unidades, { min: 1, max: 9999, allowNull: true });
      const required = toIntOrNull(row.salsas_requeridas, { min: 0, max: 99 });

      if (min === null) {
        return { ok: false, message: `Regla #${index + 1}: min_unidades debe ser entero >= 1.` };
      }
      if (row.max_unidades !== '' && max === null) {
        return { ok: false, message: `Regla #${index + 1}: max_unidades debe ser entero >= 1 o vacio.` };
      }
      if (max !== null && max < min) {
        return { ok: false, message: `Regla #${index + 1}: max_unidades no puede ser menor a min_unidades.` };
      }
      if (required === null) {
        return { ok: false, message: `Regla #${index + 1}: salsas_requeridas debe ser entero >= 0.` };
      }

      output.push({
        min_unidades: min,
        max_unidades: max,
        salsas_requeridas: required
      });
    }

    return { ok: true, data: output };
  };

  const onSaveRecipeConfig = async () => {
    const idReceta = toPositiveInt(selectedRecetaId);
    if (!idReceta) {
      setError('Selecciona una receta para guardar configuracion de salsas.');
      return;
    }

    const normalizedRules = normalizeRulesForSave();
    if (!normalizedRules.ok) {
      setError(normalizedRules.message);
      return;
    }

    try {
      setSavingConfig(true);
      setError('');
      await apiFetch(`/api/admin/salsas/recetas/${idReceta}/config`, 'PUT', {
        salsas_asignadas: [...new Set(selectedSauceIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))],
        reglas: normalizedRules.data
      });

      setSuccess('Configuracion de salsas guardada correctamente.');
      await loadRecipeConfig(idReceta);
    } catch (e) {
      setError(e?.message || 'No se pudo guardar configuracion de salsas por receta.');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <>
      <div className="card shadow-sm mb-3 inv-prod-card">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-droplet inv-prod-title-icon" />
              <span className="inv-prod-title">Salsas</span>
            </div>
            <div className="inv-prod-subtitle">
              Crea y administra salsas del menu, con nivel picante y orden operativo.
            </div>
          </div>
          <div className="inv-prod-header-actions">
            <span className="inv-prod-active-filter-pill">{salsas.length} salsas</span>
            <button
              type="button"
              className="btn inv-prod-toolbar-btn"
              onClick={() => void loadBase()}
              disabled={loading || savingSalsa || savingConfig}
            >
              Recargar
            </button>
          </div>
        </div>

        <div className="card-body">
          {error ? <div className="alert alert-danger mb-3">{error}</div> : null}
          {success ? <div className="alert alert-success mb-3">{success}</div> : null}

          <div className="row g-3">
            <div className="col-lg-4">
              <form className="border rounded-3 p-3 h-100" onSubmit={onSubmitSalsa}>
                <h6 className="mb-3">{editingSalsaId ? `Editar salsa #${editingSalsaId}` : 'Nueva salsa'}</h6>

                <div className="mb-2">
                  <label className="form-label" htmlFor="menu_salsa_nombre">Nombre</label>
                  <input
                    id="menu_salsa_nombre"
                    type="text"
                    className="form-control"
                    name="nombre"
                    value={form.nombre}
                    onChange={onChangeForm}
                    placeholder="Ej: Buffalo"
                    maxLength={120}
                    required
                  />
                </div>

                <div className="row g-2">
                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="menu_salsa_picante">Nivel picante</label>
                    <input
                      id="menu_salsa_picante"
                      type="number"
                      className="form-control"
                      name="nivel_picante"
                      value={form.nivel_picante}
                      onChange={onChangeForm}
                      min={0}
                      max={10}
                      required
                    />
                  </div>

                  <div className="col-sm-6">
                    <label className="form-label" htmlFor="menu_salsa_orden">Orden</label>
                    <input
                      id="menu_salsa_orden"
                      type="number"
                      className="form-control"
                      name="orden"
                      value={form.orden}
                      onChange={onChangeForm}
                      min={0}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button
                    type="submit"
                    className="btn inv-prod-btn-primary"
                    disabled={savingSalsa}
                  >
                    {savingSalsa ? 'Guardando...' : editingSalsaId ? 'Actualizar' : 'Crear salsa'}
                  </button>
                  {editingSalsaId ? (
                    <button
                      type="button"
                      className="btn inv-prod-btn-subtle"
                      onClick={resetForm}
                      disabled={savingSalsa}
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="col-lg-8">
              <div className="table-responsive border rounded-3">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Salsa</th>
                      <th>Picante</th>
                      <th>Orden</th>
                      <th>Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salsas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-3">
                          {loading ? 'Cargando salsas...' : 'No hay salsas registradas.'}
                        </td>
                      </tr>
                    ) : (
                      salsas.map((row) => {
                        const isActive = isRowActive(row?.estado);
                        return (
                          <tr key={`salsa-${row.id_salsa}`}>
                            <td>#{row.id_salsa}</td>
                            <td>{row.nombre}</td>
                            <td>{Number(row?.nivel_picante || 0)}</td>
                            <td>{Number(row?.orden || 0)}</td>
                            <td>
                              <span className={`menu-recetas-admin__estado-badge ${isActive ? 'is-active' : 'is-inactive'}`}>
                                {isActive ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-inline-flex gap-2">
                                <button
                                  type="button"
                                  // Reutiliza el estilo de accion "Editar" del modulo Inventarios/Categorias.
                                  className="inv-catpro-action edit inv-catpro-action-compact menu-recetas-admin__edit-action"
                                  onClick={() => onEditSalsa(row)}
                                  title="Editar"
                                >
                                  <i className="bi bi-pencil-square" aria-hidden="true" />
                                  <span className="inv-catpro-action-label">Editar</span>
                                </button>
                                <button
                                  type="button"
                                  // Reutiliza la accion de estado de Inventarios/Categorias para inactivar/activar.
                                  className={`inv-catpro-action ${isActive ? 'state-off' : 'state-on'} inv-catpro-action-compact menu-recetas-admin__state-action`}
                                  onClick={() => void onToggleSalsaEstado(row)}
                                  title={isActive ? 'Inactivar' : 'Activar'}
                                >
                                  <i className={`bi ${isActive ? 'bi-slash-circle' : 'bi-check-circle'}`} aria-hidden="true" />
                                  <span className="inv-catpro-action-label">{isActive ? 'Inactivar' : 'Activar'}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3 inv-prod-card">
        <div className="card-header inv-prod-header">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-sliders inv-prod-title-icon" />
              <span className="inv-prod-title">Salsas Por Receta</span>
            </div>
            <div className="inv-prod-subtitle">
              Define salsas permitidas y reglas (ejemplo: 6=1, 12=2, 18=3, 24=4, 30=5).
            </div>
          </div>
        </div>

        <div className="card-body">
          <div className="row g-3">
            <div className="col-lg-4">
              <div className="border rounded-3 p-3 h-100">
                <div className="mb-2">
                  <label className="form-label" htmlFor="menu_salsas_receta_select">Receta</label>
                  <select
                    id="menu_salsas_receta_select"
                    className="form-select"
                    value={selectedRecetaId}
                    onChange={(event) => setSelectedRecetaId(event.target.value)}
                    disabled={loading || recetas.length === 0}
                  >
                    <option value="">Selecciona receta</option>
                    {recetas.map((receta) => (
                      <option key={`salsa-receta-${receta.id_receta}`} value={String(receta.id_receta)}>
                        #{receta.id_receta} - {receta.nombre_receta}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="small text-muted mb-2">
                  {selectedSauceIds.length} salsa(s) permitida(s)
                </div>

                <div className="border rounded-2 p-2" style={{ maxHeight: 250, overflowY: 'auto' }}>
                  {activeSalsas.length === 0 ? (
                    <div className="text-muted small">No hay salsas activas disponibles.</div>
                  ) : (
                    activeSalsas.map((salsa) => {
                      const idSalsa = Number(salsa.id_salsa);
                      const checked = selectedSauceIds.includes(idSalsa);
                      return (
                        <div key={`assign-${idSalsa}`} className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`assign_salsa_${idSalsa}`}
                            checked={checked}
                            onChange={() => onToggleAssignedSauce(idSalsa)}
                          />
                          <label className="form-check-label" htmlFor={`assign_salsa_${idSalsa}`}>
                            {salsa.nombre} <span className="text-muted">(Picante {Number(salsa.nivel_picante || 0)})</span>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="border rounded-3 p-3 h-100">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0">Reglas de salsas por unidades</h6>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onAddRule}>
                    Agregar regla
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Desde</th>
                        <th>Hasta</th>
                        <th>Salsas requeridas</th>
                        <th className="text-end">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule.id_local}>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              min={1}
                              value={rule.min_unidades}
                              onChange={(event) => onChangeRule(rule.id_local, 'min_unidades', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              min={1}
                              placeholder="Sin maximo"
                              value={rule.max_unidades}
                              onChange={(event) => onChangeRule(rule.id_local, 'max_unidades', event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              min={0}
                              value={rule.salsas_requeridas}
                              onChange={(event) => onChangeRule(rule.id_local, 'salsas_requeridas', event.target.value)}
                            />
                          </td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => onRemoveRule(rule.id_local)}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn inv-prod-btn-primary"
                    onClick={() => void onSaveRecipeConfig()}
                    disabled={savingConfig || !selectedRecetaId}
                  >
                    {savingConfig ? 'Guardando...' : 'Guardar configuracion'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MenuActionToast
        title="Salsas"
        message={toastMessage}
        onClose={() => setToastMessage('')}
      />
    </>
  );
};

export default MenuSalsasAdmin;

