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
      selectedSucursal,
      menuSummary,
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
  const [deletingMenu, setDeletingMenu] = useState(false);
  const [editMenuSuccess, setEditMenuSuccess] = useState('');
  const [editMenuError, setEditMenuError] = useState('');
  const [contentEditorOpen, setContentEditorOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [createSeasonModalOpen, setCreateSeasonModalOpen] = useState(false);
  const [publicationViewMode, setPublicationViewMode] = useState('cards');
  const [toastMessage, setToastMessage] = useState('');
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
    if (menuSummary?.id_menu) {
      const nextMenuId = String(menuSummary.id_menu);
      setSelectedMenuProgramacionId(nextMenuId);
      onSelectCatalogMenu(nextMenuId);
      return;
    }

    if (Array.isArray(menusProgramables) && menusProgramables.length > 0) {
      const nextMenuId = String(menusProgramables[0].id_menu);
      setSelectedMenuProgramacionId(nextMenuId);
      onSelectCatalogMenu(nextMenuId);
    }
  }, [menuSummary, menusProgramables, onSelectCatalogMenu, selectedMenuProgramacionId]);

  useEffect(() => {
    // Si cambia el menu vigente de la sucursal, sincronizamos el selector para evitar errores de operador.
    if (!menuSummary?.id_menu) return;
    const nextMenuId = String(menuSummary.id_menu);
    setSelectedMenuProgramacionId(nextMenuId);
    onSelectCatalogMenu(nextMenuId);
  }, [menuSummary?.id_menu, onSelectCatalogMenu]);

  useEffect(() => {
    setScheduleError(null);
    setScheduleSuccess('');
  }, [selectedSucursalId]);

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

  const contentSummary = useMemo(() => {
    const rows = Array.isArray(items) ? items : [];
    const totalItems = rows.length;
    const visibleItems = rows.filter((item) => item?.visible === true).length;
    const customPriceItems = rows.filter((item) => (
      item?.precio_publico_input !== null &&
      item?.precio_publico_input !== undefined &&
      String(item.precio_publico_input).trim() !== ''
    )).length;

    return {
      totalItems,
      visibleItems,
      hiddenItems: totalItems - visibleItems,
      customPriceItems
    };
  }, [items]);

  const canEditContent = Boolean(selectedSucursalId && selectedSucursal?.estado && selectedMenuProgramacionId);

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

    if (!isSeason && Number(menuSummary?.id_menu || 0) === idMenu && menuSummary?.es_default === true) {
      setScheduleSuccess('Ese menu ya esta activo en esta sucursal.');
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
      setScheduleSuccess(isSeason
        ? 'Menú de temporada programado correctamente.'
        : 'Menú DEFAULT actualizado correctamente.');
      setScheduleModalOpen(false);
      await reloadCurrent();
    } catch (e) {
      setScheduleError(buildScheduleError(e, 'No se pudo publicar el menu para esta sucursal.'));
    } finally {
      setSchedulingMenu(false);
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

      const fallbackMenuId = Number(menuSummary?.id_menu || 0) > 0
        ? String(menuSummary.id_menu)
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

        <div className="inv-prod-header-actions">
          <button
            type="button"
            className="btn inv-prod-btn-subtle"
            onClick={() => openScheduleModal(null, publicationType)}
            disabled={!selectedSucursal?.estado}
          >
            <i className="bi bi-shuffle me-1" aria-hidden="true" />
            Cambiar / programar menú
          </button>
          <button
            type="button"
            className="btn inv-prod-btn-subtle"
            onClick={() => setCreateSeasonModalOpen(true)}
          >
            <i className="bi bi-file-earmark-plus me-1" aria-hidden="true" />
            Crear menú de temporada
          </button>
          <button
            type="button"
            className="btn inv-prod-btn-primary"
            onClick={() => openContentEditor()}
            disabled={!canEditContent}
          >
            <i className="bi bi-pencil-square me-1" aria-hidden="true" />
            Editar contenido
          </button>
        </div>
      </div>

      <div className="card-body inv-prod-body">
        {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
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

        {warnings.length > 0 ? (
          <div className="alert alert-warning inv-prod-alert mb-2">
            <div className="fw-semibold mb-1">Advertencias</div>
            <ul className="mb-0 ps-3">
              {warnings.map((item, index) => (
                <li key={`menu-pub-warn-${index}`}>{item}</li>
              ))}
            </ul>
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

        <section className="menu-pub-admin__selector" aria-label="Selector de sucursal para publicacion">
          <div className="menu-pub-admin__selector-grid">
            <div className="menu-pub-admin__selector-main">
              <label className="form-label mb-1" htmlFor="menu_publicacion_sucursal">Sucursal</label>
              <div className="menu-pub-admin__selector-row">
                <div className="menu-pub-admin__selector-select-wrap">
                  <i className="bi bi-shop menu-pub-admin__selector-select-icon" aria-hidden="true" />
                  <select
                    id="menu_publicacion_sucursal"
                    className="form-select menu-pub-admin__selector-select"
                    value={String(selectedSucursalId || '')}
                    onChange={(event) => onSelectSucursal?.(event.target.value)}
                    disabled={loadingSucursales || loadingCatalogo || branchRows.length === 0}
                  >
                    <option value="">
                      {branchRows.length === 0 ? 'Sin sucursales disponibles' : 'Selecciona sucursal'}
                    </option>
                    {branchRows.map((branch) => {
                      const id = String(branch?.id_sucursal || '');
                      const label = String(branch?.nombre_sucursal || `Sucursal #${id}`).trim();
                      return (
                        <option key={`menu-pub-branch-${id}`} value={id}>
                          {label}{branch?.estado ? '' : ' (Inactiva)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn inv-prod-btn-subtle menu-pub-admin__reload-btn"
                  onClick={reloadCurrent}
                  disabled={loadingSucursales || loadingCatalogo || !selectedSucursalId}
                >
                  <i className="bi bi-arrow-clockwise" aria-hidden="true" />
                  <span>Recargar</span>
                </button>
              </div>
              <div className="menu-pub-admin__selector-meta">
                {selectedSucursalId ? (
                  !selectedSucursal ? (
                    <span className="text-danger">La sucursal seleccionada ya no esta disponible. Selecciona otra sucursal.</span>
                  ) : !selectedSucursal?.estado ? (
                    <span className="text-danger">La sucursal seleccionada esta inactiva.</span>
                  ) : menuSummary ? (
                    <div className="d-flex flex-column gap-1">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span>Menu vigente: <strong>{menuSummary.nombre_menu || 'Menu'}</strong></span>
                        <span>ID menu: <strong>{menuSummary.id_menu}</strong></span>
                        <span className={`badge ${menuSummary?.tipo_publicacion === 'TEMPORADA' ? 'text-bg-warning' : 'text-bg-success'}`}>
                          {menuSummary?.tipo_publicacion === 'TEMPORADA' ? 'TEMPORADA' : 'DEFAULT'}
                        </span>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap small text-muted">
                        {formatDateTimeLabel(menuSummary?.fecha_inicio) ? (
                          <span>Desde: {formatDateTimeLabel(menuSummary.fecha_inicio)}</span>
                        ) : null}
                        {formatDateTimeLabel(menuSummary?.fecha_fin) ? (
                          <span>Hasta: {formatDateTimeLabel(menuSummary.fecha_fin)}</span>
                        ) : null}
                        {menuSummary?.es_default === true ? (
                          <span>Menú normal de respaldo</span>
                        ) : null}
                        {menuSummary?.tipo_publicacion === 'TEMPORADA' ? (
                          <span>Al finalizar, vuelve al DEFAULT</span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <span className="text-danger">La sucursal no tiene menu vigente activo.</span>
                  )
                ) : (
                  <span className="text-muted">Selecciona una sucursal para editar publicacion.</span>
                )}
              </div>
            </div>
            <aside className="menu-pub-admin__selector-info" aria-label="Informacion operativa">
              <div className="menu-pub-admin__selector-info-head">
                <i className="bi bi-lightbulb" aria-hidden="true" />
                <strong>Informacion</strong>
              </div>
              <p className="mb-0">
                Puedes activar un menu existente o crear uno temporal para esta sucursal sin modificar la base de datos.
              </p>
            </aside>
          </div>
        </section>

        <MenuProgramacionPanel
          selectedSucursal={selectedSucursal}
          selectedMenu={selectedMenuProgramable}
          loading={loadingMenus}
          scheduling={schedulingMenu}
          editingMenu={editingMenu}
          deletingMenu={deletingMenu}
          success={scheduleSuccess}
          error={scheduleError}
          editMenuSuccess={editMenuSuccess}
          editMenuError={editMenuError}
          editModalOpen={editModalOpen}
          editName={editMenuName}
          editDescription={editMenuDescription}
          onOpenSchedule={() => openScheduleModal(null, publicationType)}
          onOpenCreateSeason={() => setCreateSeasonModalOpen(true)}
          onEditContent={() => openContentEditor()}
          canEditContent={canEditContent}
          onReloadMenus={loadMenusProgramables}
          onCloseEditModal={closeEditMenuModal}
          onChangeEditName={setEditMenuName}
          onChangeEditDescription={setEditMenuDescription}
          onSaveEditMenu={handleSaveEditMenu}
        />

        <div className="row g-3 mt-1">
          <div className={showPreview ? 'col-12 col-xl-7' : 'col-12'}>
            <section className="menu-pub-admin__content-summary" aria-label="Contenido del menu">
              <div className="menu-pub-admin__content-summary-head">
                <div>
                  <div className="fw-semibold">Contenido del menú</div>
                  <div className="text-muted small">
                    Edita productos, recetas, combos, visibilidad y precios en un espacio dedicado.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn inv-prod-btn-primary"
                  onClick={() => setContentEditorOpen(true)}
                  disabled={!canEditContent}
                >
                  <i className="bi bi-pencil-square me-1" aria-hidden="true" />
                  Editar contenido
                </button>
              </div>

              <div className="menu-pub-admin__content-summary-grid">
                <article>
                  <span>Total</span>
                  <strong>{contentSummary.totalItems}</strong>
                </article>
                <article>
                  <span>Visibles</span>
                  <strong>{contentSummary.visibleItems}</strong>
                </article>
                <article>
                  <span>Ocultos</span>
                  <strong>{contentSummary.hiddenItems}</strong>
                </article>
                <article>
                  <span>Precio personalizado</span>
                  <strong>{contentSummary.customPriceItems}</strong>
                </article>
              </div>

              <div className="menu-pub-admin__content-summary-meta">
                <span>Menú: <strong>{selectedMenuProgramable?.nombre_menu || menuSummary?.nombre_menu || 'Sin menú seleccionado'}</strong></span>
                <span>Sucursal: <strong>{selectedSucursal?.nombre_sucursal || 'Sin sucursal seleccionada'}</strong></span>
              </div>
              {contentSummary.totalItems === 0 && menuSummary ? (
                <div className="menu-pub-admin__content-summary-note">
                  Este menú no tiene contenido cargado o no se pudo cargar el catálogo.
                </div>
              ) : null}
            </section>
          </div>

          {showPreview ? (
            <div className="col-12 col-xl-5">
              <MenuPreviewPanel
                loading={loadingPreview}
                error={previewError}
                preview={preview}
                catalogItems={items}
                openAsClientUrl={openAsClientUrl}
              />
            </div>
          ) : null}
        </div>

        <MenuPublicationCards
          menus={menusProgramables}
          selectedMenuId={selectedMenuProgramacionId}
          currentMenuId={String(menuSummary?.id_menu || '')}
          menuSummary={menuSummary}
          selectedSucursal={selectedSucursal}
          loading={loadingMenus}
          viewMode={publicationViewMode}
          onChangeViewMode={setPublicationViewMode}
          onSelectMenu={selectPublicationMenu}
          onEditContent={openContentEditor}
          onSetDefault={(menu) => openScheduleModal(menu, 'DEFAULT')}
          onProgramSeason={(menu) => openScheduleModal(menu, 'TEMPORADA')}
          onOpenCreateSeason={() => setCreateSeasonModalOpen(true)}
          onOpenEditMenu={openEditMenuModal}
          onDeleteMenu={handleDeleteMenu}
        />

        <MenuScheduleModal
          open={scheduleModalOpen}
          selectedSucursal={selectedSucursal}
          menus={menusProgramables}
          selectedMenuId={selectedMenuProgramacionId}
          selectedMenu={selectedMenuProgramable}
          currentMenuId={String(menuSummary?.id_menu || '')}
          publicationType={publicationType}
          seasonStartDate={seasonStartDate}
          seasonEndDate={seasonEndDate}
          seasonPriority={seasonPriority}
          loading={loadingMenus}
          scheduling={schedulingMenu}
          error={scheduleError}
          success={scheduleSuccess}
          menuSummary={menuSummary}
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



