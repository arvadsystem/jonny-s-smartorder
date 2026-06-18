import { useCallback, useEffect, useMemo, useState } from 'react';
import departamentosAdminService from '../../../../services/departamentosAdminService';
import {
  buildDepartamentoPayload,
  countActiveDepartamentoFilters,
  defaultDepartamentoFilters,
  emptyDepartamentoForm,
  normalizeDepartamentoCode,
  normalizeDepartamentoForForm,
  normalizeRows,
  resolveDepartamentoActivo,
  sortDepartamentos,
  validateDepartamentoForm
} from '../utils/departamentosAdminUtils';

const useDepartamentosAdmin = () => {
  const [departamentos, setDepartamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resultModal, setResultModal] = useState({ open: false, variant: 'success', message: '' });
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [editingOriginal, setEditingOriginal] = useState(null);
  const [form, setForm] = useState({ ...emptyDepartamentoForm });
  const [codeTouched, setCodeTouched] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ ...defaultDepartamentoFilters });
  const [filtersDraft, setFiltersDraft] = useState({ ...defaultDepartamentoFilters });
  const [viewMode, setViewMode] = useState('cards');

  const showSaveResult = useCallback((variant, message) => {
    const safeMessage = String(message || '').trim();
    if (variant === 'success') {
      setSuccess(safeMessage);
      setResultModal((current) => ({ ...current, open: false }));
      return;
    }
    setResultModal({ open: true, variant, message: safeMessage });
  }, []);

  const closeResultModal = useCallback(() => {
    setResultModal((current) => ({ ...current, open: false }));
  }, []);

  const cargarDepartamentos = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await departamentosAdminService.listarDepartamentos();
      setDepartamentos(normalizeRows(response));
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el listado de departamentos.');
      setDepartamentos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargarDepartamentos();
  }, [cargarDepartamentos]);

  const onChangeField = useCallback((event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === 'nombre_departamento') {
        const nextNombre = String(value || '').slice(0, 50);
        return {
          ...prev,
          nombre_departamento: nextNombre,
          codigo_departamento: codeTouched
            ? prev.codigo_departamento
            : normalizeDepartamentoCode(nextNombre)
        };
      }
      if (name === 'codigo_departamento') {
        setCodeTouched(true);
        return {
          ...prev,
          codigo_departamento: normalizeDepartamentoCode(value)
        };
      }
      if (name === 'descripcion') {
        return {
          ...prev,
          descripcion: String(value || '').slice(0, 50)
        };
      }
      return {
        ...prev,
        [name]: value
      };
    });
  }, [codeTouched]);

  const openCreateDrawer = useCallback(() => {
    setFiltersOpen(false);
    setDrawerMode('create');
    setEditingId(null);
    setEditingOriginal(null);
    setForm({ ...emptyDepartamentoForm });
    setCodeTouched(false);
    setDrawerOpen(true);
    setError('');
    setSuccess('');
    closeResultModal();
  }, [closeResultModal]);

  const closeCreateDrawer = useCallback(() => {
    if (saving) return;
    setDrawerOpen(false);
  }, [saving]);

  const openFiltersDrawer = useCallback(() => {
    setDrawerOpen(false);
    setFiltersDraft({ ...filters });
    setFiltersOpen(true);
  }, [filters]);

  const closeFiltersDrawer = useCallback(() => {
    setFiltersOpen(false);
  }, []);

  const onSubmit = useCallback(async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validationMessage = validateDepartamentoForm(form);
    if (validationMessage) {
      showSaveResult('error', validationMessage);
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        const response = await departamentosAdminService.actualizarDepartamento(
          editingId,
          editingOriginal,
          form
        );
        showSaveResult('success', response?.message || 'Departamento actualizado correctamente.');
      } else {
        const response = await departamentosAdminService.crearDepartamento(form);
        showSaveResult('success', response?.message || 'Departamento creado correctamente.');
      }

      setForm({ ...emptyDepartamentoForm });
      setEditingId(null);
      setEditingOriginal(null);
      setDrawerMode('create');
      setDrawerOpen(false);
      setCodeTouched(false);
      await cargarDepartamentos();
    } catch (e) {
      showSaveResult('error', e?.message || 'No se pudo guardar el departamento.');
    } finally {
      setSaving(false);
    }
  }, [cargarDepartamentos, editingId, editingOriginal, form, showSaveResult]);

  const onEditar = useCallback((idDepartamento) => {
    const id = Number(idDepartamento || 0);
    const departamento = departamentos.find((item) => Number(item?.id_tipo_departamento || 0) === id);
    if (!departamento) {
      setError('No se encontro el departamento para edicion.');
      return;
    }

    setDrawerMode('edit');
    setFiltersOpen(false);
    setError('');
    setSuccess('');
    setEditingId(id);
    setEditingOriginal(buildDepartamentoPayload(normalizeDepartamentoForForm(departamento)));
    setForm(normalizeDepartamentoForForm(departamento));
    setCodeTouched(true);
    setDrawerOpen(true);
  }, [departamentos]);

  const onCambiarEstado = useCallback(async (departamento, nextEstado = null) => {
    const departamentoId = Number(departamento?.id_tipo_departamento || 0);
    if (!departamentoId) return;
    const estadoObjetivo =
      typeof nextEstado === 'boolean'
        ? nextEstado
        : !resolveDepartamentoActivo(departamento);

    try {
      setTogglingId(departamentoId);
      setError('');
      setSuccess('');
      await departamentosAdminService.cambiarEstadoDepartamento(departamentoId, estadoObjetivo);
      setSuccess('Estado de departamento actualizado correctamente.');
      await cargarDepartamentos();
    } catch (e) {
      setError(e?.message || 'No se pudo cambiar el estado del departamento.');
    } finally {
      setTogglingId(null);
    }
  }, [cargarDepartamentos]);

  const applyFilters = useCallback(() => {
    setFilters({ ...filtersDraft });
    setFiltersOpen(false);
  }, [filtersDraft]);

  const clearFilters = useCallback(() => {
    const next = { ...defaultDepartamentoFilters };
    setFilters(next);
    setFiltersDraft(next);
    setFiltersOpen(false);
  }, []);

  const setShowInactiveOnly = useCallback((enabled) => {
    const nextEstado = enabled ? 'inactivos' : 'activos';
    setFilters((state) => ({ ...state, estado: nextEstado }));
    setFiltersDraft((state) => ({ ...state, estado: nextEstado }));
  }, []);

  const departamentosFiltrados = useMemo(() => {
    const searchTerm = String(search || '').trim().toLowerCase();
    const filtered = (Array.isArray(departamentos) ? departamentos : []).filter((departamento) => {
      if (filters.estado === 'activos' && !resolveDepartamentoActivo(departamento)) return false;
      if (filters.estado === 'inactivos' && resolveDepartamentoActivo(departamento)) return false;
      if (!searchTerm) return true;

      const idText = String(departamento?.id_tipo_departamento ?? '').toLowerCase();
      const nombre = String(departamento?.nombre_departamento || '').toLowerCase();
      const codigo = String(departamento?.codigo_departamento || '').toLowerCase();
      const descripcion = String(departamento?.descripcion || '').toLowerCase();

      return (
        idText.includes(searchTerm) ||
        nombre.includes(searchTerm) ||
        codigo.includes(searchTerm) ||
        descripcion.includes(searchTerm)
      );
    });

    return sortDepartamentos(filtered, filters.sortBy);
  }, [departamentos, filters.estado, filters.sortBy, search]);

  const activeFiltersCount = useMemo(() => countActiveDepartamentoFilters(filters), [filters]);
  const hasActiveFilters = activeFiltersCount > 0;

  return {
    state: {
      loading,
      saving,
      togglingId,
      error,
      success,
      search,
      drawerOpen,
      drawerMode,
      editingId,
      form,
      filtersOpen,
      filters,
      filtersDraft,
      viewMode,
      resultModal
    },
    derived: {
      departamentosFiltrados,
      activeFiltersCount,
      hasActiveFilters
    },
    actions: {
      setSuccess,
      setSearch,
      setViewMode,
      setFiltersDraft,
      onChangeField,
      openCreateDrawer,
      closeCreateDrawer,
      openFiltersDrawer,
      closeFiltersDrawer,
      onSubmit,
      onEditar,
      onCambiarEstado,
      applyFilters,
      clearFilters,
      setShowInactiveOnly,
      closeResultModal
    }
  };
};

export default useDepartamentosAdmin;
