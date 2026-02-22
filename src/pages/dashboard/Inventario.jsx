import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventarioService } from '../../services/inventarioService';

import CategoriasTab from './inventario/CategoriasTab.jsx';
import InsumosTab from './inventario/InsumosTab.jsx';
import ProductosTab from './inventario/ProductosTab.jsx';
import AlmacenesTab from './inventario/AlmacenesTab.jsx';
import MovimientosTab from './inventario/MovimientosTab.jsx';
import AlertasTab from './inventario/AlertasTab.jsx';

const Inventario = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('categorias');

  useEffect(() => {
    const t = (searchParams.get('tab') || 'categorias').toLowerCase();

    setActiveTab(
      t === 'insumos'
        ? 'insumos'
        : t === 'productos'
          ? 'productos'
          : t === 'almacenes'
            ? 'almacenes'
            : t === 'movimientos'
              ? 'movimientos'
              : t === 'alertas'
                ? 'alertas'
                : 'categorias'
    );
  }, [searchParams]);

  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState('');

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

  const cargarCategorias = useCallback(async () => {
    setLoadingCategorias(true);
    setErrorCategorias('');
    try {
      const data = await inventarioService.getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO CATEGORIAS';
      setErrorCategorias(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoadingCategorias(false);
    }
  }, []);

  useEffect(() => {
    cargarCategorias();
  }, [cargarCategorias]);

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
          openToast={openToast}
        />
      )}

      {activeTab === 'insumos' && <InsumosTab openToast={openToast} />}
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
