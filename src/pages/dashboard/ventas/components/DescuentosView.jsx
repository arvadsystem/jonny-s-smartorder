import { useCallback, useEffect, useMemo, useState } from 'react';
import SinPermiso from '../../../../components/common/SinPermiso';
import ventasService from '../../../../services/ventasService';
import { PERMISSIONS } from '../../../../utils/permissions';
import { extractApiMessage } from '../utils/ventasHelpers';

const initialForm = {
  nombre_descuento: '',
  descripcion: '',
  valor_descuento: '',
  id_tipo_descuento: '',
  estado: true
};

function DescuentoFormDrawer({
  open,
  mode,
  form,
  saving,
  tiposDescuento,
  onFieldChange,
  onClose,
  onSubmit,
  errors
}) {
  return (
    <aside
      className={`inv-prod-drawer inv-cat-v2__drawer ${open ? 'show' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
    >
      <div className="inv-prod-drawer-head">
        <i className="bi bi-tags inv-cat-v2__drawer-mark" aria-hidden="true" />
        <div>
          <div className="inv-prod-drawer-title">{mode === 'create' ? 'Nuevo descuento' : 'Editar descuento'}</div>
          <div className="inv-prod-drawer-sub">Configura el descuento del catálogo maestro.</div>
        </div>
        <button type="button" className="inv-prod-drawer-close" onClick={onClose} title="Cerrar" disabled={saving}>
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <form className="inv-prod-drawer-body inv-catpro-drawer-body-lite" onSubmit={onSubmit}>
        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_nombre">Nombre</label>
          <input
            id="descuento_nombre"
            name="nombre_descuento"
            className={`form-control ${errors.nombre_descuento ? 'is-invalid' : ''}`}
            value={form.nombre_descuento}
            onChange={onFieldChange}
            placeholder="Ej: Descuento de temporada"
          />
          {errors.nombre_descuento ? <div className="invalid-feedback d-block">{errors.nombre_descuento}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_tipo">Tipo de descuento</label>
          <select
            id="descuento_tipo"
            name="id_tipo_descuento"
            className={`form-select ${errors.id_tipo_descuento ? 'is-invalid' : ''}`}
            value={form.id_tipo_descuento}
            onChange={onFieldChange}
          >
            <option value="">Selecciona un tipo</option>
            {tiposDescuento.map((tipo) => (
              <option key={tipo.id_tipo_descuento} value={tipo.id_tipo_descuento}>
                {tipo.nombre_tipo_descuento}
              </option>
            ))}
          </select>
          {errors.id_tipo_descuento ? <div className="invalid-feedback d-block">{errors.id_tipo_descuento}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_valor">Valor</label>
          <input
            id="descuento_valor"
            name="valor_descuento"
            type="number"
            min="0"
            step="0.01"
            className={`form-control ${errors.valor_descuento ? 'is-invalid' : ''}`}
            value={form.valor_descuento}
            onChange={onFieldChange}
            placeholder="Ej: 15"
          />
          {errors.valor_descuento ? <div className="invalid-feedback d-block">{errors.valor_descuento}</div> : null}
        </div>

        <div className="mb-2">
          <label className="form-label" htmlFor="descuento_desc">Descripción (opcional)</label>
          <textarea
            id="descuento_desc"
            name="descripcion"
            className="form-control"
            rows={3}
            value={form.descripcion}
            onChange={onFieldChange}
            maxLength={250}
          />
        </div>

        <div className="form-check mt-2 mb-3">
          <input
            className="form-check-input"
            type="checkbox"
            id="descuento_estado"
            name="estado"
            checked={!!form.estado}
            onChange={onFieldChange}
          />
          <label className="form-check-label" htmlFor="descuento_estado">
            Activo
          </label>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn inv-prod-btn-subtle flex-fill" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn inv-prod-btn-primary flex-fill" disabled={saving}>
            {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </form>
    </aside>
  );
}

const normalizeDiscountRow = (row) => ({
  ...row,
  id_descuento_catalogo: Number(row?.id_descuento_catalogo ?? 0) || null,
  id_tipo_descuento: Number(row?.id_tipo_descuento ?? 0) || null,
  nombre_descuento: String(row?.nombre_descuento ?? 'Descuento'),
  descripcion: String(row?.descripcion ?? ''),
  nombre_tipo_descuento: String(row?.nombre_tipo_descuento ?? ''),
  valor_descuento: Number(row?.valor_descuento ?? 0) || 0,
  estado: row?.estado === true || row?.estado === 'true' || row?.estado === 1 || row?.estado === '1'
});

export default function DescuentosView({ canView, canCreate, canEdit, canToggle }) {
  const [rows, setRows] = useState([]);
  const [tiposDescuento, setTiposDescuento] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...initialForm });
  const [formErrors, setFormErrors] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [descuentosResponse, tiposResponse] = await Promise.all([
        ventasService.listDescuentosCatalogosAdmin(),
        ventasService.getTiposDescuentoCatalog()
      ]);
      setRows((Array.isArray(descuentosResponse) ? descuentosResponse : []).map(normalizeDiscountRow));
      setTiposDescuento(
        (Array.isArray(tiposResponse) ? tiposResponse : [])
          .filter((tipo) => tipo && (tipo.estado === true || tipo.estado === 'true' || tipo.estado === 1 || tipo.estado === '1'))
          .map((tipo) => ({
            id_tipo_descuento: Number(tipo.id_tipo_descuento ?? 0) || null,
            nombre_tipo_descuento: String(tipo.nombre_tipo_descuento ?? '')
          }))
          .filter((tipo) => tipo.id_tipo_descuento)
      );
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudo cargar el catálogo de descuentos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canView) return;
    void loadData();
  }, [canView, loadData]);

  const filteredRows = useMemo(() => {
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const haystack = [row.nombre_descuento, row.descripcion, row.nombre_tipo_descuento]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search]);

  const resetForm = () => {
    setForm({ ...initialForm });
    setFormErrors({});
    setEditId(null);
  };

  const openCreate = () => {
    if (!canCreate) return;
    setDrawerMode('create');
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    if (!canEdit) return;
    setDrawerMode('edit');
    setEditId(row.id_descuento_catalogo);
    setFormErrors({});
    setForm({
      nombre_descuento: row.nombre_descuento,
      descripcion: row.descripcion || '',
      valor_descuento: String(row.valor_descuento),
      id_tipo_descuento: String(row.id_tipo_descuento || ''),
      estado: !!row.estado
    });
    setDrawerOpen(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!String(form.nombre_descuento || '').trim()) {
      errors.nombre_descuento = 'El nombre es obligatorio.';
    }

    const valor = Number(form.valor_descuento);
    if (!Number.isFinite(valor) || valor <= 0) {
      errors.valor_descuento = 'El valor debe ser mayor a 0.';
    }

    if (!Number(form.id_tipo_descuento)) {
      errors.id_tipo_descuento = 'Selecciona un tipo de descuento.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre_descuento: String(form.nombre_descuento || '').trim(),
        descripcion: String(form.descripcion || '').trim() || null,
        valor_descuento: Number(form.valor_descuento),
        id_tipo_descuento: Number(form.id_tipo_descuento),
        estado: !!form.estado
      };

      if (drawerMode === 'create') {
        await ventasService.createDescuentoCatalogo(payload);
      } else {
        await ventasService.updateDescuentoCatalogo(editId, payload);
      }

      setDrawerOpen(false);
      await loadData();
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudo guardar el descuento de catálogo.'));
    } finally {
      setSaving(false);
    }
  };

  const onFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const onToggleEstado = async (row, nextEstado) => {
    if (!canToggle) return;
    try {
      await ventasService.toggleDescuentoCatalogoEstado(row.id_descuento_catalogo, !!nextEstado);
      await loadData();
    } catch (err) {
      setError(extractApiMessage(err, 'No se pudo cambiar el estado del descuento.'));
    }
  };

  if (!canView) {
    return <SinPermiso permiso={PERMISSIONS.VENTAS_DESCUENTOS_CATALOGO_VER} />;
  }

  return (
    <div className="ventas-page ventas-descuentos-page">
      <div className="inv-catpro-card inv-prod-card mb-3">
        <div className="inv-prod-header ventas-page__toolbar">
          <div className="inv-prod-title-wrap">
            <div className="inv-prod-title-row">
              <i className="bi bi-tags inv-prod-title-icon" />
              <span className="inv-prod-title">Descuentos</span>
            </div>
            <div className="inv-prod-subtitle">Catálogo maestro de descuentos para Caja.</div>
          </div>

          <div className="inv-prod-header-actions inv-ins-header-actions ventas-page__toolbar-actions">
            <label className="inv-ins-search" aria-label="Buscar descuentos">
              <i className="bi bi-search" />
              <input
                type="search"
                placeholder="Buscar por nombre, tipo o descripción..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            {canCreate ? (
              <button type="button" className="inv-prod-toolbar-btn" onClick={openCreate}>
                <i className="bi bi-plus-circle" />
                <span>Nuevo descuento</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="d-flex align-items-center gap-2 p-3">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              <span>Cargando descuentos...</span>
            </div>
          ) : (
            <div className="ventas-page__table-card">
              <div className="ventas-page__table-wrap">
                <table className="table align-middle ventas-page__table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Estado</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4">No hay descuentos en el catálogo.</td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.id_descuento_catalogo} className="ventas-page__table-row">
                          <td>
                            <div className="ventas-page__table-sale">
                              <strong>{row.nombre_descuento}</strong>
                              <span>{row.descripcion || 'Sin descripción'}</span>
                            </div>
                          </td>
                          <td>{row.nombre_tipo_descuento}</td>
                          <td>{Number(row.valor_descuento).toFixed(2)}</td>
                          <td>
                            <span className={`ventas-page__table-pill ${row.estado ? '' : 'is-soft-muted'}`}>
                              {row.estado ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex align-items-center justify-content-end gap-2">
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="ventas-page__table-detail-btn"
                                  onClick={() => openEdit(row)}
                                  title="Editar"
                                >
                                  <i className="bi bi-pencil" />
                                </button>
                              ) : null}

                              {canToggle ? (
                                <button
                                  type="button"
                                  className="ventas-page__table-detail-btn"
                                  onClick={() => onToggleEstado(row, !row.estado)}
                                  title={row.estado ? 'Inactivar' : 'Activar'}
                                >
                                  <i className={`bi ${row.estado ? 'bi-toggle-on' : 'bi-toggle-off'}`} />
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
            </div>
          )}
        </div>
      </div>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${drawerOpen ? 'show' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />

      <DescuentoFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        form={form}
        saving={saving}
        tiposDescuento={tiposDescuento}
        onFieldChange={onFieldChange}
        onClose={() => setDrawerOpen(false)}
        onSubmit={onSubmit}
        errors={formErrors}
      />
    </div>
  );
}
