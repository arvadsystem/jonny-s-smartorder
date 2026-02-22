import { useEffect, useMemo, useState } from 'react'; // Importa hooks para estado, efecto y memoizacion.
import { useSearchParams } from 'react-router-dom'; // Permite sincronizar tab activo con query string.
import CatalogoTab from './parametros/CatalogoTab.jsx'; // Importa tab generico que renderiza CRUD por catalogo.

const CATALOGOS_CONFIG = [ // Define un unico arreglo configurable para los 18 catalogos permitidos.
  { tabla: 'tipo_departamento', label: 'Tipo de departamento', idField: 'id_tipo_departamento', hiddenFields: [], fields: ['id_tipo_departamento', 'nombre_departamento', 'descripcion', 'estado'] }, // Configura catalogo 1.
  { tabla: 'categorias_productos', label: 'Categorias de productos', idField: 'id_categoria_producto', hiddenFields: [], fields: ['id_categoria_producto', 'nombre_categoria', 'codigo_categoria', 'descripcion', 'estado'] }, // Configura catalogo 2.
  { tabla: 'unidades_medida', label: 'Unidades de medida', idField: 'id_unidad_medida', hiddenFields: [], fields: ['id_unidad_medida', 'nombre', 'simbolo', 'factor_base'] }, // Configura catalogo 3.
  { tabla: 'tipo_cliente', label: 'Tipo de cliente', idField: 'id_tipo_cliente', hiddenFields: [], fields: ['id_tipo_cliente', 'tipo_cliente'] }, // Configura catalogo 4.
  { tabla: 'tipo_notificacion', label: 'Tipo de notificacion', idField: 'id_tipo_notificacion', hiddenFields: [], fields: ['id_tipo_notificacion', 'descripcion_tipo_notificacion'] }, // Configura catalogo 5.
  { tabla: 'estados_pedido', label: 'Estados de pedido', idField: 'id_estado_pedido', hiddenFields: [], fields: ['id_estado_pedido', 'descripcion'] }, // Configura catalogo 6.
  { tabla: 'tipo_archivo', label: 'Tipo de archivo', idField: 'id_tipo_archivo', hiddenFields: [], fields: ['id_tipo_archivo', 'nombre_tipo_archivo'] }, // Configura catalogo 7.
  { tabla: 'marcas', label: 'Marcas', idField: 'id_marcas', hiddenFields: [], fields: ['id_marcas', 'marca'] }, // Configura catalogo 8.
  { tabla: 'dispositivos_biometricos', label: 'Dispositivos biometricos', idField: 'id_dispositivo', hiddenFields: [], fields: ['id_dispositivo', 'nombre_dispositivo'] }, // Configura catalogo 9.
  { tabla: 'tipo_hora_extra', label: 'Tipo de hora extra', idField: 'id_tipo_hora', hiddenFields: [], fields: ['id_tipo_hora', 'descripcion'] }, // Configura catalogo 10.
  { tabla: 'factor_horas_extra', label: 'Factor de horas extra', idField: 'id_factor_horas_extra', hiddenFields: [], fields: ['id_factor_horas_extra', 'cantidad_horas', 'precio_hora'] }, // Configura catalogo 11.
  { tabla: 'tipo_nomina', label: 'Tipo de nomina', idField: 'id_tipo_nomina', hiddenFields: [], fields: ['id_tipo_nomina', 'descripcion_tipo_nomina'] }, // Configura catalogo 12.
  { tabla: 'tipo_naturaleza', label: 'Tipo de naturaleza', idField: 'id_tipo_naturaleza', hiddenFields: [], fields: ['id_tipo_naturaleza', 'tipo_naturaleza', 'descripcion'] }, // Configura catalogo 13.
  { tabla: 'concepto_nomina', label: 'Concepto de nomina', idField: 'id_concepto_nomina', hiddenFields: [], fields: ['id_concepto_nomina', 'tipo_nomina', 'id_tipo_naturaleza', 'descripcion'] }, // Configura catalogo 14.
  { tabla: 'estado_planilla', label: 'Estado de planilla', idField: 'id_estado_planilla', hiddenFields: [], fields: ['id_estado_planilla', 'descripcion'] }, // Configura catalogo 15.
  { tabla: 'descuentos', label: 'Descuentos', idField: 'id_descuento', hiddenFields: [], fields: ['id_descuento', 'monto_descuento'] }, // Configura catalogo 16.
  { tabla: 'almacenes', label: 'Almacenes', idField: 'id_almacen', hiddenFields: [], fields: ['id_almacen', 'id_sucursal', 'nombre'] }, // Configura catalogo 17.
  { tabla: 'sucursales', label: 'Sucursales', idField: 'id_sucursal', hiddenFields: [], fields: ['id_sucursal', 'nombre_sucursal', 'id_direccion', 'id_telefono', 'id_correo', 'fecha_inauguracion', 'estado'] } // Configura catalogo 18.
]; // Cierra arreglo de configuracion de catalogos.

const DEFAULT_TAB = CATALOGOS_CONFIG[0].tabla; // Define tab inicial cuando no hay query valida.

const resolveActiveTab = (tabValue) => { // Normaliza y valida el tab activo contra la configuracion.
  const normalized = String(tabValue || DEFAULT_TAB).toLowerCase(); // Convierte query a texto seguro en minuscula.
  return CATALOGOS_CONFIG.some((item) => item.tabla === normalized) ? normalized : DEFAULT_TAB; // Devuelve tab valido o fallback.
}; // Cierra helper de tab activo.

const Parametros = () => { // Define pagina principal de Parametros/Catalogos.
  const [searchParams, setSearchParams] = useSearchParams(); // Accede y actualiza query params de la URL.
  const activeTabla = useMemo(() => resolveActiveTab(searchParams.get('tab')), [searchParams]); // Resuelve tabla activa a partir de query.
  const activeCatalogo = useMemo(() => CATALOGOS_CONFIG.find((item) => item.tabla === activeTabla) || CATALOGOS_CONFIG[0], [activeTabla]); // Obtiene objeto config del tab activo.

  const [toast, setToast] = useState({ show: false, title: '', message: '', variant: 'success' }); // Replica estado de toast del patron Inventario.

  useEffect(() => { // Corrige URL cuando llega un tab invalido o ausente.
    const rawTab = searchParams.get('tab'); // Lee valor actual del query param tab.
    const normalizedTab = resolveActiveTab(rawTab); // Normaliza valor contra lista blanca del frontend.
    if (rawTab === normalizedTab) return; // Evita setState innecesario cuando ya es valido.
    const nextParams = new URLSearchParams(searchParams); // Clona query actual para mutarlo con seguridad.
    nextParams.set('tab', normalizedTab); // Guarda tab valido en la URL.
    setSearchParams(nextParams, { replace: true }); // Actualiza query sin contaminar historial.
  }, [searchParams, setSearchParams]); // Reacciona al cambio de query params.

  useEffect(() => { // Cierra toast automaticamente despues de mostrarse.
    if (!toast.show) return; // No agenda timeout cuando no hay toast visible.
    const timeoutId = setTimeout(() => setToast((current) => ({ ...current, show: false })), 3000); // Programa cierre automatico a 3 segundos.
    return () => clearTimeout(timeoutId); // Limpia timeout al desmontar o cambiar estado.
  }, [toast.show]); // Solo depende de visibilidad del toast.

  const openToast = (title, message, variant = 'success') => { // Expone helper para abrir toast desde hijos.
    setToast({ show: true, title, message, variant }); // Actualiza contenido y estilo del toast.
  }; // Cierra helper de apertura de toast.

  const closeToast = () => { // Expone helper para cerrar toast manualmente.
    setToast((current) => ({ ...current, show: false })); // Solo cambia bandera de visibilidad.
  }; // Cierra helper de cierre de toast.

  const toastIconClass = (variant) => { // Mapea variante de toast a icono bootstrap.
    if (variant === 'danger') return 'bi bi-x-octagon-fill'; // Icono para error.
    if (variant === 'warning') return 'bi bi-exclamation-triangle-fill'; // Icono para advertencia.
    if (variant === 'info') return 'bi bi-info-circle-fill'; // Icono para informacion.
    return 'bi bi-check2-circle'; // Icono por defecto para exito.
  }; // Cierra helper de iconos de toast.

  const handleTabChange = (tabla) => { // Cambia tab activo actualizando la query string.
    const nextParams = new URLSearchParams(searchParams); // Clona parametros actuales para no perder otros filtros.
    nextParams.set('tab', tabla); // Define nuevo tab seleccionado.
    setSearchParams(nextParams); // Navega sin recargar la pagina.
  }; // Cierra handler de cambio de tab.

  const toastVariant = toast.variant || 'success'; // Calcula variante final de toast con fallback.

  return ( // Renderiza pagina Parametros con tabs, contenido y toast.
    <div className="container-fluid p-3"> {/* Contenedor principal de la pagina. */}
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3"> {/* Encabezado con titulo y resumen. */}
        <div> {/* Bloque de titulo y descripcion corta. */}
          <h3 className="mb-0">Parametros / Catalogos</h3>
          <small className="text-muted">Administra catalogos maestros desde un CRUD generico.</small>
        </div>
        <span className="badge text-bg-light border">{CATALOGOS_CONFIG.length} catalogos</span>
      </div>

      <ul className="nav nav-tabs flex-nowrap overflow-auto mb-3" role="tablist"> {/* Tabs bootstrap con scroll horizontal para 18 catalogos. */}
        {CATALOGOS_CONFIG.map((item) => ( // Renderiza un tab por cada catalogo de la configuracion.
          <li className="nav-item flex-shrink-0" role="presentation" key={item.tabla}> {/* Evita que tabs se compriman en horizontal. */}
            <button type="button" className={`nav-link text-nowrap ${activeTabla === item.tabla ? 'active' : ''}`} onClick={() => handleTabChange(item.tabla)}> {/* Activa tab seleccionado sin recargar. */}
              {item.label} {/* Muestra etiqueta amigable del catalogo. */}
            </button>
          </li>
        ))} {/* Cierra iteracion de tabs. */}
      </ul>

      <CatalogoTab catalogo={activeCatalogo} openToast={openToast} />

      {toast.show ? ( // Muestra toast solo cuando esta activo.
        <div className="inv-toast-wrap" role="status" aria-live="polite"> {/* Reutiliza estructura visual de toast de Inventario. */}
          <div className={`inv-toast-card ${toastVariant}`}> {/* Aplica variante visual del toast. */}
            <div className="inv-toast-icon"> {/* Columna de icono contextual. */}
              <i className={toastIconClass(toastVariant)} />
            </div>

            <div className="inv-toast-content"> {/* Contenido textual del toast. */}
              <div className="inv-toast-title">{toast.title}</div>
              <div className="inv-toast-message">{toast.message}</div>
            </div>

            <button type="button" className="inv-toast-close" onClick={closeToast} aria-label="Cerrar notificacion"> {/* Boton de cierre manual del toast. */}
              <i className="bi bi-x-lg" />
            </button>

            <div className="inv-toast-progress" />
          </div>
        </div>
      ) : null} {/* Cierra render condicional de toast. */}
    </div>
  ); // Cierra retorno JSX.
}; // Cierra componente Parametros.

export default Parametros; // Exporta pagina para enrutamiento en App.



