import { useEffect, useMemo, useState } from 'react';
import menuPublicacionAdminService from './services/menuPublicacionAdminService';
import { inventarioService } from '../../../services/inventarioService';
import {
  buildInventarioImageUploadPayload,
  getInventarioImageFileError,
  optimizeInventarioImageForUpload,
  resolveInventarioImageUrl
} from '../../../utils/inventarioImagenes';
import MenuConfirmDialog from './components/MenuConfirmDialog';

const MAX_CAROUSEL_ITEMS = 6;
const MENU_PUBLIC_BUCKET = 'jonnys-assets';
const MENU_CAROUSEL_UPLOAD_CONTEXT = 'carrusel';
const GLOBAL_BRANCH_KEY = '0';

const isPersistentCarouselImageUrl = (rawUrl) => {
  const value = String(rawUrl || '').trim();
  return Boolean(value) && !value.startsWith('blob:') && !value.startsWith('data:');
};

const normalizeCarouselConfig = (value) => {
  if (!value || typeof value !== 'object') return { byBranch: {}, customByBranch: {} };
  return {
    byBranch: value.byBranch && typeof value.byBranch === 'object' ? value.byBranch : {},
    customByBranch:
      value.customByBranch && typeof value.customByBranch === 'object'
        ? value.customByBranch
        : {}
  };
};

const toPositiveUniqueIds = (values = []) => {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const normalized = [];

  source.forEach((value) => {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || seen.has(parsed)) return;
    seen.add(parsed);
    normalized.push(parsed);
  });

  return normalized.slice(0, MAX_CAROUSEL_ITEMS);
};

const normalizeCustomSlides = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .map((row, index) => ({
      id: String(row?.id || `custom-${index}`),
      imageUrl: String(row?.imageUrl || '').trim(),
      title: String(row?.title || '').trim()
    }))
    .filter((row) => isPersistentCarouselImageUrl(row.imageUrl))
    .slice(0, MAX_CAROUSEL_ITEMS);

const readBranchIdsFromConfig = (config, branchKey) => toPositiveUniqueIds(config?.byBranch?.[branchKey]);
const readBranchCustomFromConfig = (config, branchKey) => normalizeCustomSlides(config?.customByBranch?.[branchKey]);

// Submodulo administrativo para elegir que fotos reales del catalogo publico
// se usan en el carrusel/hero del landing por sucursal.
const MenuCarruselAdmin = () => {
  const [sucursales, setSucursales] = useState([]);
  const [catalogBranchId, setCatalogBranchId] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [_loadingBranches, setLoadingBranches] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [customImages, setCustomImages] = useState([]);
  const [serverConfig, setServerConfig] = useState({ byBranch: {}, customByBranch: {} });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [customImageConfirm, setCustomImageConfirm] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        setError('');
        const rows = await menuPublicacionAdminService.getSucursales();
        if (!isMounted) return;
        const normalized = (Array.isArray(rows) ? rows : [])
          .filter((row) => Number(row?.id_sucursal || 0) > 0)
          .sort((a, b) => Number(a?.id_sucursal || 0) - Number(b?.id_sucursal || 0));
        setSucursales(normalized);
        if (normalized.length > 0) setCatalogBranchId(String(normalized[0].id_sucursal));
      } catch (e) {
        if (!isMounted) return;
        setSucursales([]);
        setError(e?.message || 'No se pudieron cargar las sucursales.');
      } finally {
        if (isMounted) setLoadingBranches(false);
      }
    };

    void loadBranches();
    return () => {
      isMounted = false;
    };
  }, []);

  // Carga productos desde una sucursal base solo para armar el catalogo visual de fotos.
  useEffect(() => {
    let isMounted = true;
    const idSucursal = Number(catalogBranchId || 0);
    if (!idSucursal) {
      setCatalogItems([]);
      setSelectedIds([]);
      return;
    }

    const loadCatalog = async () => {
      try {
        setLoadingCatalog(true);
        setError('');
        setSuccess('');
        const [response, remoteConfigRaw] = await Promise.all([
          menuPublicacionAdminService.getCatalogoPublicacion(idSucursal),
          menuPublicacionAdminService.getCarruselConfig()
        ]);
        if (!isMounted) return;

        const rows = (Array.isArray(response?.items) ? response.items : [])
          .filter((row) => Boolean(String(row?.imagen_url || '').trim()))
          .map((row) => ({
            ...row,
            id_detalle_menu: Number(row?.id_detalle_menu || 0)
          }))
          .filter((row) => row.id_detalle_menu > 0);

        const remoteConfig = normalizeCarouselConfig(remoteConfigRaw);
        const savedIds = readBranchIdsFromConfig(remoteConfig, GLOBAL_BRANCH_KEY);
        const savedCustom = readBranchCustomFromConfig(remoteConfig, GLOBAL_BRANCH_KEY);

        setCatalogItems(rows);
        setServerConfig(remoteConfig);
        setSelectedIds(savedIds.filter((id) => rows.some((row) => row.id_detalle_menu === id)));
        setCustomImages(savedCustom);
      } catch (e) {
        if (!isMounted) return;
        setCatalogItems([]);
        setSelectedIds([]);
        setCustomImages([]);
        setServerConfig({ byBranch: {}, customByBranch: {} });
        setError(e?.message || 'No se pudo cargar el catalogo de la sucursal.');
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    };

    void loadCatalog();
    return () => {
      isMounted = false;
    };
  }, [catalogBranchId]);

  const _selectedSucursal = useMemo(
    () => sucursales.find((row) => String(row?.id_sucursal || '') === String(catalogBranchId || '')) || null,
    [catalogBranchId, sucursales]
  );

  const selectedLookup = useMemo(() => new Set(selectedIds), [selectedIds]);
  const customImageCount = customImages.length;
  const selectedTotal = Math.min(MAX_CAROUSEL_ITEMS, customImageCount + selectedIds.length);
  const availableCatalogSlots = Math.max(0, MAX_CAROUSEL_ITEMS - customImageCount);

  const handleToggle = (idDetalleMenu) => {
    const id = Number(idDetalleMenu || 0);
    if (!id) return;

    setSuccess('');
    setSelectedIds((current) => {
      const exists = current.includes(id);
      if (exists) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= availableCatalogSlots) {
        return current;
      }
      return [...current, id];
    });
  };

  const handleMove = (idDetalleMenu, direction) => {
    const id = Number(idDetalleMenu || 0);
    if (!id) return;
    setSuccess('');

    setSelectedIds((current) => {
      const index = current.indexOf(id);
      if (index < 0) return current;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSavingConfig(true);
      setError('');
      setSuccess('');

      const nextConfig = {
        byBranch: {
          ...(serverConfig?.byBranch || {}),
          [GLOBAL_BRANCH_KEY]: toPositiveUniqueIds(selectedIds)
        },
        customByBranch: {
          ...(serverConfig?.customByBranch || {}),
          [GLOBAL_BRANCH_KEY]: normalizeCustomSlides(customImages)
        }
      };

      const saved = await menuPublicacionAdminService.saveCarruselConfig(nextConfig);
      const normalizedSaved = normalizeCarouselConfig(saved);
      setServerConfig(normalizedSaved);
      setSelectedIds(readBranchIdsFromConfig(normalizedSaved, GLOBAL_BRANCH_KEY));
      setCustomImages(readBranchCustomFromConfig(normalizedSaved, GLOBAL_BRANCH_KEY));
      setSuccess('Carrusel global guardado correctamente.');
    } catch (saveError) {
      setError(saveError?.message || 'No se pudo guardar la configuracion del carrusel.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleUploadCustomImages = async (event) => {
    const fileList = Array.from(event.target.files || []);
    if (!fileList.length) return;
    setSuccess('');
    setError('');

    const firstInvalid = fileList.find((file) => Boolean(getInventarioImageFileError(file)));
    if (firstInvalid) {
      setError(getInventarioImageFileError(firstInvalid));
      event.target.value = '';
      return;
    }

    try {
      setUploadingImages(true);
      const uploadedRows = [];

      for (const file of fileList) {
        const optimized = await optimizeInventarioImageForUpload(file);
        const payload = await buildInventarioImageUploadPayload(optimized);
        const response = await inventarioService.crearArchivoImagen({
          ...payload,
          bucket: MENU_PUBLIC_BUCKET,
          contexto: MENU_CAROUSEL_UPLOAD_CONTEXT
        });

        const idArchivo = Number(response?.id_archivo || response?.data?.id_archivo || 0);
        const storedUrl = String(response?.url_publica || response?.data?.url_publica || '').trim();
        if (!storedUrl) continue;

        uploadedRows.push({
          id: idArchivo > 0 ? `archivo-${idArchivo}` : `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          imageUrl: storedUrl,
          title: String(file?.name || '').replace(/\.[^.]+$/, '')
        });
      }

      if (uploadedRows.length > 0) {
        setCustomImages((current) => {
          const next = [...uploadedRows, ...current].slice(0, MAX_CAROUSEL_ITEMS);
          const nextCatalogSlots = Math.max(0, MAX_CAROUSEL_ITEMS - next.length);
          setSelectedIds((ids) => ids.slice(0, nextCatalogSlots));
          return next;
        });
      }
    } catch (uploadError) {
      setError(uploadError?.message || 'No se pudo subir la imagen del carrusel.');
    } finally {
      setUploadingImages(false);
      event.target.value = '';
    }
  };

  const updateCustomTitle = (id, title) => {
    setSuccess('');
    setCustomImages((current) =>
      current.map((row) => (row.id === id ? { ...row, title: String(title || '') } : row))
    );
  };

  const removeCustomImage = (id) => {
    setSuccess('');
    setCustomImages((current) => current.filter((row) => row.id !== id));
  };

  const closeCustomImageConfirm = () => {
    if (uploadingImages) return;
    setCustomImageConfirm(null);
  };

  const confirmRemoveCustomImage = () => {
    if (!customImageConfirm?.id) return;
    removeCustomImage(customImageConfirm.id);
    setCustomImageConfirm(null);
  };

  return (
    <div className="card shadow-sm mb-3 inv-prod-card menu-carrusel-admin">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-images inv-prod-title-icon" />
            <span className="inv-prod-title">Carrusel del landing</span>
          </div>
          <div className="inv-prod-subtitle">
            Configuracion global: selecciona y ordena las fotos del hero del menu publico.
          </div>
        </div>
      </div>

      <div className="card-body inv-prod-body">
        {error ? <div className="alert alert-danger inv-prod-alert">{error}</div> : null}
        {success ? <div className="alert alert-success inv-prod-alert">{success}</div> : null}

        <div className="menu-carrusel-admin__toolbar menu-carrusel-admin__toolbar--compact">
          <div className="menu-carrusel-admin__kpi">
            <span className="menu-carrusel-admin__kpi-label">Estado</span>
            <strong>Global</strong>
          </div>
          <div className="menu-carrusel-admin__kpi">
            <span className="menu-carrusel-admin__kpi-label">Seleccionadas</span>
            <strong>{selectedTotal} / {MAX_CAROUSEL_ITEMS}</strong>
          </div>
          <button
            type="button"
            className="btn inv-prod-btn-primary"
            onClick={handleSave}
            disabled={loadingCatalog || savingConfig || uploadingImages}
          >
            {savingConfig ? 'Guardando...' : 'Guardar carrusel'}
          </button>
        </div>

        <section className="menu-carrusel-admin__upload">
          <div className="menu-carrusel-admin__upload-head">
            <h6>Cargar fotos al carrusel</h6>
            <small>Sube JPG/PNG/WEBP. Estas imagenes aparecen primero en el landing.</small>
          </div>
          <label className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-upload me-1" />
            {uploadingImages ? 'Subiendo...' : 'Subir fotos'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              disabled={uploadingImages}
              onChange={handleUploadCustomImages}
            />
          </label>
          {customImages.length > 0 ? (
            <div className="menu-carrusel-admin__custom-grid">
              {customImages.map((row, index) => (
                <article key={row.id} className="menu-carrusel-admin__custom-card">
                  <img src={resolveInventarioImageUrl(row.imageUrl)} alt={row.title || `Imagen ${index + 1}`} />
                  <div className="menu-carrusel-admin__custom-body">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={row.title || ''}
                      placeholder="Titulo opcional"
                      onChange={(event) => updateCustomTitle(row.id, event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => setCustomImageConfirm(row)}
                    >
                      Quitar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        {loadingCatalog ? (
          <div className="text-muted">Cargando productos con imagen...</div>
        ) : (
          <div className="menu-carrusel-admin__grid">
            {catalogItems.map((item) => {
              const id = Number(item?.id_detalle_menu || 0);
              const checked = selectedLookup.has(id);
              const position = checked ? selectedIds.indexOf(id) + 1 : null;

              return (
                <article
                  key={`menu-carrusel-item-${id}`}
                  className={`menu-carrusel-admin__card ${checked ? 'is-selected' : ''}`}
                >
                  <div className="menu-carrusel-admin__media">
                    <img src={item.imagen_url} alt={item?.nombre || 'Producto'} />
                    {checked ? <span className="menu-carrusel-admin__position">#{position}</span> : null}
                  </div>
                  <div className="menu-carrusel-admin__content">
                    <h6>{item?.nombre || `Producto ${id}`}</h6>
                    <small>ID detalle: {id}</small>
                  </div>
                  <div className="menu-carrusel-admin__actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${checked ? 'btn-warning' : 'btn-outline-secondary'}`}
                      onClick={() => handleToggle(id)}
                      disabled={!checked && selectedIds.length >= availableCatalogSlots}
                    >
                      {checked ? 'Quitar' : 'Agregar'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => handleMove(id, 'up')}
                      disabled={!checked || selectedIds.indexOf(id) <= 0}
                    >
                      <i className="bi bi-arrow-up" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => handleMove(id, 'down')}
                      disabled={!checked || selectedIds.indexOf(id) === selectedIds.length - 1}
                    >
                      <i className="bi bi-arrow-down" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <MenuConfirmDialog
        open={Boolean(customImageConfirm)}
        title="Confirmar eliminacion"
        subtitle="Esta imagen se quitara del carrusel"
        question="Deseas quitar esta imagen personalizada?"
        description="La imagen dejara de aparecer en el carrusel global cuando guardes la configuracion."
        itemLabel={String(customImageConfirm?.title || 'Imagen personalizada')}
        itemIcon="bi-image"
        confirmLabel="Quitar"
        confirmingLabel="Quitando..."
        loading={uploadingImages}
        onClose={closeCustomImageConfirm}
        onConfirm={confirmRemoveCustomImage}
      />
    </div>
  );
};

export default MenuCarruselAdmin;
