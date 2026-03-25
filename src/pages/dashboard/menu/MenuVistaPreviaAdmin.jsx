import { useEffect, useMemo, useState } from 'react';
import MenuPreviewPanel from './components/MenuPreviewPanel';
import menuPublicacionAdminService from './services/menuPublicacionAdminService';
import { buildPublicMenuUrlByBranch } from './utils/publicMenuBranchUrl';

// Vista previa separada para revisar exactamente el render del cliente por sucursal.
const MenuVistaPreviaAdmin = () => {
  const [sucursales, setSucursales] = useState([]);
  const [selectedSucursalId, setSelectedSucursalId] = useState('');
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

        const rows = await menuPublicacionAdminService.getSucursales();
        if (!isMounted) return;

        const nextRows = Array.isArray(rows) ? rows : [];
        setSucursales(nextRows);

        if (nextRows.length > 0) {
          const firstActive = nextRows.find((branch) => Boolean(branch?.estado));
          const fallback = firstActive || nextRows[0];
          setSelectedSucursalId(String(fallback?.id_sucursal || ''));
        }
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

  const selectedSucursal = useMemo(
    () => sucursales.find((branch) => String(branch.id_sucursal) === String(selectedSucursalId)) || null,
    [selectedSucursalId, sucursales]
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
            disabled={loadingBranches || sucursales.length === 0}
          >
            {sucursales.length === 0 ? <option value="">Sin sucursales</option> : null}
            {sucursales.map((branch) => (
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
