import { useCallback, useEffect, useMemo, useState } from 'react';
import extrasAdminService from '../../../services/extrasAdminService';
import MenuActionToast from './components/MenuActionToast';
import MenuConfirmDialog from './components/MenuConfirmDialog';

const emptyForm = {
  codigo: '',
  nombre: '',
  precio_adicional: '',
  id_insumo: '',
  cant: '',
  id_unidad_medida: '',
  orden: '0',
  estado: true,
  recetas: []
};

const normalizeRows = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
};

const money = (value) => {
  const parsed = Number(value);
  return `L. ${Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'}`;
};

const buildCode = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ExtrasAdmin = () => {
  const [extras, setExtras] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [toastMessage, setToastMessage] = useState('');
  const [estadoConfirm, setEstadoConfirm] = useState(null);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [extrasResponse, insumosResponse, recetasResponse] = await Promise.all([
        extrasAdminService.listarExtras(),
        extrasAdminService.listarInsumos(),
        extrasAdminService.listarRecetas()
      ]);
      setExtras(normalizeRows(extrasResponse));
      setInsumos(normalizeRows(insumosResponse));
      setRecetas(normalizeRows(recetasResponse));
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los extras.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  const extrasFiltrados = useMemo(() => {
    const term = String(search || '').trim().toLowerCase();
    if (!term) return extras;
    return extras.filter((extra) => (
      String(extra?.nombre || '').toLowerCase().includes(term) ||
      String(extra?.codigo || '').toLowerCase().includes(term) ||
      String(extra?.nombre_insumo || '').toLowerCase().includes(term)
    ));
  }, [extras, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
    setSuccess('');
    setDrawerOpen(true);
  };

  const openEdit = async (idExtra) => {
    try {
      setError('');
      setSuccess('');
      const extra = await extrasAdminService.obtenerExtra(idExtra);
      setEditingId(Number(extra?.id_extra || idExtra));
      setForm({
        codigo: String(extra?.codigo || ''),
        nombre: String(extra?.nombre || ''),
        precio_adicional: String(extra?.precio_adicional ?? ''),
        id_insumo: String(extra?.id_insumo ?? ''),
        cant: String(extra?.cant ?? ''),
        id_unidad_medida: String(extra?.id_unidad_medida ?? ''),
        orden: String(extra?.orden ?? '0'),
        estado: Boolean(extra?.estado ?? true),
        recetas: Array.isArray(extra?.recetas) ? extra.recetas.map((id) => Number(id)) : []
      });
      setDrawerOpen(true);
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el extra.');
    }
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const updateForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'nombre' && !prev.codigo) next.codigo = buildCode(value);
      if (field === 'id_insumo') {
        const selected = insumos.find((item) => String(item.id_insumo) === String(value));
        next.id_unidad_medida = selected?.id_unidad_medida ? String(selected.id_unidad_medida) : '';
      }
      return next;
    });
  };

  const toggleReceta = (idReceta) => {
    setForm((prev) => {
      const id = Number(idReceta);
      const current = new Set(prev.recetas);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, recetas: [...current] };
    });
  };

  const validate = () => {
    if (!String(form.nombre || '').trim()) return 'El nombre del extra es obligatorio.';
    if (!String(form.codigo || '').trim()) return 'El codigo del extra es obligatorio.';
    const price = Number(form.precio_adicional);
    if (!Number.isFinite(price) || price < 0) return 'El precio adicional debe ser mayor o igual a 0.';
    const hasInventory = Boolean(form.id_insumo || form.cant || form.id_unidad_medida);
    if (hasInventory && (!form.id_insumo || !form.cant || !form.id_unidad_medida)) {
      return 'Para enlazar inventario indica insumo, cantidad y unidad.';
    }
    if (form.cant && Number(form.cant) <= 0) return 'La cantidad del insumo debe ser mayor a 0.';
    return '';
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    const payload = {
      codigo: form.codigo,
      nombre: form.nombre,
      precio_adicional: Number(form.precio_adicional),
      id_insumo: form.id_insumo || null,
      cant: form.cant || null,
      id_unidad_medida: form.id_unidad_medida || null,
      orden: Number(form.orden || 0),
      estado: Boolean(form.estado),
      recetas: form.recetas
    };

    try {
      setSaving(true);
      if (editingId) {
        await extrasAdminService.actualizarExtra(editingId, payload);
        setSuccess('Extra actualizado correctamente.');
      } else {
        await extrasAdminService.crearExtra(payload);
        setSuccess('Extra creado correctamente.');
      }
      setDrawerOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      await cargarDatos();
    } catch (e) {
      setError(e?.message || 'No se pudo guardar el extra.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEstado = async (extra) => {
    const idExtra = Number(extra?.id_extra || 0);
    if (!idExtra) return;
    try {
      setError('');
      await extrasAdminService.cambiarEstadoExtra(idExtra, !Boolean(extra.estado));
      setSuccess('Estado del extra actualizado correctamente.');
      await cargarDatos();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado del extra.');
    } finally {
      setEstadoConfirm(null);
    }
  };

  const closeEstadoConfirm = () => {
    if (saving) return;
    setEstadoConfirm(null);
  };

  const estadoConfirmActivo = estadoConfirm ? Boolean(estadoConfirm.estado) : false;
  const estadoConfirmNombre = String(estadoConfirm?.nombre || 'Extra seleccionado');

  return (
    <>
      <div className="menu-recetas-admin-page">
        <div className="card shadow-sm mb-3 inv-prod-card menu-recetas-admin">
          <div className="card-header inv-prod-header">
            <div className="inv-prod-title-wrap">
              <div className="inv-prod-title-row">
                <i className="bi bi-plus-square-dotted inv-prod-title-icon" />
                <span className="inv-prod-title">Extras</span>
              </div>
              <div className="inv-prod-subtitle">Opciones adicionales con precio e insumo asociado.</div>
            </div>

            <div className="inv-prod-header-actions inv-ins-header-actions menu-toolbar-actions">
              <label className="inv-ins-search menu-toolbar-search" aria-label="Buscar extras">
                <i className="bi bi-search" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar extra, codigo o insumo..."
                />
              </label>
              <button type="button" className="inv-prod-toolbar-btn" onClick={openCreate}>
                <i className="bi bi-plus-circle" />
                <span>Nuevo extra</span>
              </button>
            </div>
          </div>

          <div className="card-body inv-prod-body">
            {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
            {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

            <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
              <span>{extrasFiltrados.length} extras</span>
            </div>

            {loading ? (
              <div className="text-center py-4">Cargando extras...</div>
            ) : (
              <div className="menu-extras-admin__grid">
                {extrasFiltrados.map((extra) => (
                  <article
                    className={`menu-extras-card ${extra.estado ? 'is-active' : 'is-inactive'}`}
                    key={extra.id_extra}
                  >
                    <header className="menu-extras-card__head">
                      <span className={`menu-recetas-admin__estado-badge ${extra.estado ? 'is-active' : 'is-inactive'}`}>
                        {extra.estado ? 'Activo' : 'Inactivo'}
                      </span>
                      <strong>{money(extra.precio_adicional)}</strong>
                    </header>
                    <div className="menu-extras-card__body">
                      <h6>{extra.nombre}</h6>
                      <p>{extra.codigo}</p>
                      <div className="menu-extras-card__meta">
                        <span>Insumo</span>
                        <strong>{extra.nombre_insumo || 'Sin insumo'}</strong>
                      </div>
                      <div className="menu-extras-card__meta">
                        <span>Cantidad</span>
                        <strong>
                          {extra.cant ? `${extra.cant} ${String(extra.unidad_simbolo || extra.unidad_nombre || '').trim()}` : 'No aplica'}
                        </strong>
                      </div>
                      <div className="menu-extras-card__meta">
                        <span>Recetas</span>
                        <strong>{Number(extra.total_recetas || 0)}</strong>
                      </div>
                    </div>
                    <footer className="menu-recetas-card__actions">
                      <button type="button" className="inv-catpro-action edit inv-catpro-action-compact" onClick={() => openEdit(extra.id_extra)}>
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button
                        type="button"
                        className={`inv-catpro-action ${extra.estado ? 'state-off' : 'state-on'} inv-catpro-action-compact`}
                        onClick={() => setEstadoConfirm(extra)}
                      >
                        <i className={`bi ${extra.estado ? 'bi-slash-circle' : 'bi-check-circle'}`} />
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="inv-prod-pmodal inv-prod-pmodal--create show">
          <div className="inv-prod-pmodal__overlay" onClick={closeDrawer} />
          <div className="inv-prod-pmodal__viewport">
            <section
              className="inv-prod-pmodal__panel inv-prod-pmodal__panel--create"
              role="dialog"
              aria-modal="true"
              aria-labelledby="menu-extras-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <form className="inv-prod-pmodal__form-shell inv-prod-pmodal__form-shell--create menu-recetas-admin__form" onSubmit={submit}>
                <div className="inv-prod-pmodal__body">
                  <div className="inv-ins-create-hero is-create">
                    <button type="button" className="inv-prod-drawer-close inv-ins-create-hero__close" onClick={closeDrawer} aria-label="Cerrar">
                      <i className="bi bi-x-lg" />
                    </button>
                    <div className="inv-ins-create-hero__icon">
                      <i className="bi bi-plus-square-dotted" aria-hidden="true" />
                    </div>
                    <div className="inv-ins-create-hero__copy">
                      <div className="inv-ins-create-hero__kicker">{editingId ? 'Edicion Activa' : 'Nuevo Registro'}</div>
                      <div id="menu-extras-modal-title" className="inv-ins-create-hero__title">
                        {editingId ? `Editar extra #${editingId}` : 'Nuevo extra'}
                      </div>
                    </div>
                  </div>

                  <div className="inv-prod-pmodal__sections mt-3">
                    <section className="inv-prod-pmodal__section">
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label" htmlFor="extra_nombre">Nombre</label>
              <input id="extra_nombre" className="form-control" value={form.nombre} onChange={(event) => updateForm('nombre', event.target.value)} required />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_codigo">Codigo</label>
              <input id="extra_codigo" className="form-control" value={form.codigo} onChange={(event) => updateForm('codigo', event.target.value)} required />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_precio">Precio adicional</label>
              <input id="extra_precio" type="number" min="0" step="0.01" className="form-control" value={form.precio_adicional} onChange={(event) => updateForm('precio_adicional', event.target.value)} required />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="extra_insumo">Insumo que consume</label>
              <select id="extra_insumo" className="form-select" value={form.id_insumo} onChange={(event) => updateForm('id_insumo', event.target.value)}>
                <option value="">Sin insumo asociado</option>
                {insumos.map((insumo) => (
                  <option key={insumo.id_insumo} value={insumo.id_insumo}>{insumo.nombre_insumo}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_cantidad">Cantidad del insumo</label>
              <input id="extra_cantidad" type="number" min="0.0001" step="0.0001" className="form-control" value={form.cant} onChange={(event) => updateForm('cant', event.target.value)} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="extra_unidad">Unidad</label>
              <input
                id="extra_unidad"
                className="form-control"
                value={
                  insumos.find((item) => String(item.id_insumo) === String(form.id_insumo))?.unidad_simbolo ||
                  insumos.find((item) => String(item.id_insumo) === String(form.id_insumo))?.unidad_nombre ||
                  ''
                }
                disabled
                readOnly
              />
            </div>
          </div>
                    </section>

                    <section className="menu-extras-admin__recipes">
            <div className="menu-recetas-admin__detalle-title">Recetas donde aparece</div>
            <div className="menu-extras-admin__recipe-list">
              {recetas.map((receta) => {
                const idReceta = Number(receta.id_receta);
                return (
                  <label className="menu-extras-admin__recipe-option" key={idReceta}>
                    <input
                      type="checkbox"
                      checked={form.recetas.includes(idReceta)}
                      onChange={() => toggleReceta(idReceta)}
                    />
                    <span>{receta.nombre_receta}</span>
                  </label>
                );
              })}
            </div>
                    </section>
                  </div>
                </div>

                <div className="inv-prod-pmodal__footer inv-prod-pmodal__footer--create">
                  <button type="button" className="btn inv-prod-btn-subtle" onClick={closeDrawer} disabled={saving}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn inv-prod-btn-primary" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar extra'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      ) : null}

      <MenuActionToast title="Extras" message={toastMessage} onClose={() => setToastMessage('')} />
      <MenuConfirmDialog
        open={Boolean(estadoConfirm)}
        title={estadoConfirmActivo ? 'Confirmar inactivacion' : 'Confirmar activacion'}
        subtitle={estadoConfirmActivo ? 'El extra dejara de estar disponible' : 'El extra volvera a estar disponible'}
        question={estadoConfirmActivo ? 'Deseas inactivar este extra?' : 'Deseas activar este extra?'}
        itemLabel={estadoConfirmNombre}
        itemIcon={estadoConfirmActivo ? 'bi-slash-circle' : 'bi-check-circle'}
        confirmLabel={estadoConfirmActivo ? 'Inactivar' : 'Activar'}
        confirmingLabel="Procesando..."
        loading={saving}
        onClose={closeEstadoConfirm}
        onConfirm={() => toggleEstado(estadoConfirm)}
      />
    </>
  );
};

export default ExtrasAdmin;
