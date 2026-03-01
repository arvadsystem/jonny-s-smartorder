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
  // NEW: estado del catálogo de categorías de insumos para la vista unificada de Categorías e integración en Insumos.
  // WHY: cargar ambos catálogos en Inventario y compartirlos sin refetches innecesarios entre submódulos.
  // IMPACT: solo agrega estado local y rutas de carga para `/categorias_insumos`.
  const [categoriasInsumos, setCategoriasInsumos] = useState([]);
  const [loadingCategoriasInsumos, setLoadingCategoriasInsumos] = useState(true);
  const [errorCategoriasInsumos, setErrorCategoriasInsumos] = useState('');
  const [categoriasInsumosIncludeInactive, setCategoriasInsumosIncludeInactive] = useState(false);

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

  // NEW: callbacks estables para evitar que los submodulos de Inventario vuelvan a disparar efectos por cada render del padre.
  // WHY: `InsumosTab` y otros tabs memoizan helpers sobre `openToast`; si cambia de referencia al mostrar/ocultar el toast, sus efectos de carga pueden re-ejecutarse.
  // IMPACT: se elimina el refetch visual inducido por el toast sin alterar el comportamiento ni el contenido de las notificaciones.
  const openToast = useCallback((title, message, variant = 'success') => {
    setToast({ show: true, title, message, variant });
  }, []);

  // NEW: cierre estable del toast para no propagar renders evitables hacia los submodulos.
  // WHY: mantener las props de notificacion con referencias consistentes durante todo el ciclo del componente.
  // IMPACT: el toast se sigue cerrando igual, pero ya no fuerza cargas derivadas por cambio de callback.
  const closeToast = useCallback(() => {
    setToast((s) => ({ ...s, show: false }));
  }, []);

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

  const cargarCategoriasInsumos = useCallback(async (options = {}) => {
    const incluirInactivos =
      typeof options?.incluirInactivos === 'boolean'
        ? options.incluirInactivos
        : categoriasInsumosIncludeInactive;
    // NEW: persiste la preferencia del toggle de categorías de insumos para recargas posteriores.
    // WHY: reutilizar `reloadCategoriasInsumos()` desde el panel unificado sin perder el estado del filtro admin.
    // IMPACT: llamadas existentes sin argumentos siguen funcionando (solo aplica al nuevo catálogo).
    if (typeof options?.incluirInactivos === 'boolean') {
      setCategoriasInsumosIncludeInactive(options.incluirInactivos);
    }
    setLoadingCategoriasInsumos(true);
    setErrorCategoriasInsumos('');
    try {
      const data = await inventarioService.getCategoriasInsumos({ incluirInactivos });
      setCategoriasInsumos(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO CATEGORIAS DE INSUMOS';
      setErrorCategoriasInsumos(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoadingCategoriasInsumos(false);
    }
  }, [categoriasInsumosIncludeInactive]);

  useEffect(() => {
    cargarCategorias();
    cargarCategoriasInsumos();
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

  // NEW: patch local del catálogo de categorías de insumos compartido en Inventario.
  // WHY: reflejar ediciones/cambios de estado desde el panel unificado sin recargar globalmente.
  // IMPACT: solo sincroniza `categoriasInsumos` en memoria; no cambia contratos de API.
  const patchCategoriaInsumoLocal = useCallback((idCategoria, patch) => {
    const idNum = Number(idCategoria ?? 0);
    if (!idNum || !patch || typeof patch !== 'object') return;
    setCategoriasInsumos((prev) =>
      (Array.isArray(prev) ? prev : []).map((item) =>
        Number(item?.id_categoria_insumo ?? 0) === idNum ? { ...item, ...patch } : item
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
          onIncludeInactiveChange={setCategoriasIncludeInactive}
          onCategoriaPatched={patchCategoriaLocal}
          categoriasInsumos={categoriasInsumos}
          loadingCategoriasInsumos={loadingCategoriasInsumos}
          errorCategoriasInsumos={errorCategoriasInsumos}
          setErrorCategoriasInsumos={setErrorCategoriasInsumos}
          reloadCategoriasInsumos={cargarCategoriasInsumos}
          includeInactiveCategoriasInsumos={categoriasInsumosIncludeInactive}
          onIncludeInactiveCategoriasInsumosChange={setCategoriasInsumosIncludeInactive}
          onCategoriaInsumoPatched={patchCategoriaInsumoLocal}
          openToast={openToast}
        />
      )}

      {activeTab === 'insumos' && <InsumosTab categorias={categorias} categoriasInsumos={categoriasInsumos} openToast={openToast} />}
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
