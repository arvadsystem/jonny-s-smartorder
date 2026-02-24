import { useEffect, useMemo, useRef, useState } from 'react';
import SucursalesCardsCarousel from './components/SucursalesCardsCarousel';
import SucursalDeleteConfirm from './components/SucursalDeleteConfirm';
import SucursalFormDrawer from './components/SucursalFormDrawer';
import SucursalesFiltersDrawer from './components/SucursalesFiltersDrawer';
import SucursalesStats from './components/SucursalesStats';
import SucursalesToast from './components/SucursalesToast';
import SucursalesToolbar from './components/SucursalesToolbar';
import { useSucursales } from './hooks/useSucursales';
import './styles/sucursales.css';
import {
  extractApiMessage,
  inferDuplicateFieldErrors,
  initialSucursalForm,
  normalizeDateForInput,
  parseEstado,
  resolveCardsPerPage,
  validateSucursalForm
} from './utils/sucursalHelpers';

const createInitialFiltersDraft = () => ({
  estadoFiltro: 'todos',
  sortBy: 'recientes'
});

export default function SucursalesPage() {
  const {
    sucursales,
    loading,
    error,
    setError,
    saving,
    deletingId,
    togglingEstadoId,
    toast,
    openToast,
    closeToast,
    createSucursal,
    updateSucursal,
    toggleSucursalEstado,
    deleteSucursal
  } = useSucursales();

  const [search, setSearch] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [sortBy, setSortBy] = useState('recientes');
  const [filtersDraft, setFiltersDraft] = useState(createInitialFiltersDraft);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...initialSucursalForm });
  const [formErrors, setFormErrors] = useState({});

  const [confirmDelete, setConfirmDelete] = useState({
    show: false,
    sucursal: null
  });

  const [cardsPerPage, setCardsPerPage] = useState(() =>
    typeof window === 'undefined' ? 6 : resolveCardsPerPage(window.innerWidth)
  );
  const [isResponsiveViewport, setIsResponsiveViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth <= 991.98
  );
  const carouselRef = useRef(null);

  useEffect(() => {
    const onResize = () => {
      setCardsPerPage(resolveCardsPerPage(window.innerWidth));
      setIsResponsiveViewport(window.innerWidth <= 991.98);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const stats = useMemo(() => {
    const total = Array.isArray(sucursales) ? sucursales.length : 0;
    const activas = (sucursales || []).filter((item) => parseEstado(item?.estado)).length;
    return { total, activas, inactivas: total - activas };
  }, [sucursales]);

  const filteredSucursales = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = [...(Array.isArray(sucursales) ? sucursales : [])];
    list.sort((a, b) => Number(b?.id_sucursal ?? 0) - Number(a?.id_sucursal ?? 0));

    const filtered = list.filter((s) => {
      const isActive = parseEstado(s?.estado);
      const matchEstado = estadoFiltro === 'todos' ? true : estadoFiltro === 'activo' ? isActive : !isActive;
      if (!matchEstado) return false;

      if (!needle) return true;
      const hay = [
        s?.nombre_sucursal,
        s?.texto_direccion,
        s?.texto_telefono,
        s?.texto_correo,
        s?.antiguedad_calculada,
        s?.antiguedad,
        s?.antiguedad_texto
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return hay.includes(needle);
    });

    filtered.sort((a, b) => {
      if (sortBy === 'nombre_asc') {
        return String(a?.nombre_sucursal ?? '').localeCompare(String(b?.nombre_sucursal ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'nombre_desc') {
        return String(b?.nombre_sucursal ?? '').localeCompare(String(a?.nombre_sucursal ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'direccion_asc') {
        return String(a?.texto_direccion ?? '').localeCompare(String(b?.texto_direccion ?? ''), 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'direccion_desc') {
        return String(b?.texto_direccion ?? '').localeCompare(String(a?.texto_direccion ?? ''), 'es', { sensitivity: 'base' });
      }
      return Number(b?.id_sucursal ?? 0) - Number(a?.id_sucursal ?? 0);
    });

    return filtered;
  }, [sucursales, search, estadoFiltro, sortBy]);

  const hasActiveFilters = useMemo(
    () => search.trim() !== '' || estadoFiltro !== 'todos' || sortBy !== 'recientes',
    [search, estadoFiltro, sortBy]
  );

  const pages = useMemo(() => {
    const size = Math.max(1, cardsPerPage);
    const result = [];
    for (let i = 0; i < filteredSucursales.length; i += size) {
      result.push(filteredSucursales.slice(i, i + size));
    }
    return result;
  }, [filteredSucursales, cardsPerPage]);

  const duplicateErrors = useMemo(() => {
    const validation = validateSucursalForm({ form, sucursales, mode: drawerMode, editId });
    return {
      nombre_sucursal: validation.duplicates.nombre_sucursal ? validation.errors.nombre_sucursal : '',
      texto_direccion: validation.duplicates.texto_direccion ? validation.errors.texto_direccion : ''
    };
  }, [form, sucursales, drawerMode, editId]);

  const hasLiveDuplicates = Boolean(duplicateErrors.nombre_sucursal || duplicateErrors.texto_direccion);
  const isAnyDrawerOpen = drawerOpen || filtersOpen;
  const canTapCardToEdit = !isResponsiveViewport;

  const resetFormState = () => {
    setForm({ ...initialSucursalForm });
    setFormErrors({});
    setEditId(null);
  };

  const openCreate = () => {
    setFiltersOpen(false);
    setDrawerMode('create');
    resetFormState();
    setDrawerOpen(true);
  };

  const openEdit = (sucursal) => {
    setFiltersOpen(false);
    setDrawerMode('edit');
    setEditId(Number(sucursal?.id_sucursal ?? 0) || null);
    setFormErrors({});
    setForm({
      id_sucursal: sucursal?.id_sucursal ?? null,
      nombre_sucursal: String(sucursal?.nombre_sucursal ?? ''),
      texto_direccion: String(sucursal?.texto_direccion ?? ''),
      texto_telefono: String(sucursal?.texto_telefono ?? ''),
      texto_correo: String(sucursal?.texto_correo ?? ''),
      fecha_inauguracion: normalizeDateForInput(sucursal?.fecha_inauguracion),
      estado: parseEstado(sucursal?.estado)
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
  };

  const closeFiltersDrawer = () => setFiltersOpen(false);

  const closeAnyDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setFiltersOpen(false);
  };

  const openFiltersDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setFiltersDraft({ estadoFiltro, sortBy });
    setFiltersOpen(true);
  };

  const applyFiltersDrawer = () => {
    setEstadoFiltro(filtersDraft.estadoFiltro || 'todos');
    setSortBy(filtersDraft.sortBy || 'recientes');
    setFiltersOpen(false);
  };

  const clearVisualFilters = () => {
    setEstadoFiltro('todos');
    setSortBy('recientes');
    setFiltersDraft(createInitialFiltersDraft());
  };

  const clearAllFilters = () => {
    setSearch('');
    clearVisualFilters();
    setFiltersOpen(false);
  };

  const onFieldChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (name) {
      setFormErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
    }
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setError('');

    const validation = validateSucursalForm({ form, sucursales, mode: drawerMode, editId });
    setFormErrors(validation.errors);
    if (!validation.ok) return;

    try {
      if (drawerMode === 'create') {
        await createSucursal(validation.payload);
      } else {
        await updateSucursal(editId, validation.payload);
      }
      setDrawerOpen(false);
      setFormErrors({});
    } catch (err) {
      const duplicateFieldErrors = inferDuplicateFieldErrors(err);
      if (Object.keys(duplicateFieldErrors).length > 0) {
        setFormErrors((prev) => ({ ...prev, ...duplicateFieldErrors }));
      }

      const msg = extractApiMessage(
        err,
        drawerMode === 'create' ? 'NO SE PUDO CREAR LA SUCURSAL' : 'NO SE PUDO ACTUALIZAR LA SUCURSAL'
      );
      openToast('ERROR', msg, Number(err?.status || 0) === 409 ? 'warning' : 'danger');
    }
  };

  const onQuickToggleEstado = async (sucursal, nextEstado) => {
    try {
      await toggleSucursalEstado(sucursal, nextEstado);
    } catch {
      // El hook ya maneja el feedback.
    }
  };

  const openConfirmDelete = (sucursal) => setConfirmDelete({ show: true, sucursal });

  const closeConfirmDelete = () => {
    if (deletingId) return;
    setConfirmDelete({ show: false, sucursal: null });
  };

  const eliminarConfirmado = async () => {
    if (!confirmDelete.sucursal) return;
    try {
      await deleteSucursal(confirmDelete.sucursal);
      setConfirmDelete({ show: false, sucursal: null });
    } catch {
      // El hook ya maneja el feedback.
    }
  };

  const scrollCarousel = (direction) => {
    const node = carouselRef.current;
    if (!node) return;
    const delta = direction === 'next' ? node.clientWidth : -node.clientWidth;
    node.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const onCarouselWheel = (e) => {
    const node = carouselRef.current;
    if (!node) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      node.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="suc-page">
      <div className="inv-catpro-card inv-prod-card inv-cat-v2 mb-3">
        <SucursalesToolbar
          search={search}
          onSearchChange={setSearch}
          filtersOpen={filtersOpen}
          onOpenFilters={openFiltersDrawer}
          drawerOpen={drawerOpen}
          drawerMode={drawerMode}
          onOpenCreate={openCreate}
        />

        <SucursalesStats stats={stats} />

        <div className="inv-catpro-body inv-prod-body p-3">
          {error ? (
            <div className="alert alert-danger mb-3" role="alert">
              {error}
            </div>
          ) : null}

          <SucursalesCardsCarousel
            loading={loading}
            filteredSucursales={filteredSucursales}
            totalSucursales={sucursales.length}
            hasActiveFilters={hasActiveFilters}
            drawerOpen={drawerOpen}
            filtersOpen={filtersOpen}
            pages={pages}
            cardsPerPage={cardsPerPage}
            carouselRef={carouselRef}
            onCarouselWheel={onCarouselWheel}
            onScrollPrev={() => scrollCarousel('prev')}
            onScrollNext={() => scrollCarousel('next')}
            onClearFilters={clearAllFilters}
            onOpenCreate={openCreate}
            canTapCardToEdit={canTapCardToEdit}
            togglingEstadoId={togglingEstadoId}
            onOpenEdit={openEdit}
            onOpenDelete={openConfirmDelete}
            onToggleEstado={onQuickToggleEstado}
          />
        </div>
      </div>

      <button
        type="button"
        className={`inv-catpro-fab d-md-none ${isAnyDrawerOpen ? 'is-hidden' : ''}`}
        onClick={openCreate}
        title="Nueva"
      >
        <i className="bi bi-plus" />
      </button>

      <div
        className={`inv-prod-drawer-backdrop inv-cat-v2__drawer-backdrop ${isAnyDrawerOpen ? 'show' : ''}`}
        onClick={closeAnyDrawer}
        aria-hidden={!isAnyDrawerOpen}
      />

      <SucursalesFiltersDrawer
        open={filtersOpen}
        draft={filtersDraft}
        onChangeDraft={setFiltersDraft}
        onClose={closeFiltersDrawer}
        onApply={applyFiltersDrawer}
        onClear={clearVisualFilters}
      />

      <SucursalFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        form={form}
        saving={saving}
        onClose={closeDrawer}
        onSubmit={onSave}
        onFieldChange={onFieldChange}
        fieldErrors={formErrors}
        duplicateErrors={duplicateErrors}
        disableSubmit={hasLiveDuplicates}
      />

      <SucursalDeleteConfirm
        open={confirmDelete.show}
        sucursal={confirmDelete.sucursal}
        deleting={Number(deletingId ?? 0) === Number(confirmDelete.sucursal?.id_sucursal ?? 0)}
        onClose={closeConfirmDelete}
        onConfirm={eliminarConfirmado}
      />

      <SucursalesToast toast={toast} onClose={closeToast} />
    </div>
  );
}
