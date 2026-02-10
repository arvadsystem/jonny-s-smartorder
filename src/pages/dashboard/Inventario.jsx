import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inventarioService } from '../../services/inventarioService';

import CategoriasTab from './inventario/CategoriasTab.jsx';
import InsumosTab from './inventario/InsumosTab.jsx';

import ProductosTab from './inventario/ProductosTab.jsx';
import AlmacenesTab from './inventario/AlmacenesTab.jsx';
import MovimientosTab from './inventario/MovimientosTab.jsx';
import AlertasTab from './inventario/AlertasTab.jsx';

const Inventario = () => {
  // ==============================
  // TAB ACTIVO (DESDE ?tab=)
  // ==============================
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('categorias'); // categorias | insumos | productos | almacenes | movimientos | alertas

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

  // ==============================
  // ESTADOS (CATEGORÍAS) - SE MANTIENEN AQUÍ PARA REUTILIZAR EN PRODUCTOS
  // ==============================
  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState('');

  // ==============================
  // TOAST PROFESIONAL (MENSAJES)
  // ==============================
  const [toast, setToast] = useState({
    show: false,
    title: '',
    message: '',
    variant: 'success' // success | danger | warning | info
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

  const toastIcon = (variant) => {
    if (variant === 'danger') return '❌';
    if (variant === 'warning') return '⚠️';
    if (variant === 'info') return 'ℹ️';
    return '✅';
  };

  const toastBorderClass = (variant) => {
    if (variant === 'danger') return 'border-danger';
    if (variant === 'warning') return 'border-warning';
    if (variant === 'info') return 'border-info';
    return 'border-success';
  };

  // ==============================
  // CARGAR CATEGORÍAS (SE USA EN: CategoriasTab y ProductosTab)
  // ==============================
  const cargarCategorias = async () => {
    setLoadingCategorias(true);
    setErrorCategorias('');
    try {
      const data = await inventarioService.getCategorias();
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      const msg = e?.message || 'ERROR CARGANDO CATEGORÍAS';
      setErrorCategorias(msg);
      openToast('ERROR', msg, 'danger');
    } finally {
      setLoadingCategorias(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  return (
    <div className="container-fluid p-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="m-0">Inventario</h3>
          <div className="text-muted small">
            {activeTab === 'categorias' && (
              <>
                Categorías: <span className="fw-semibold">{categorias.length}</span>
              </>
            )}

            {activeTab === 'insumos' && <>Insumos</>}
            {activeTab === 'productos' && <>Productos</>}
            {activeTab === 'almacenes' && <>Almacenes</>}
            {activeTab === 'movimientos' && <>Movimientos (Kardex)</>}
            {activeTab === 'alertas' && <>Alertas de stock</>}
          </div>
        </div>
      </div>

      {/* =====================================
          TAB: CATEGORÍAS (PRO)
          ===================================== */}
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

      {/* =====================================
          TAB: INSUMOS (PRO)
          ===================================== */}
      {activeTab === 'insumos' && <InsumosTab openToast={openToast} />}

      {/* =====================================
          TAB: PRODUCTOS
          ===================================== */}
      {activeTab === 'productos' && <ProductosTab categorias={categorias} openToast={openToast} />}

      {/* =====================================
          TAB: ALMACENES
          ===================================== */}
      {activeTab === 'almacenes' && <AlmacenesTab openToast={openToast} />}

      {/* =====================================
          TAB: MOVIMIENTOS
          ===================================== */}
      {activeTab === 'movimientos' && <MovimientosTab openToast={openToast} />}

      {/* =====================================
          TAB: ALERTAS
          ===================================== */}
      {activeTab === 'alertas' && <AlertasTab openToast={openToast} />}

      {/* ==============================
          TOAST PROFESIONAL (ARRIBA DERECHA)
          ============================== */}
      {toast.show && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 2000, width: 340, maxWidth: '90vw' }}>
          <div className={`card shadow-sm border ${toastBorderClass(toast.variant)}`}>
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex gap-2">
                  <div style={{ fontSize: 18 }}>{toastIcon(toast.variant)}</div>
                  <div>
                    <div className="fw-bold">{toast.title}</div>
                    <div className="text-muted small">{toast.message}</div>
                  </div>
                </div>

                <button type="button" className="btn btn-sm btn-light" onClick={closeToast}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
