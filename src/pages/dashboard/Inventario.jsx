import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventarioService } from '../../services/inventarioService';

import CategoriasTab from './inventario/CategoriasTab.jsx';
import InsumosTab from './inventario/InsumosTab.jsx';
import ProductosTab from './inventario/ProductosTab.jsx';
import AlmacenesTab from './inventario/AlmacenesTab.jsx';
import MovimientosTab from './inventario/MovimientosTab.jsx';
import AlertasTab from './inventario/AlertasTab.jsx';

// AJUSTE: centraliza llaves de tabs para mantener consistencia con navegación por querystring.
const INVENTARIO_TAB_KEYS = ['categorias', 'insumos', 'productos', 'almacenes', 'movimientos', 'alertas'];

const Inventario = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('categorias');

  useEffect(() => {
    const t = (searchParams.get('tab') || 'categorias').toLowerCase();
    setActiveTab(INVENTARIO_TAB_KEYS.includes(t) ? t : 'categorias');
  }, [searchParams]);

  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState('');
  // NEW: controla si el tab de Categorias debe incluir registros inactivos en el GET.
  // WHY: el backend ahora filtra activos por defecto y el tab admin necesita un toggle explicito.
  // IMPACT: solo afecta la carga de CategoriasTab; contratos/endpoints se mantienen.
  const [categoriasIncludeInactive, setCategoriasIncludeInactive] = useState(false);

  const [toast, setToast] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'success'
  });

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(() => setToast((s) => ({ ...s, show: false })), 3000);
    return () => clearTimeout(t);
  }, [toast.show]);

  const openToast = (title, message, variant = 'success') => {
    setToast({ show: true, title, message, variant });
  };

  const closeToast = () => {
    setToast((s) => ({ ...s, show: false }));
  };

  const toastIconClass = (variant) => {
    if (variant === 'danger') return 'bi bi-x-octagon-fill';
    if (variant === 'warning') return 'bi bi-exclamation-triangle-fill';
    if (variant === 'info') return 'bi bi-info-circle-fill';
    return 'bi bi-check2-circle';
  };

  const cargarCategorias = useCallback(async (options = {}) => {
    const incluirInactivos =
      typeof options?.incluirInactivos === 'boolean'
        ? options.incluirInactivos
        : categoriasIncludeInactive;
    // NEW: persiste la preferencia local del toggle de "Mostrar inactivos" para recargas posteriores.
    // WHY: reusar `reloadCategorias()` existente desde el tab sin perder el estado del filtro admin.
    // IMPACT: llamadas existentes sin argumentos siguen funcionando.
    if (typeof options?.incluirInactivos === 'boolean') {
      setCategoriasIncludeInactive(options.incluirInactivos);
    }
    setLoadingCategorias(true);
    setErrorCategorias('');
    try {
      const data = await inventarioService.getCategorias({ incluirInactivos });
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO CATEGORIAS';
      setErrorCategorias(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoadingCategorias(false);
    }
  }, [categoriasIncludeInactive]);

  useEffect(() => {
    cargarCategorias();
    // NEW: mount-only para evitar doble fetch cuando cambia la preferencia y se recarga manualmente desde el tab.
    // WHY: `cargarCategorias` depende de `categoriasIncludeInactive`.
    // IMPACT: la carga inicial se mantiene; recargas posteriores siguen entrando por `reloadCategorias`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NEW: patch local de categorias en el estado compartido del modulo Inventario.
  // WHY: permitir que CategoriasTab actualice una sola categoria (edit/estado) sin refetch global visible.
  // IMPACT: Productos/Insumos reciben el cambio inmediatamente via props, sin alterar contratos de API.
  const patchCategoriaLocal = useCallback((idCategoria, patch) => {
    const idNum = Number(idCategoria ?? 0);
    if (!idNum || !patch || typeof patch !== 'object') return;
    setCategorias((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        Number(item?.id_categoria_producto ?? 0) === idNum ? { ...item, ...patch } : item
      )
    );
  }, []);

  const toastVariant = toast.variant || 'success';

  return (
    <div className="container-fluid p-3">
      {activeTab === 'categorias' && (
        <CategoriasTab
          categorias={categorias}
          loading={loadingCategorias}
          error={errorCategorias}
          setError={setErrorCategorias}
          reloadCategorias={cargarCategorias}
          includeInactive={categoriasIncludeInactive}
          onCategoriaPatched={patchCategoriaLocal}
          openToast={openToast}
        />
      )}

      {activeTab === 'insumos' && <InsumosTab categorias={categorias} openToast={openToast} />}
      {activeTab === 'productos' && <ProductosTab categorias={categorias} openToast={openToast} />}
      {activeTab === 'almacenes' && <AlmacenesTab openToast={openToast} />}
      {activeTab === 'movimientos' && <MovimientosTab openToast={openToast} />}
      {activeTab === 'alertas' && <AlertasTab openToast={openToast} />}

      {toast.show && (
        <div className="inv-toast-wrap" role="status" aria-live="polite">
          <div className={`inv-toast-card ${toastVariant}`}>
            <div className="inv-toast-icon">
              <i className={toastIconClass(toastVariant)} />
            </div>

            <div className="inv-toast-content">
              <div className="inv-toast-title">{toast.title}</div>
              <div className="inv-toast-message">{toast.message}</div>
            </div>

            <button type="button" className="inv-toast-close" onClick={closeToast} aria-label="Cerrar notificacion">
              <i className="bi bi-x-lg" />
            </button>

            <div className="inv-toast-progress" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
