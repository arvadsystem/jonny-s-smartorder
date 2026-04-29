import { useEffect, useMemo, useState } from 'react';
import menuPublicacionAdminService from './services/menuPublicacionAdminService';
import { inventarioService } from '../../../services/inventarioService';
import {
  buildInventarioImageUploadPayload,
  getInventarioImageFileError,
  optimizeInventarioImageForUpload,
  resolveInventarioImageUrl
} from '../../../utils/inventarioImagenes';
import {
  getGlobalHeroCarouselCustomImages,
  getGlobalHeroCarouselSelection,
  saveGlobalHeroCarouselCustomImages,
  saveGlobalHeroCarouselSelection
} from '../../../modules/public-menu/utils/heroCarouselStorage';

const MAX_CAROUSEL_ITEMS = 6;
const MENU_PUBLIC_BUCKET = 'jonnys-assets';

// Submodulo administrativo para elegir que fotos reales del catalogo publico
// se usan en el carrusel/hero del landing por sucursal.
const MenuCarruselAdmin = () => {
  const [sucursales, setSucursales] = useState([]);
  const [catalogBranchId, setCatalogBranchId] = useState('');
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [customImages, setCustomImages] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        const response = await menuPublicacionAdminService.getCatalogoPublicacion(idSucursal);
        if (!isMounted) return;

        const rows = (Array.isArray(response?.items) ? response.items : [])
          .filter((row) => Boolean(String(row?.imagen_url || '').trim()))
          .map((row) => ({
            ...row,
            id_detalle_menu: Number(row?.id_detalle_menu || 0)
          }))
          .filter((row) => row.id_detalle_menu > 0);

        setCatalogItems(rows);
        const saved = getGlobalHeroCarouselSelection();
        setSelectedIds(saved.filter((id) => rows.some((row) => row.id_detalle_menu === id)));
        setCustomImages(getGlobalHeroCarouselCustomImages());
      } catch (e) {
        if (!isMounted) return;
        setCatalogItems([]);
        setSelectedIds([]);
        setCustomImages([]);
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

  const selectedSucursal = useMemo(
    () => sucursales.find((row) => String(row?.id_sucursal || '') === String(catalogBranchId || '')) || null,
    [catalogBranchId, sucursales]
  );

  const selectedLookup = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleToggle = (idDetalleMenu) => {
    const id = Number(idDetalleMenu || 0);
    if (!id) return;

    setSuccess('');
    setSelectedIds((current) => {
      const exists = current.includes(id);
      if (exists) {
        return current.filter((value) => value !== id);
      }
      if (current.length >= MAX_CAROUSEL_ITEMS) {
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

  const handleSave = () => {
    saveGlobalHeroCarouselSelection(selectedIds);
    saveGlobalHeroCarouselCustomImages(customImages);
    setSuccess('Carrusel global guardado correctamente.');
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
          bucket: MENU_PUBLIC_BUCKET
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
        setCustomImages((current) => [...uploadedRows, ...current].slice(0, MAX_CAROUSEL_ITEMS));
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
            <strong>{selectedIds.length} / {MAX_CAROUSEL_ITEMS}</strong>
          </div>
          <button
            type="button"
            className="btn inv-prod-btn-primary"
            onClick={handleSave}
            disabled={loadingCatalog}
          >
            Guardar carrusel
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
                      onClick={() => removeCustomImage(row.id)}
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
                      disabled={!checked && selectedIds.length >= MAX_CAROUSEL_ITEMS}
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
    </div>
  );
};

export default MenuCarruselAdmin;
