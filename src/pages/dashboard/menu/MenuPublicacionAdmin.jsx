import { useCallback, useEffect, useMemo, useState } from 'react';
import MenuPreviewPanel from './components/MenuPreviewPanel';
import MenuProgramacionPanel from './components/MenuProgramacionPanel';
import MenuContentEditorModal from './components/MenuContentEditorModal';
import MenuPublicationCards from './components/MenuPublicationCards';
import MenuScheduleModal from './components/MenuScheduleModal';
import MenuCreateSeasonModal from './components/MenuCreateSeasonModal';
import MenuActionToast from './components/MenuActionToast';
import useMenuPublicacionAdmin from './hooks/useMenuPublicacionAdmin';
import menuPublicacionAdminService from './services/menuPublicacionAdminService';

const buildScheduleError = (error, fallback) => {
  const data = error?.data && typeof error.data === 'object' ? error.data : {};
  return {
    message: String(error?.message || data?.message || fallback),
    code: String(data?.code || error?.code || '').trim(),
    phase: String(data?.phase || '').trim(),
    correlationId: String(data?.correlationId || '').trim()
  };
};

const formatDateTimeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

// million-ignore
// Pantalla MVP para publicar menu por sucursal desde el panel admin.
const MenuPublicacionAdmin = ({ showPreview = false }) => {
  const {
    state: {
      sucursales,
      selectedSucursalId,
      selectedCatalogMenuId,
      selectedSucursal,
      menuSummary,
      publishedMenuSummary,
      selectedCatalogMenuSummary,
      items,
      preview,
      loadingSucursales,
      loadingCatalogo,
      loadingPreview,
      saving,
      error,
      previewError,
      success,
      warnings,
      sharedMenuImpact,
      appliedScope,
      validationErrors,
      openAsClientUrl
    },
    actions: {
      onSelectSucursal,
      onSelectCatalogMenu,
      onToggleVisible,
      onToggleAllVisible,
      onChangePrecioPublico,
      onUseOriginalPriceForAll,
      savePublication,
      reloadCurrent
    }
  } = useMenuPublicacionAdmin();

  const [menusProgramables, setMenusProgramables] = useState([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [selectedMenuProgramacionId, setSelectedMenuProgramacionId] = useState('');
  const [publicationType, setPublicationType] = useState('DEFAULT');
  const [seasonStartDate, setSeasonStartDate] = useState('');
  const [seasonEndDate, setSeasonEndDate] = useState('');
  const [seasonPriority, setSeasonPriority] = useState('100');
  const [schedulingMenu, setSchedulingMenu] = useState(false);
  const [cancellingSeason, setCancellingSeason] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState(null);

  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDescription, setNewMenuDescription] = useState('');
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [createMenuSuccess, setCreateMenuSuccess] = useState('');
  const [createMenuError, setCreateMenuError] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMenuName, setEditMenuName] = useState('');
  const [editMenuDescription, setEditMenuDescription] = useState('');
  const [editingMenu, setEditingMenu] = useState(false);
  const [, setDeletingMenu] = useState(false);
  const [editMenuSuccess, setEditMenuSuccess] = useState('');
  const [editMenuError, setEditMenuError] = useState('');
  const [contentEditorOpen, setContentEditorOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [createSeasonModalOpen, setCreateSeasonModalOpen] = useState(false);
  const [publicationViewMode, setPublicationViewMode] = useState('cards');
  const [publicationSearch, setPublicationSearch] = useState('');
  const [publicationFilter, setPublicationFilter] = useState('todos');
  const [toastMessage, setToastMessage] = useState('');
  const [defaultFallbackMenuId, setDefaultFallbackMenuId] = useState('');
  const loadMenusProgramables = useCallback(async () => {
    try {
      setLoadingMenus(true);
      const rows = await menuPublicacionAdminService.getMenusProgramables();
      setMenusProgramables(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setMenusProgramables([]);
      setScheduleError(buildScheduleError(e, 'No se pudieron cargar los menus disponibles.'));
    } finally {
      setLoadingMenus(false);
    }
  }, []);

  useEffect(() => {
    void loadMenusProgramables();
  }, [loadMenusProgramables]);

  useEffect(() => {
    if (selectedMenuProgramacionId) return;
    if (selectedCatalogMenuId) {
      setSelectedMenuProgramacionId(String(selectedCatalogMenuId));
      return;
    }

    if (publishedMenuSummary?.id_menu) {
      const nextMenuId = String(publishedMenuSummary.id_menu);
      setSelectedMenuProgramacionId(nextMenuId);
      onSelectCatalogMenu(nextMenuId);
      return;
    }

  }, [onSelectCatalogMenu, publishedMenuSummary, selectedCatalogMenuId, selectedMenuProgramacionId]);

  useEffect(() => {
    if (!selectedCatalogMenuId) return;
    if (String(selectedMenuProgramacionId || '') === String(selectedCatalogMenuId)) return;
    setSelectedMenuProgramacionId(String(selectedCatalogMenuId));
  }, [selectedCatalogMenuId, selectedMenuProgramacionId]);

  useEffect(() => {
    setScheduleError(null);
    setScheduleSuccess('');
    setDefaultFallbackMenuId('');
  }, [selectedSucursalId]);

  useEffect(() => {
    if (publishedMenuSummary?.es_default === true && publishedMenuSummary?.id_menu) {
      setDefaultFallbackMenuId(String(publishedMenuSummary.id_menu));
    }
  }, [publishedMenuSummary]);

  // Refuerza feedback visual de acciones principales en publicacion/menu temporada.
  useEffect(() => {
    if (!success) return;
    setToastMessage(success);
  }, [success]);

  useEffect(() => {
    if (!scheduleSuccess) return;
    setToastMessage(scheduleSuccess);
  }, [scheduleSuccess]);

  useEffect(() => {
    if (!createMenuSuccess) return;
    setToastMessage(createMenuSuccess);
  }, [createMenuSuccess]);

  const handleCreateNameChange = useCallback((value) => {
    setNewMenuName(value);
    if (createMenuError) setCreateMenuError('');
    if (createMenuSuccess) setCreateMenuSuccess('');
  }, [createMenuError, createMenuSuccess]);

  const handleCreateDescriptionChange = useCallback((value) => {
    setNewMenuDescription(value);
    if (createMenuError) setCreateMenuError('');
    if (createMenuSuccess) setCreateMenuSuccess('');
  }, [createMenuError, createMenuSuccess]);

  const nextMenuNumber = useMemo(() => {
    const ids = (Array.isArray(menusProgramables) ? menusProgramables : [])
      .map((item) => Number(item?.id_menu || 0))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (ids.length === 0) return 1;
    return Math.max(...ids) + 1;
  }, [menusProgramables]);

  const selectedMenuProgramable = useMemo(() => (
    (Array.isArray(menusProgramables) ? menusProgramables : []).find(
      (menu) => Number(menu?.id_menu || 0) === Number(selectedMenuProgramacionId || 0)
    ) || null
  ), [menusProgramables, selectedMenuProgramacionId]);

  const defaultFallbackMenu = useMemo(() => (
    (Array.isArray(menusProgramables) ? menusProgramables : []).find(
      (menu) => Number(menu?.id_menu || 0) === Number(defaultFallbackMenuId || 0)
    ) || null
  ), [defaultFallbackMenuId, menusProgramables]);

  const defaultFallbackLabel = defaultFallbackMenu?.id_menu
    ? `${defaultFallbackMenu.nombre_menu || 'Menu DEFAULT'} #${defaultFallbackMenu.id_menu}`
    : 'DEFAULT/fallback';

  const selectedEditableMenuName = selectedMenuProgramable?.nombre_menu
    || selectedCatalogMenuSummary?.nombre_menu
    || 'Menu seleccionado';
  const isEditingDifferentPublishedMenu = Number(selectedMenuProgramacionId || 0) > 0
    && Number(publishedMenuSummary?.id_menu || 0) > 0
    && Number(selectedMenuProgramacionId || 0) !== Number(publishedMenuSummary.id_menu);

  const branchRows = useMemo(() => {
    const rows = Array.isArray(sucursales) ? sucursales : [];
    return rows
      .map((branch) => ({
        ...branch,
        id_sucursal: Number(branch?.id_sucursal || 0) || null,
        nombre_sucursal: String(branch?.nombre_sucursal || '').trim()
      }))
      .filter((branch) => Number(branch?.id_sucursal || 0) > 0)
      .sort((a, b) => Number(a.id_sucursal) - Number(b.id_sucursal));
  }, [sucursales]);

  const filteredMenusProgramables = useMemo(() => {
    const rows = Array.isArray(menusProgramables) ? menusProgramables : [];
    const normalizedSearch = String(publicationSearch || '').trim().toLowerCase();
    const publishedId = Number(publishedMenuSummary?.id_menu || 0);
    const defaultId = Number(defaultFallbackMenuId || 0);
    const activeSeasonId = publishedMenuSummary?.tipo_publicacion === 'TEMPORADA' ? publishedId : 0;

    return rows.filter((menu) => {
      const idMenu = Number(menu?.id_menu || menu?.id || 0);
      const isPublished = idMenu > 0 && idMenu === publishedId;
      const isDefault = idMenu > 0 && idMenu === defaultId;
      const isSeason = idMenu > 0 && idMenu === activeSeasonId;

      if (publicationFilter === 'actual' && !isPublished) return false;
      if (publicationFilter === 'default' && !isDefault) return false;
      if (publicationFilter === 'temporada' && !isSeason) return false;
      if (publicationFilter === 'disponibles' && (isPublished || isDefault || isSeason)) return false;

      if (!normalizedSearch) return true;

      return [
        menu?.id_menu,
        menu?.nombre_menu,
        menu?.nombre,
        menu?.descripcion,
        menu?.menu_descripcion
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [defaultFallbackMenuId, menusProgramables, publicationFilter, publicationSearch, publishedMenuSummary]);

  const selectPublicationMenu = useCallback((menuOrId) => {
    const nextMenuId = String(
      typeof menuOrId === 'object'
        ? menuOrId?.id_menu || menuOrId?.id || ''
        : menuOrId || ''
    );
    setSelectedMenuProgramacionId(nextMenuId);
    onSelectCatalogMenu(nextMenuId);
    return nextMenuId;
  }, [onSelectCatalogMenu]);

  const openScheduleModal = useCallback((menu = null, nextType = null) => {
    if (menu?.id_menu) selectPublicationMenu(menu);
    if (nextType) setPublicationType(nextType);
    setScheduleError(null);
    setScheduleSuccess('');
    setScheduleModalOpen(true);
  }, [selectPublicationMenu]);

  const openContentEditor = useCallback((menu = null) => {
    if (menu?.id_menu) selectPublicationMenu(menu);
    setContentEditorOpen(true);
  }, [selectPublicationMenu]);

  const handleProgramarMenu = async () => {
    setScheduleError(null);
    setScheduleSuccess('');

    const idSucursal = Number(selectedSucursalId || 0);
    const idMenu = Number(selectedMenuProgramacionId || 0);
    const isSeason = publicationType === 'TEMPORADA';

    if (!idSucursal) {
      setScheduleError({ message: 'Selecciona una sucursal.' });
      return;
    }

    if (!selectedSucursal || !selectedSucursal?.estado) {
      setScheduleError({ message: 'La sucursal seleccionada no esta disponible para cambios.' });
      return;
    }

    if (!idMenu) {
      setScheduleError({ message: 'Selecciona un menú para publicar.' });
      return;
    }

    if (!isSeason && Number(defaultFallbackMenuId || 0) === idMenu) {
      setScheduleSuccess('Ese menu ya es el DEFAULT/fallback de esta sucursal.');
      return;
    }

    if (isSeason && !String(seasonEndDate || '').trim()) {
      setScheduleError({ message: 'Selecciona fecha fin para el menú de temporada.' });
      return;
    }

    if (isSeason && seasonStartDate && seasonEndDate) {
      const startDate = new Date(seasonStartDate);
      const endDate = new Date(seasonEndDate);
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()) && endDate <= startDate) {
        setScheduleError({ message: 'La fecha fin debe ser mayor que la fecha inicio.' });
        return;
      }
    }

    try {
      setSchedulingMenu(true);
      await menuPublicacionAdminService.activarMenuSucursal({
        idSucursal,
        idMenu,
        tipoPublicacion: isSeason ? 'TEMPORADA' : 'DEFAULT',
        fechaInicio: isSeason ? seasonStartDate || null : null,
        fechaFin: isSeason ? seasonEndDate : null,
        prioridad: isSeason ? Number(seasonPriority || 100) : 1000
      });

      setSelectedMenuProgramacionId(String(idMenu));
      onSelectCatalogMenu(String(idMenu));
      if (!isSeason) setDefaultFallbackMenuId(String(idMenu));
      setScheduleSuccess(isSeason
        ? 'Menú de temporada programado correctamente.'
        : 'Menú DEFAULT/fallback actualizado correctamente.');
      setScheduleModalOpen(false);
      await reloadCurrent();
    } catch (e) {
      setScheduleError(buildScheduleError(e, 'No se pudo publicar el menu para esta sucursal.'));
    } finally {
      setSchedulingMenu(false);
    }
  };

  const handleCancelarTemporadaActiva = async () => {
    setScheduleError(null);
    setScheduleSuccess('');

    const idSucursal = Number(selectedSucursalId || 0);
    if (!idSucursal) {
      setScheduleError({ message: 'Selecciona una sucursal.' });
      return;
    }

    if (!selectedSucursal || !selectedSucursal?.estado) {
      setScheduleError({ message: 'La sucursal seleccionada no esta disponible para cambios.' });
      return;
    }

    if (publishedMenuSummary?.tipo_publicacion !== 'TEMPORADA') {
      setScheduleSuccess('No hay temporada activa para finalizar.');
      return;
    }

    const confirmed = window.confirm(
      'Se finalizará la temporada activa. La sucursal volverá al menú DEFAULT/fallback.'
    );
    if (!confirmed) return;

    try {
      setCancellingSeason(true);
      const response = await menuPublicacionAdminService.cancelarTemporadaActiva(idSucursal);
      const activeMenu = response?.data?.menu_activo_actual || null;
      if (activeMenu?.es_default === true && activeMenu?.id_menu) {
        setDefaultFallbackMenuId(String(activeMenu.id_menu));
        setSelectedMenuProgramacionId(String(activeMenu.id_menu));
        onSelectCatalogMenu(String(activeMenu.id_menu));
      }
      setScheduleSuccess(response?.message || 'Temporada activa finalizada correctamente.');
      setToastMessage(response?.message || 'Temporada activa finalizada correctamente.');
      await reloadCurrent();
      await loadMenusProgramables();
    } catch (e) {
      setScheduleError(buildScheduleError(e, 'No se pudo finalizar la temporada activa.'));
    } finally {
      setCancellingSeason(false);
    }
  };

  const handleCreateMenu = async () => {
    setCreateMenuError('');
    setCreateMenuSuccess('');

    const name = String(newMenuName || '').trim();
    const description = String(newMenuDescription || '').trim();

    if (!name) {
      setCreateMenuError('Ingresa el nombre del menu.');
      return;
    }

    if (name.length < 3) {
      setCreateMenuError('El nombre del menu debe tener al menos 3 caracteres.');
      return;
    }

    try {
      setCreatingMenu(true);
      const response = await menuPublicacionAdminService.createMenuProgramable({
        nombreMenu: name,
        descripcion: description || null
      });

      const createdMenu = response?.data?.menu || null;
      if (!createdMenu?.id_menu) {
        throw new Error('No se recibio el menu creado.');
      }

      setMenusProgramables((current) => {
        const rows = Array.isArray(current) ? [...current] : [];
        const withoutDup = rows.filter((menu) => Number(menu?.id_menu || 0) !== Number(createdMenu.id_menu));
        withoutDup.push(createdMenu);
        return withoutDup.sort((a, b) => Number(a?.id_menu || 0) - Number(b?.id_menu || 0));
      });

      setSelectedMenuProgramacionId(String(createdMenu.id_menu));
      onSelectCatalogMenu(String(createdMenu.id_menu));
      setNewMenuName('');
      setNewMenuDescription('');
      setCreateMenuSuccess(response?.message || `Menu #${createdMenu.id_menu} creado correctamente.`);
      setCreateSeasonModalOpen(false);
    } catch (e) {
      setCreateMenuError(e?.message || 'No se pudo crear el menu de temporada.');
    } finally {
      setCreatingMenu(false);
    }
  };

  const openEditMenuModal = useCallback((menu = null) => {
    const targetMenu = menu?.id_menu ? menu : selectedMenuProgramable;
    if (!targetMenu) return;
    selectPublicationMenu(targetMenu);
    setEditMenuName(String(targetMenu?.nombre_menu || '').trim());
    setEditMenuDescription(String(targetMenu?.descripcion || '').trim());
    setEditMenuError('');
    setEditMenuSuccess('');
    setEditModalOpen(true);
  }, [selectPublicationMenu, selectedMenuProgramable]);

  const closeEditMenuModal = useCallback(() => {
    if (editingMenu) return;
    setEditModalOpen(false);
    setEditMenuError('');
    setEditMenuSuccess('');
  }, [editingMenu]);

  const handleSaveEditMenu = async () => {
    const idMenu = Number(selectedMenuProgramable?.id_menu || 0);
    const nombreMenu = String(editMenuName || '').trim();
    const descripcion = String(editMenuDescription || '').trim();

    setEditMenuError('');
    setEditMenuSuccess('');

    if (!idMenu) {
      setEditMenuError('Selecciona un menu valido antes de editar.');
      return;
    }

    if (!nombreMenu || nombreMenu.length < 3) {
      setEditMenuError('El nombre del menu debe tener al menos 3 caracteres.');
      return;
    }

    try {
      setEditingMenu(true);
      const response = await menuPublicacionAdminService.updateMenuProgramable({
        idMenu,
        nombreMenu,
        descripcion: descripcion || null
      });

      const updatedMenu = response?.data?.menu || null;
      if (!updatedMenu?.id_menu) {
        throw new Error('No se recibio el menu actualizado.');
      }

      setMenusProgramables((current) => (Array.isArray(current) ? current : []).map((menu) => (
        Number(menu?.id_menu || 0) === Number(updatedMenu.id_menu) ? { ...menu, ...updatedMenu } : menu
      )));
      setEditMenuSuccess(response?.message || `Menu #${updatedMenu.id_menu} actualizado correctamente.`);
      setToastMessage(response?.message || `Menu #${updatedMenu.id_menu} actualizado correctamente.`);
      setEditModalOpen(false);
      await reloadCurrent();
    } catch (e) {
      setEditMenuError(e?.message || 'No se pudo actualizar el menu.');
    } finally {
      setEditingMenu(false);
    }
  };

  const handleDeleteMenu = async (menu = null) => {
    const targetMenu = menu?.id_menu ? menu : selectedMenuProgramable;
    const idMenu = Number(targetMenu?.id_menu || 0);
    if (!idMenu) {
      setScheduleError({ message: 'Selecciona un menu valido antes de eliminar.' });
      return;
    }

    const confirmed = window.confirm(
      `Se eliminara el menu #${idMenu} ${targetMenu?.nombre_menu || ''} si no tiene vigencias, publicaciones, recetas ni combos activos.`
    );
    if (!confirmed) return;

    try {
      setDeletingMenu(true);
      setScheduleError(null);
      setScheduleSuccess('');
      const response = await menuPublicacionAdminService.deleteMenuProgramable(idMenu);

      const remaining = (Array.isArray(menusProgramables) ? menusProgramables : [])
        .filter((menu) => Number(menu?.id_menu || 0) !== idMenu);
      setMenusProgramables(remaining);

      const fallbackMenuId = Number(publishedMenuSummary?.id_menu || 0) > 0
        ? String(publishedMenuSummary.id_menu)
        : String(remaining?.[0]?.id_menu || '');
      setSelectedMenuProgramacionId(fallbackMenuId);
      onSelectCatalogMenu(fallbackMenuId);

      setScheduleSuccess(response?.message || `Menu #${idMenu} eliminado correctamente.`);
      setToastMessage(response?.message || `Menu #${idMenu} eliminado correctamente.`);
    } catch (e) {
      setScheduleError(buildScheduleError(e, 'No se pudo eliminar el menu.'));
    } finally {
      setDeletingMenu(false);
    }
  };

  const normalEditingWarnings = useMemo(() => (
    (Array.isArray(warnings) ? warnings : []).filter((item) => (
      String(item || '').trim() === 'Estás editando un menú que no es el publicado actualmente para esta sucursal.'
    ))
  ), [warnings]);

  const importantWarnings = useMemo(() => (
    (Array.isArray(warnings) ? warnings : []).filter((item) => (
      String(item || '').trim() !== 'Estás editando un menú que no es el publicado actualmente para esta sucursal.'
    ))
  ), [warnings]);

  return (
    <div className="card shadow-sm mb-3 inv-prod-card menu-pub-admin">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-broadcast-pin inv-prod-title-icon" />
            <span className="inv-prod-title">Publicacion por sucursal</span>
          </div>
          <div className="inv-prod-subtitle">
            Controla visibilidad y precio publico del menu cliente por sucursal.
          </div>
        </div>

        <div className="inv-prod-header-actions inv-ins-header-actions menu-recetas-admin__header-actions menu-toolbar-actions menu-pub-admin__header-actions">
          <div className="menu-pub-admin__branch-toolbar">
            <i className="bi bi-shop" aria-hidden="true" />
            <select
              className="form-select menu-pub-admin__branch-select"
              value={String(selectedSucursalId || '')}
              onChange={(event) => onSelectSucursal?.(event.target.value)}
              disabled={loadingSucursales || loadingCatalogo || branchRows.length === 0}
              aria-label="Sucursal"
            >
              <option value="">
                {branchRows.length === 0 ? 'Sin sucursales' : 'Selecciona sucursal'}
              </option>
              {branchRows.map((branch) => {
                const id = String(branch?.id_sucursal || '');
                const label = String(branch?.nombre_sucursal || `Sucursal #${id}`).trim();
                return (
                  <option key={`menu-pub-header-branch-${id}`} value={id}>
                    {label}{branch?.estado ? '' : ' (Inactiva)'}
                  </option>
                );
              })}
            </select>
          </div>

          <label className="inv-ins-search menu-toolbar-search" aria-label="Buscar menus">
            <i className="bi bi-search" />
            <input
              type="search"
              value={publicationSearch}
              onChange={(event) => setPublicationSearch(event.target.value)}
              placeholder="Buscar por nombre, descripcion o ID..."
            />
          </label>

          <select
            className="form-select menu-pub-admin__filter-select"
            value={publicationFilter}
            onChange={(event) => setPublicationFilter(event.target.value)}
            aria-label="Filtro de publicacion"
          >
            <option value="todos">Todos</option>
            <option value="actual">Actual</option>
            <option value="default">DEFAULT</option>
            <option value="temporada">TEMPORADA</option>
            <option value="disponibles">Disponibles</option>
          </select>

          <button
            type="button"
            className="inv-prod-toolbar-btn"
            onClick={() => setCreateSeasonModalOpen(true)}
          >
            <i className="bi bi-plus-circle" aria-hidden="true" />
            Crear menú de temporada
          </button>

          <div className="menu-recetas-admin__view-toggle menu-pub-admin__view-toggle" role="tablist" aria-label="Cambiar vista publicacion">
            <button
              type="button"
              className={`menu-recetas-admin__view-btn ${publicationViewMode === 'cards' ? 'is-active' : ''}`}
              onClick={() => setPublicationViewMode('cards')}
              aria-pressed={publicationViewMode === 'cards'}
              title="Vista en tarjetas"
            >
              <i className="bi bi-grid-3x3-gap-fill" />
            </button>
            <button
              type="button"
              className={`menu-recetas-admin__view-btn ${publicationViewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setPublicationViewMode('list')}
              aria-pressed={publicationViewMode === 'list'}
              title="Vista en lista"
            >
              <i className="bi bi-list-ul" />
            </button>
          </div>
        </div>
      </div>

      <div className="card-body inv-prod-body">
        {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

        {validationErrors.length > 0 ? (
          <div className="alert alert-danger inv-prod-alert mb-2">
            <div className="fw-semibold mb-1">Errores de validacion</div>
            <ul className="mb-0 ps-3">
              {validationErrors.map((item, index) => (
                <li key={`menu-pub-val-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {importantWarnings.length > 0 ? (
          <div className="alert alert-warning inv-prod-alert mb-2">
            <div className="fw-semibold mb-1">Advertencias</div>
            <ul className="mb-0 ps-3">
              {importantWarnings.map((item, index) => (
                <li key={`menu-pub-warn-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {normalEditingWarnings.length > 0 ? (
          <div className="menu-pub-admin__content-load-note mb-2">
            {normalEditingWarnings[0]}
          </div>
        ) : null}

        {sharedMenuImpact?.is_shared ? (
          <section className="menu-pub-admin__shared-impact" aria-label="Impacto por menu compartido">
            <div className="menu-pub-admin__shared-impact-head">
              <div className="fw-semibold">Impacto transversal</div>
              <span className="badge text-bg-warning">
                {Number(sharedMenuImpact?.total_sucursales_activas || 0)} sucursales activas
              </span>
            </div>
            <p className="mb-2">
              Este menu esta compartido. Al guardar, los cambios aplican a las sucursales listadas abajo.
            </p>
            <ul className="mb-2 ps-3">
              {(Array.isArray(sharedMenuImpact?.sucursales_activas) ? sharedMenuImpact.sucursales_activas : []).map((branch) => (
                <li key={`menu-shared-branch-${branch?.id_sucursal}`}>
                  #{branch?.id_sucursal} {branch?.nombre_sucursal}
                </li>
              ))}
            </ul>
            {appliedScope ? (
              <small className="text-muted d-block">Scope aplicado en backend: {appliedScope}</small>
            ) : null}
          </section>
        ) : null}

        <section className="menu-pub-admin__published-status" aria-label="Estado de publicacion por sucursal">
          <div>
            <span className="text-muted small">Sucursal</span>
            <strong>{selectedSucursal?.nombre_sucursal || 'Sin sucursal seleccionada'}</strong>
          </div>
          <div>
            <span className="text-muted small">Menú publicado actual</span>
            {selectedSucursalId ? (
              !selectedSucursal ? (
                <strong className="text-danger">Sucursal no disponible</strong>
              ) : !selectedSucursal?.estado ? (
                <strong className="text-danger">Sucursal inactiva</strong>
              ) : publishedMenuSummary ? (
                <strong>{publishedMenuSummary.nombre_menu || 'Menu'} · #{publishedMenuSummary.id_menu}</strong>
              ) : (
                <strong className="text-danger">Sin menú publicado actual</strong>
              )
            ) : (
              <strong>Selecciona una sucursal</strong>
            )}
          </div>
          <div className="menu-pub-admin__published-badges">
            {publishedMenuSummary ? (
              <span className={`badge ${publishedMenuSummary?.tipo_publicacion === 'TEMPORADA' ? 'text-bg-warning' : 'text-bg-success'}`}>
                {publishedMenuSummary?.tipo_publicacion === 'TEMPORADA' ? 'TEMPORADA' : 'DEFAULT'}
              </span>
            ) : null}
            {formatDateTimeLabel(publishedMenuSummary?.fecha_inicio) ? <span>Desde: {formatDateTimeLabel(publishedMenuSummary.fecha_inicio)}</span> : null}
            {formatDateTimeLabel(publishedMenuSummary?.fecha_fin) ? <span>Hasta: {formatDateTimeLabel(publishedMenuSummary.fecha_fin)}</span> : null}
            {publishedMenuSummary?.es_default === true ? <span>Menú DEFAULT/fallback</span> : null}
            {publishedMenuSummary?.tipo_publicacion === 'TEMPORADA' ? <span>Al finalizar, vuelve a: {defaultFallbackLabel}</span> : null}
          </div>
          {isEditingDifferentPublishedMenu ? (
            <div className="menu-pub-admin__content-load-note">
              Estás editando {selectedEditableMenuName}. El menú publicado actualmente es {publishedMenuSummary?.nombre_menu || 'Menu publicado'}.
            </div>
          ) : null}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {publishedMenuSummary?.tipo_publicacion === 'TEMPORADA' ? (
              <button
                type="button"
                className="btn inv-prod-btn-subtle menu-pub-admin__reload-btn"
                onClick={handleCancelarTemporadaActiva}
                disabled={loadingSucursales || loadingCatalogo || cancellingSeason || !selectedSucursalId}
              >
                <i className="bi bi-calendar-x" aria-hidden="true" />
                <span>{cancellingSeason ? 'Finalizando...' : 'Finalizar temporada'}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="btn inv-prod-btn-subtle menu-pub-admin__reload-btn"
              onClick={reloadCurrent}
              disabled={loadingSucursales || loadingCatalogo || cancellingSeason || !selectedSucursalId}
            >
              <i className="bi bi-arrow-clockwise" aria-hidden="true" />
              <span>Recargar</span>
            </button>
          </div>
        </section>

        {error ? (
          <div className="menu-pub-admin__content-load-note">
            No se pudo cargar el contenido editable de este menú. Puedes seguir administrando menús y volver a intentar.
          </div>
        ) : null}

        <div className="inv-prod-results-meta menu-recetas-admin__results-meta">
          <span>{filteredMenusProgramables.length} menús</span>
          {publicationFilter !== 'todos' ? <span className="inv-prod-active-filter-pill">{`Filtro: ${publicationFilter}`}</span> : null}
        </div>

        <MenuPublicationCards
          menus={filteredMenusProgramables}
          selectedMenuId={selectedMenuProgramacionId}
          currentMenuId={String(publishedMenuSummary?.id_menu || '')}
          publishedMenuSummary={publishedMenuSummary}
          selectedCatalogMenuSummary={selectedCatalogMenuSummary}
          defaultMenuId={defaultFallbackMenuId}
          selectedSucursal={selectedSucursal}
          loading={loadingMenus}
          viewMode={publicationViewMode}
          onSelectMenu={selectPublicationMenu}
          onEditContent={openContentEditor}
          onSetDefault={(menu) => openScheduleModal(menu, 'DEFAULT')}
          onProgramSeason={(menu) => openScheduleModal(menu, 'TEMPORADA')}
          onCancelActiveSeason={handleCancelarTemporadaActiva}
          onOpenEditMenu={openEditMenuModal}
          onDeleteMenu={handleDeleteMenu}
        />

        {showPreview ? (
          <div className="mt-3">
            <MenuPreviewPanel
              loading={loadingPreview}
              error={previewError}
              preview={preview}
              catalogItems={items}
              openAsClientUrl={openAsClientUrl}
            />
          </div>
        ) : null}

        <MenuProgramacionPanel
          editingMenu={editingMenu}
          editMenuSuccess={editMenuSuccess}
          editMenuError={editMenuError}
          editModalOpen={editModalOpen}
          editName={editMenuName}
          editDescription={editMenuDescription}
          onCloseEditModal={closeEditMenuModal}
          onChangeEditName={setEditMenuName}
          onChangeEditDescription={setEditMenuDescription}
          onSaveEditMenu={handleSaveEditMenu}
        />

        <MenuScheduleModal
          open={scheduleModalOpen}
          selectedSucursal={selectedSucursal}
          menus={menusProgramables}
          selectedMenuId={selectedMenuProgramacionId}
          selectedMenu={selectedMenuProgramable}
          currentMenuId={String(publishedMenuSummary?.id_menu || '')}
          defaultMenuId={defaultFallbackMenuId}
          publicationType={publicationType}
          seasonStartDate={seasonStartDate}
          seasonEndDate={seasonEndDate}
          seasonPriority={seasonPriority}
          loading={loadingMenus}
          scheduling={schedulingMenu}
          error={scheduleError}
          success={scheduleSuccess}
          menuSummary={publishedMenuSummary}
          onClose={() => setScheduleModalOpen(false)}
          onChangeMenu={selectPublicationMenu}
          onChangePublicationType={setPublicationType}
          onChangeSeasonStartDate={setSeasonStartDate}
          onChangeSeasonEndDate={setSeasonEndDate}
          onChangeSeasonPriority={setSeasonPriority}
          onProgramar={handleProgramarMenu}
          onReloadMenus={loadMenusProgramables}
        />

        <MenuCreateSeasonModal
          open={createSeasonModalOpen}
          nextMenuNumber={nextMenuNumber}
          createName={newMenuName}
          createDescription={newMenuDescription}
          creating={creatingMenu}
          createSuccess={createMenuSuccess}
          createError={createMenuError}
          onClose={() => setCreateSeasonModalOpen(false)}
          onChangeCreateName={handleCreateNameChange}
          onChangeCreateDescription={handleCreateDescriptionChange}
          onCreateMenu={handleCreateMenu}
        />

        <MenuContentEditorModal
          open={contentEditorOpen}
          title="Editar contenido del menú"
          subtitle="Controla visibilidad, precio público y filtros del contenido publicado."
          menuSummary={menuSummary}
          selectedSucursal={selectedSucursal}
          items={items}
          loading={loadingCatalogo}
          saving={saving}
          error={error}
          onClose={() => setContentEditorOpen(false)}
          onSave={savePublication}
          onToggleVisible={onToggleVisible}
          onToggleAllVisible={onToggleAllVisible}
          onChangePrecioPublico={onChangePrecioPublico}
          onUseOriginalPriceForAll={onUseOriginalPriceForAll}
        />

        <MenuActionToast
          title="Publicacion"
          message={toastMessage}
          onClose={() => setToastMessage('')}
        />
      </div>
    </div>
  );
};

export default MenuPublicacionAdmin;



