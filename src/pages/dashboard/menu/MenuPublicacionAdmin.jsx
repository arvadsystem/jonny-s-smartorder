import { useCallback, useEffect, useMemo, useState } from 'react';
import MenuPreviewPanel from './components/MenuPreviewPanel';
import MenuProgramacionPanel from './components/MenuProgramacionPanel';
import MenuPublicationTable from './components/MenuPublicationTable';
import MenuActionToast from './components/MenuActionToast';
import useMenuPublicacionAdmin from './hooks/useMenuPublicacionAdmin';
import menuPublicacionAdminService from './services/menuPublicacionAdminService';

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
      onChangeOrden,
      savePublication,
      reloadCurrent
    }
  } = useMenuPublicacionAdmin();

  const [menusProgramables, setMenusProgramables] = useState([]);
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [selectedMenuProgramacionId, setSelectedMenuProgramacionId] = useState('');
  const [schedulingMenu, setSchedulingMenu] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuDescription, setNewMenuDescription] = useState('');
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [createMenuSuccess, setCreateMenuSuccess] = useState('');
  const [createMenuError, setCreateMenuError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const loadMenusProgramables = useCallback(async () => {
    try {
      setLoadingMenus(true);
      const rows = await menuPublicacionAdminService.getMenusProgramables();
      setMenusProgramables(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setMenusProgramables([]);
      setScheduleError(e?.message || 'No se pudieron cargar los menus disponibles.');
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
    setScheduleError('');
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

  const handleProgramarMenu = async () => {
    setScheduleError('');
    setScheduleSuccess('');

    const idSucursal = Number(selectedSucursalId || 0);
    const idMenu = Number(selectedMenuProgramacionId || 0);

    if (!idSucursal) {
      setScheduleError('Selecciona una sucursal antes de cambiar el menu.');
      return;
    }

    if (!selectedSucursal || !Boolean(selectedSucursal?.estado)) {
      setScheduleError('La sucursal seleccionada no esta disponible para cambios.');
      return;
    }

    if (!idMenu) {
      setScheduleError('Selecciona un menu para activar.');
      return;
    }

    if (Number(menuSummary?.id_menu || 0) === idMenu) {
      setScheduleSuccess('Ese menu ya esta activo en esta sucursal.');
      return;
    }
    try {
      setSchedulingMenu(true);
      const response = await menuPublicacionAdminService.activarMenuSucursal({
        idSucursal,
        idMenu
      });

      setSelectedMenuProgramacionId(String(idMenu));
      onSelectCatalogMenu(String(idMenu));
      setScheduleSuccess(response?.message || 'Menu activo actualizado correctamente.');
      await reloadCurrent();
    } catch (e) {
      setScheduleError(e?.message || 'No se pudo activar el menu para esta sucursal.');
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
    } catch (e) {
      setCreateMenuError(e?.message || 'No se pudo crear el menu de temporada.');
    } finally {
      setCreatingMenu(false);
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
            Controla visibilidad, precio publico y orden del menu cliente por sucursal.
          </div>
        </div>

        <div className="inv-prod-header-actions">
          <button
            type="button"
            className="btn inv-prod-btn-primary"
            onClick={savePublication}
            disabled={saving || loadingCatalogo || !selectedSucursalId || !selectedSucursal || !Boolean(selectedSucursal?.estado)}
          >
            {saving ? 'Guardando...' : 'Guardar publicacion'}
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
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-2">
            <div className="flex-grow-1">
              <label className="form-label mb-1" htmlFor="menu_publicacion_sucursal">Sucursal</label>
              <select
                id="menu_publicacion_sucursal"
                className="form-select"
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
                      {label}{Boolean(branch?.estado) ? '' : ' (Inactiva)'}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              className="btn inv-prod-btn-subtle"
              onClick={reloadCurrent}
              disabled={loadingSucursales || loadingCatalogo || !selectedSucursalId}
            >
              Recargar
            </button>
          </div>

          <div className="menu-pub-admin__selector-meta">
            {selectedSucursalId ? (
              !selectedSucursal ? (
                <span className="text-danger">La sucursal seleccionada ya no esta disponible. Selecciona otra sucursal.</span>
              ) : !Boolean(selectedSucursal?.estado) ? (
                <span className="text-danger">La sucursal seleccionada esta inactiva.</span>
              ) : menuSummary ? (
                <>
                  <span>Menu vigente: <strong>{menuSummary.nombre_menu || 'Menu'}</strong></span>
                  <span>ID menu: <strong>{menuSummary.id_menu}</strong></span>
                </>
              ) : (
                <span className="text-danger">La sucursal no tiene menu vigente activo.</span>
              )
            ) : (
              <span className="text-muted">Selecciona una sucursal para editar publicacion.</span>
            )}
          </div>
        </section>

        <MenuProgramacionPanel
          selectedSucursal={selectedSucursal}
          menus={menusProgramables}
          selectedMenuId={selectedMenuProgramacionId}
          currentMenuId={String(menuSummary?.id_menu || '')}
          loading={loadingMenus}
          scheduling={schedulingMenu}
          success={scheduleSuccess}
          error={scheduleError}
          onChangeMenu={(nextMenuId) => {
            setSelectedMenuProgramacionId(nextMenuId);
            onSelectCatalogMenu(nextMenuId);
          }}
          onProgramar={handleProgramarMenu}
          onReloadMenus={loadMenusProgramables}
          nextMenuNumber={nextMenuNumber}
          createName={newMenuName}
          createDescription={newMenuDescription}
          creating={creatingMenu}
          createSuccess={createMenuSuccess}
          createError={createMenuError}
          onChangeCreateName={handleCreateNameChange}
          onChangeCreateDescription={handleCreateDescriptionChange}
          onCreateMenu={handleCreateMenu}
        />

        <div className="row g-3 mt-1">
          <div className={showPreview ? 'col-12 col-xl-7' : 'col-12'}>
            <MenuPublicationTable
              items={items}
              loading={loadingCatalogo}
              onToggleVisible={onToggleVisible}
              onToggleAllVisible={onToggleAllVisible}
              onChangePrecioPublico={onChangePrecioPublico}
              onChangeOrden={onChangeOrden}
            />
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



