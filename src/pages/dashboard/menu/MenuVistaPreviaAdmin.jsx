import { useEffect, useMemo, useState } from 'react';
import MenuPreviewPanel from './components/MenuPreviewPanel';
import menuPublicacionAdminService from './services/menuPublicacionAdminService';
import { buildPublicMenuUrlByBranch } from './utils/publicMenuBranchUrl';
import { publicMenuBootstrapService } from '../../../modules/public-menu/services/publicMenuBootstrapService';

// Fallback operativo para evitar select vacio en ambiente local MVP.
const STATIC_PREVIEW_BRANCHES = [
  { id_sucursal: 1, nombre_sucursal: "Sucursal Jonny's El Carmen", estado: true },
  { id_sucursal: 6, nombre_sucursal: "Sucursal Jonny's 21 Octubre", estado: true }
];

const normalizeBranchOption = (raw, index) => {
  const id = Number(raw?.id_sucursal ?? raw?.id ?? raw?.idSucursal ?? 0) || null;
  const nombre =
    String(raw?.nombre_sucursal ?? raw?.nombre ?? raw?.name ?? '')
      .replace(/\s+/g, ' ')
      .trim() || '';

  return {
    ...raw,
    id_sucursal: id,
    nombre_sucursal: nombre || (id ? `Sucursal #${id}` : `Sucursal ${index + 1}`),
    estado: raw?.estado ?? raw?.isOpen ?? true
  };
};

const dedupeBranchesById = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const id = Number(row?.id_sucursal || 0);
    if (!id) return;
    map.set(id, row);
  });
  return Array.from(map.values());
};

const STATIC_BRANCH_OPTIONS = dedupeBranchesById(
  STATIC_PREVIEW_BRANCHES.map((row, index) => normalizeBranchOption(row, index))
);

// million-ignore
// Vista previa separada para revisar exactamente el render del cliente por sucursal.
const MenuVistaPreviaAdmin = () => {
  const [sucursales, setSucursales] = useState(STATIC_BRANCH_OPTIONS);
  const [selectedSucursalId, setSelectedSucursalId] = useState(
    String(STATIC_BRANCH_OPTIONS?.[0]?.id_sucursal || '')
  );
  const [preview, setPreview] = useState(null);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        setError('');

        const [adminResult, publicResult] = await Promise.allSettled([
          menuPublicacionAdminService.getSucursales(),
          publicMenuBootstrapService.getBranches()
        ]);

        if (!isMounted) return;

        const adminRows = adminResult.status === 'fulfilled' ? adminResult.value : [];
        const publicRows = publicResult.status === 'fulfilled' ? publicResult.value : [];

        let nextRows = (Array.isArray(adminRows) ? adminRows : [])
          .map(normalizeBranchOption)
          .filter((branch) => Number(branch?.id_sucursal || 0) > 0);

        const normalizedPublicRows = (Array.isArray(publicRows) ? publicRows : [])
          .map((branch, index) => normalizeBranchOption({
            id_sucursal: branch?.id,
            nombre_sucursal: branch?.displayName || branch?.name,
            direccion: branch?.address,
            estado: branch?.isOpen ?? true
          }, index))
          .filter((branch) => Number(branch?.id_sucursal || 0) > 0);

        nextRows = [...nextRows, ...normalizedPublicRows];
        nextRows = [...nextRows, ...STATIC_PREVIEW_BRANCHES.map(normalizeBranchOption)];

        const uniqueRows = dedupeBranchesById(nextRows);
        const finalRows = uniqueRows.length > 0 ? uniqueRows : STATIC_BRANCH_OPTIONS;
        setSucursales(finalRows);

        if (finalRows.length > 0) {
          const firstActive = finalRows.find((branch) => Boolean(branch?.estado));
          const fallback = firstActive || finalRows[0];
          setSelectedSucursalId(String(fallback?.id_sucursal || ''));
        } else {
          setError('No se encontraron sucursales para vista previa.');
        }
      } catch (e) {
        if (!isMounted) return;
        setSucursales(STATIC_BRANCH_OPTIONS);
        setSelectedSucursalId(String(STATIC_BRANCH_OPTIONS?.[0]?.id_sucursal || ''));
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

  useEffect(() => {
    if (!Array.isArray(sucursales) || sucursales.length === 0) return;
    if (
      selectedSucursalId &&
      sucursales.some((branch) => String(branch.id_sucursal) === String(selectedSucursalId))
    ) {
      return;
    }

    const firstActive = sucursales.find((branch) => Boolean(branch?.estado));
    const fallback = firstActive || sucursales[0];
    setSelectedSucursalId(String(fallback?.id_sucursal || ''));
  }, [selectedSucursalId, sucursales]);

  // Nunca deja el select vacio: combina estado cargado + fallback fijo.
  const availableSucursales = useMemo(
    () => dedupeBranchesById([...(Array.isArray(sucursales) ? sucursales : []), ...STATIC_BRANCH_OPTIONS]),
    [sucursales]
  );

  useEffect(() => {
    if (!Array.isArray(availableSucursales) || availableSucursales.length === 0) return;
    if (
      selectedSucursalId &&
      availableSucursales.some((branch) => String(branch.id_sucursal) === String(selectedSucursalId))
    ) {
      return;
    }

    const firstActive = availableSucursales.find((branch) => Boolean(branch?.estado));
    const fallback = firstActive || availableSucursales[0];
    setSelectedSucursalId(String(fallback?.id_sucursal || ''));
  }, [availableSucursales, selectedSucursalId]);

  const selectedSucursal = useMemo(
    () => availableSucursales.find((branch) => String(branch.id_sucursal) === String(selectedSucursalId)) || null,
    [availableSucursales, selectedSucursalId]
  );

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      const idSucursal = Number(selectedSucursalId || 0);
      if (!idSucursal) {
        setPreview(null);
        return;
      }

      if (selectedSucursal && !Boolean(selectedSucursal?.estado)) {
        setPreview(null);
        setError('La sucursal seleccionada esta inactiva y no tiene menu publico disponible.');
        return;
      }

      try {
        setLoadingPreview(true);
        setError('');
        const data = await menuPublicacionAdminService.getPreviewPublico(idSucursal);
        if (!isMounted) return;
        setPreview(data);
      } catch (e) {
        if (!isMounted) return;
        setPreview(null);
        setError(e?.message || 'No se pudo cargar la vista previa del menu publico.');
      } finally {
        if (isMounted) setLoadingPreview(false);
      }
    };

    void loadPreview();

    return () => {
      isMounted = false;
    };
  }, [selectedSucursal, selectedSucursalId]);

  const openAsClientUrl = useMemo(() => buildPublicMenuUrlByBranch(selectedSucursal), [selectedSucursal]);

  return (
    <div className="card shadow-sm mb-3 inv-prod-card menu-vista-previa-admin">
      <div className="card-header inv-prod-header">
        <div className="inv-prod-title-wrap">
          <div className="inv-prod-title-row">
            <i className="bi bi-eye inv-prod-title-icon" />
            <span className="inv-prod-title">Vista Previa Del Menu Cliente</span>
          </div>
          <div className="inv-prod-subtitle">
            Valida por sucursal la publicacion real antes de compartir o imprimir QR.
          </div>
        </div>
      </div>

      <div className="card-body">
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        <div className="menu-vista-previa-admin__selector mb-3">
          <label className="form-label mb-1" htmlFor="menu_vista_previa_sucursal">Sucursal</label>
          <select
            id="menu_vista_previa_sucursal"
            className="form-select"
            value={selectedSucursalId}
            onChange={(event) => setSelectedSucursalId(event.target.value)}
            disabled={loadingBranches || availableSucursales.length === 0}
          >
            <option value="">
              {availableSucursales.length === 0 ? 'Sin sucursales' : 'Selecciona sucursal'}
            </option>
            {availableSucursales.map((branch) => (
              <option key={branch.id_sucursal} value={String(branch.id_sucursal)}>
                {branch.nombre_sucursal}{Boolean(branch?.estado) ? '' : ' (Inactiva)'}
              </option>
            ))}
          </select>
        </div>

        <MenuPreviewPanel
          loading={loadingPreview || loadingBranches}
          error=""
          preview={preview}
          openAsClientUrl={openAsClientUrl}
        />
      </div>
    </div>
  );
};

export default MenuVistaPreviaAdmin;
