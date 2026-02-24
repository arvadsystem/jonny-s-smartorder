import { useCallback, useEffect, useMemo, useState } from 'react'; // Importa hooks para datos, memoizacion y eventos del tab.
import InlineLoader from '../../../components/common/InlineLoader'; // Reutiliza loader estandar del proyecto.
import ConfirmButton from '../../../components/common/ConfirmButton'; // Reutiliza confirmacion de borrado existente.
import { parametrosService } from '../../../services/parametrosService'; // Consume el CRUD generico de catalogos.
import CreateCatalogoModal from './CreateCatalogoModal.jsx'; // Modal separado para crear registros.
import EditCatalogoModal from './EditCatalogoModal.jsx'; // Modal separado para editar registros.

const toDisplayText = (value) => { // Normaliza cualquier valor para mostrarlo en tabla y busqueda.
  if (value === null || value === undefined) return ''; // Convierte null/undefined a cadena vacia.
  return String(value); // Convierte el resto a texto sin alterar contenido.
}; // Cierra helper de texto.

const toFieldLabel = (fieldName) => { // Convierte nombre tecnico de campo en etiqueta amigable.
  return String(fieldName || '') // Asegura un string base.
    .replace(/^id_/i, 'ID ') // Hace visible el prefijo id_.
    .replace(/_/g, ' ') // Reemplaza separadores por espacios.
    .replace(/\s+/g, ' ') // Limpia espacios repetidos.
    .trim() // Quita espacios en extremos.
    .replace(/\b\w/g, (letter) => letter.toUpperCase()); // Capitaliza palabras para tabla/form.
}; // Cierra helper de etiqueta.

const buildFieldList = (catalogo, rows) => { // Construye listado de columnas combinando config y datos reales.
  const fromRows = Array.isArray(rows) && rows.length > 0 && rows[0] ? Object.keys(rows[0]) : []; // Lee columnas reales del primer registro.
  if (fromRows.length > 0) return fromRows; // Prioriza columnas reales cuando el backend devuelve filas.
  const fromConfig = Array.isArray(catalogo?.fields) ? catalogo.fields : []; // Lee columnas declaradas en configuracion como fallback.
  return Array.from(new Set([...fromConfig])); // Devuelve configuracion solo cuando no hay filas para inferir.
}; // Cierra helper de columnas.

const inferIdField = (catalogo, fields, rows) => { // Resuelve el campo id siguiendo reglas robustas de inferencia.
  const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null; // Obtiene primera fila para fallback.
  const rowKeys = firstRow ? Object.keys(firstRow) : []; // Obtiene llaves reales del primer registro.
  if (rowKeys.length > 0) { // Prioriza inferencia basada en respuesta real del backend.
    if (catalogo?.idField && rowKeys.includes(catalogo.idField)) return catalogo.idField; // Usa id configurado solo si existe realmente en la fila.
    const fromRowKeys = rowKeys.find((field) => String(field).toLowerCase().startsWith('id_')); // Busca primer campo id_* real.
    if (fromRowKeys) return fromRowKeys; // Retorna id encontrado en los datos reales.
    return rowKeys[0] || ''; // Usa primera columna real como ultimo recurso cuando no hay id_*.
  } // Cierra ruta de inferencia por datos reales.
  if (catalogo?.idField && fields.includes(catalogo.idField)) return catalogo.idField; // Prioriza id declarado si aun no hay filas.
  const fromFields = fields.find((field) => String(field).toLowerCase().startsWith('id_')); // Busca primer campo que inicie con id_ en fallback de config.
  if (fromFields) return fromFields; // Retorna id detectado por convencion desde config.
  if (fields.length > 0) return fields[0]; // Usa primera columna conocida como ultimo fallback.
  return ''; // Devuelve vacio si no hay forma segura de inferir id.
}; // Cierra helper de id.

const CatalogoTab = ({ catalogo, openToast }) => { // Define tab generico para cualquier catalogo configurado.
  const [rows, setRows] = useState([]); // Guarda filas del catalogo activo.
  const [loading, setLoading] = useState(true); // Controla estado de carga del listado.
  const [saving, setSaving] = useState(false); // Controla estado de guardado/edicion/eliminacion.
  const [error, setError] = useState(''); // Guarda mensaje de error visible al usuario.
  const [search, setSearch] = useState(''); // Guarda filtro de busqueda client-side.
  const [showCreateModal, setShowCreateModal] = useState(false); // Controla modal de creacion.
  const [rowToEdit, setRowToEdit] = useState(null); // Guarda fila actualmente seleccionada para editar.

  const safeToast = useCallback( // Crea wrapper de toast para evitar fallos si no llega callback.
    (title, message, variant = 'success') => { // Define firma comun de notificaciones.
      if (typeof openToast === 'function') openToast(title, message, variant); // Dispara toast solo cuando el padre provee funcion.
    }, // Cierra callback de toast.
    [openToast] // Recalcula solo si cambia callback del padre.
  ); // Cierra useCallback.

  const loadCatalogo = useCallback(async () => { // Carga catalogo actual desde backend.
    if (!catalogo?.tabla) return; // Evita request invalida sin tabla definida.
    setLoading(true); // Activa indicador de carga.
    setError(''); // Limpia errores previos.

    try { // Intenta obtener filas del backend.
      const data = await parametrosService.listarCatalogo(catalogo.tabla); // Ejecuta GET generico del catalogo actual.
      setRows(Array.isArray(data) ? data : []); // Garantiza arreglo en estado.
    } catch (requestError) { // Captura error de red/permiso/backend.
      const message = requestError?.message || `No se pudo cargar ${catalogo?.label || 'el catalogo'}.`; // Construye mensaje legible.
      setRows([]); // Evita dejar datos stale cuando falla carga.
      setError(message); // Publica error en UI.
      safeToast('ERROR', message, 'danger'); // Informa error en toast consistente.
    } finally { // Finaliza ciclo de carga.
      setLoading(false); // Desactiva indicador de carga.
    } // Cierra bloque try/catch/finally de carga.
  }, [catalogo?.tabla, catalogo?.label, safeToast]); // Recalcula cuando cambia tabla activa o callback.

  useEffect(() => { // Carga datos al entrar al tab o cambiar catalogo.
    loadCatalogo(); // Ejecuta lectura inicial del catalogo.
  }, [loadCatalogo]); // Depende de callback memoizado.

  useEffect(() => { // Resetea estado UI cuando cambia de tabla.
    setSearch(''); // Limpia busqueda al cambiar de catalogo.
    setShowCreateModal(false); // Cierra modal crear si estaba abierto.
    setRowToEdit(null); // Limpia fila en edicion al cambiar tab.
    setError(''); // Limpia error contextual de tabla anterior.
  }, [catalogo?.tabla]); // Se ejecuta solo cuando cambia nombre de tabla.

  const allFields = useMemo(() => buildFieldList(catalogo, rows), [catalogo, rows]); // Calcula columnas dinamicas del catalogo.
  const idField = useMemo(() => inferIdField(catalogo, allFields, rows), [catalogo, allFields, rows]); // Resuelve campo identificador principal.

  const hiddenFields = useMemo(() => { // Construye lista de campos ocultos en formularios.
    const configured = Array.isArray(catalogo?.hiddenFields) ? catalogo.hiddenFields : []; // Toma ocultos definidos en configuracion.
    return Array.from(new Set([...configured, idField].filter(Boolean))); // Oculta por defecto el id y evita duplicados.
  }, [catalogo?.hiddenFields, idField]); // Recalcula cuando cambia config o id inferido.

  const formFields = useMemo( // Determina campos editables para modales crear/editar.
    () => allFields.filter((field) => !hiddenFields.includes(field)), // Excluye id y ocultos declarados.
    [allFields, hiddenFields] // Depende de columnas y ocultos.
  ); // Cierra useMemo de campos de formulario.

  const filteredRows = useMemo(() => { // Aplica orden y busqueda local sin pedir al backend.
    const sourceRows = Array.isArray(rows) ? rows : []; // Garantiza arreglo fuente.
    const orderedRows = [...sourceRows].sort((leftRow, rightRow) => { // Ordena por id para mayor estabilidad visual.
      if (!idField) return 0; // Mantiene orden original si no hay id detectado.
      const leftValue = toDisplayText(leftRow?.[idField]); // Lee valor id izquierdo.
      const rightValue = toDisplayText(rightRow?.[idField]); // Lee valor id derecho.
      const leftNumber = Number(leftValue); // Intenta comparacion numerica izquierda.
      const rightNumber = Number(rightValue); // Intenta comparacion numerica derecha.
      if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) return leftNumber - rightNumber; // Usa orden numerico cuando ambos son numeros.
      return leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base' }); // Usa orden alfabetico como fallback.
    }); // Cierra sort por id.

    const needle = search.trim().toLowerCase(); // Normaliza texto de busqueda para comparar.
    if (!needle) return orderedRows; // Devuelve todo si no hay filtro activo.

    return orderedRows.filter((row) => { // Filtra por coincidencia sobre todas las columnas.
      const haystack = allFields.map((field) => toDisplayText(row?.[field])).join(' ').toLowerCase(); // Concatena valores de la fila.
      return haystack.includes(needle); // Mantiene filas que contienen texto buscado.
    }); // Cierra filtro por texto.
  }, [rows, idField, search, allFields]); // Recalcula ante cambios de datos o filtro.

  const canCreate = formFields.length > 0; // Determina si se puede abrir modal de creacion.
  const canEditDelete = Boolean(idField); // Determina si editar/eliminar tienen un id util.

  const handleCreate = async (payload) => { // Ejecuta creacion de registro para el catalogo activo.
    setSaving(true); // Activa bloqueo de acciones mientras guarda.
    setError(''); // Limpia errores previos.

    try { // Intenta crear registro en backend.
      await parametrosService.crearCatalogo(catalogo.tabla, payload); // Ejecuta POST generico.
      setShowCreateModal(false); // Cierra modal al completar guardado.
      await loadCatalogo(); // Recarga listado para reflejar cambios.
      safeToast('CREADO', `Registro creado en ${catalogo.label}.`, 'success'); // Notifica exito.
    } catch (requestError) { // Maneja fallo de creacion.
      const message = requestError?.message || `No se pudo crear en ${catalogo.label}.`; // Construye mensaje de error.
      setError(message); // Publica error en el tab.
      safeToast('ERROR', message, 'danger'); // Notifica error con toast.
      throw requestError; // Re-lanza para que el modal pueda mostrar detalle.
    } finally { // Finaliza flujo de creacion.
      setSaving(false); // Libera bloqueo de acciones.
    } // Cierra bloque de creacion.
  }; // Cierra handler de create.

  const handleEditSave = async (changes) => { // Ejecuta actualizacion secuencial de campos editados.
    if (!rowToEdit) return; // Evita operar sin fila seleccionada.
    if (!idField) { // Verifica que exista campo id para PUT/DELETE.
      const message = 'No se pudo detectar el campo identificador para actualizar.'; // Define mensaje de error especifico.
      setError(message); // Muestra error en pantalla.
      safeToast('ERROR', message, 'danger'); // Notifica error por toast.
      throw new Error(message); // Lanza error para modal.
    } // Cierra validacion de idField.

    const idValue = rowToEdit?.[idField]; // Toma valor id de la fila en edicion.
    if (idValue === undefined || idValue === null || toDisplayText(idValue).trim() === '') { // Valida que exista un valor id usable.
      const message = 'No se encontro el identificador del registro seleccionado.'; // Crea mensaje de error.
      setError(message); // Publica error en UI.
      safeToast('ERROR', message, 'danger'); // Lanza toast de error.
      throw new Error(message); // Interrumpe flujo de edicion.
    } // Cierra validacion de idValue.

    const changedEntries = Object.entries(changes || {}); // Convierte cambios a pares campo/valor.
    if (changedEntries.length === 0) { // Evita PUT cuando no hubo cambios reales.
      setRowToEdit(null); // Cierra modal de edicion sin request.
      safeToast('SIN CAMBIOS', 'No hay cambios para guardar.', 'info'); // Informa estado neutro.
      return; // Termina flujo sin llamadas al backend.
    } // Cierra validacion de cambios vacios.

    setSaving(true); // Activa bloqueo durante actualizacion secuencial.
    setError(''); // Limpia errores previos.

    try { // Ejecuta PUT por cada campo cambiado.
      for (const [campo, valor] of changedEntries) { // Recorre cambios uno a uno para cumplir contrato del backend.
        await parametrosService.actualizarCatalogoCampo(catalogo.tabla, { // Llama endpoint PUT generico.
          campo, // Envia nombre de columna actualizada.
          valor, // Envia valor nuevo sin conversiones agresivas.
          id_campo: idField, // Envia nombre de columna identificadora.
          id_valor: idValue // Envia valor del id del registro.
        }); // Cierra payload de actualizacion por campo.
      } // Cierra bucle secuencial de actualizaciones.

      setRowToEdit(null); // Cierra modal tras actualizar exitosamente.
      await loadCatalogo(); // Recarga listado para reflejar cambios.
      safeToast('ACTUALIZADO', `Registro actualizado en ${catalogo.label}.`, 'success'); // Notifica exito.
    } catch (requestError) { // Maneja fallo en cualquier campo del bucle secuencial.
      const message = requestError?.message || `No se pudo actualizar en ${catalogo.label}.`; // Construye mensaje de error.
      setError(message); // Publica error en tab.
      safeToast('ERROR', message, 'danger'); // Notifica error al usuario.
      throw requestError; // Re-lanza para que modal muestre detalle y no simule exito.
    } finally { // Cierra ciclo de actualizacion.
      setSaving(false); // Libera bloqueo de acciones.
    } // Cierra bloque try/catch/finally de edit.
  }; // Cierra handler de edit.

  const handleDelete = async (row) => { // Elimina registro seleccionado con confirmacion previa.
    if (!idField) { // Valida campo id antes de llamar DELETE.
      const message = 'No se pudo detectar el campo identificador para eliminar.'; // Define mensaje claro.
      setError(message); // Muestra error en pantalla.
      safeToast('ERROR', message, 'danger'); // Lanza toast de error.
      return; // Corta ejecucion para evitar request invalida.
    } // Cierra validacion de idField.

    const idValue = row?.[idField]; // Obtiene valor id desde fila de tabla.
    if (idValue === undefined || idValue === null || toDisplayText(idValue).trim() === '') { // Verifica id no vacio.
      const message = 'No se encontro el identificador del registro a eliminar.'; // Define mensaje de error.
      setError(message); // Muestra mensaje en UI.
      safeToast('ERROR', message, 'danger'); // Notifica error por toast.
      return; // Evita request DELETE incompleto.
    } // Cierra validacion de idValue.

    setSaving(true); // Activa estado ocupado durante eliminacion.
    setError(''); // Limpia errores previos.

    try { // Intenta eliminar registro en backend.
      await parametrosService.eliminarCatalogo(catalogo.tabla, { // Ejecuta DELETE generico.
        columna_id: idField, // Envia nombre de columna id.
        valor_id: idValue // Envia valor del id a borrar.
      }); // Cierra payload DELETE.
      await loadCatalogo(); // Recarga listado para reflejar eliminacion.
      safeToast('ELIMINADO', `Registro eliminado de ${catalogo.label}.`, 'success'); // Notifica exito.
    } catch (requestError) { // Maneja error de eliminacion.
      const message = requestError?.message || `No se pudo eliminar en ${catalogo.label}.`; // Construye mensaje legible.
      setError(message); // Muestra error en vista.
      safeToast('ERROR', message, 'danger'); // Notifica error por toast.
    } finally { // Cierra proceso de delete.
      setSaving(false); // Libera bloqueo de acciones.
    } // Cierra bloque try/catch/finally de delete.
  }; // Cierra handler de delete.

  return ( // Renderiza estructura visual del catalogo activo.
    <> {/* Agrupa tarjeta del tab y modales en una sola salida. */}
      <div className="card shadow-sm"> {/* Contenedor principal del tab de catalogo. */}
        <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2 flex-wrap"> {/* Header con titulo y accion principal. */}
          <div> {/* Bloque de titulo y metadata. */}
            <div className="fw-semibold">{catalogo?.label || 'Catalogo'}{/* Muestra nombre amigable del catalogo. */}</div>
            <small className="text-muted">Tabla: {catalogo?.tabla || '-'} | Registros: {rows.length} | ID: {idField || 'No detectado'}{/* Muestra datos operativos para soporte. */}</small>
          </div>

          <div className="d-flex align-items-center gap-2"> {/* Acciones de header. */}
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={loadCatalogo} disabled={loading || saving}>Recargar{/* Permite refrescar datos del catalogo. */}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)} disabled={!canCreate || saving}>Nuevo{/* Abre modal de creacion. */}</button>
          </div>
        </div>

        <div className="card-body"> {/* Cuerpo con filtro, estados y tabla. */}
          {error ? <div className="alert alert-danger py-2" role="alert">{error}</div> : null} {/* Muestra error si existe. */}
          {!canEditDelete ? <div className="alert alert-warning py-2">No se detecto un campo ID. Editar y eliminar estaran deshabilitados.</div> : null} {/* Advierte si no hay id util. */}

          <div className="row g-2 mb-3"> {/* Fila de busqueda rapida client-side. */}
            <div className="col-12 col-md-8"> {/* Columna principal para buscador. */}
              <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en todas las columnas..." />
            </div>
            <div className="col-12 col-md-4 d-grid"> {/* Columna para accion de limpiar filtro. */}
              <button type="button" className="btn btn-outline-secondary" onClick={() => setSearch('')} disabled={!search.trim()}>Limpiar busqueda{/* Limpia filtro sin tocar backend. */}</button>
            </div>
          </div>

          {loading ? ( // Renderiza estado de carga obligatorio.
            <InlineLoader text="Cargando catalogo..." />
          ) : allFields.length === 0 ? ( // Maneja caso de catalogo sin columnas detectables.
            <div className="alert alert-info mb-0">No hay estructura de columnas disponible para este catalogo.</div>
          ) : filteredRows.length === 0 ? ( // Maneja vacio por falta de datos o por filtro.
            <div className="alert alert-light border mb-0">{rows.length === 0 ? 'No hay registros para mostrar.' : 'No hay coincidencias con la busqueda actual.'}</div>
          ) : ( // Renderiza tabla dinamica cuando existen filas.
            <div className="table-responsive"> {/* Habilita scroll horizontal en pantallas chicas. */}
              <table className="table table-sm table-striped align-middle mb-0"> {/* Tabla bootstrap compacta para catalogos. */}
                <thead> {/* Encabezado dinamico de columnas. */}
                  <tr> {/* Fila de encabezados. */}
                    <th style={{ width: 70 }}>No.</th>
                    {allFields.map((field) => (<th key={`head-${catalogo?.tabla}-${field}`} className="text-nowrap">{toFieldLabel(field)}{/* Muestra nombre de columna dinamica. */}</th>))} {/* Renderiza encabezados por campo. */}
                    <th className="text-end" style={{ minWidth: 220 }}>Acciones</th>
                  </tr>
                </thead>

                <tbody> {/* Cuerpo de datos del catalogo. */}
                  {filteredRows.map((row, index) => ( // Itera filas filtradas para renderizar registros.
                    <tr key={`${catalogo?.tabla || 'catalogo'}-${toDisplayText(row?.[idField] ?? index)}-${index}`}> {/* Usa key estable por tabla+id+indice. */}
                      <td className="text-muted">{index + 1}</td>
                      {allFields.map((field) => (<td key={`cell-${catalogo?.tabla}-${index}-${field}`}>{toDisplayText(row?.[field]) || '-'}</td>))} {/* Muestra celdas dinamicas por columna. */}
                      <td className="text-end"> {/* Columna de botones de accion por fila. */}
                        <div className="d-inline-flex gap-2"> {/* Agrupa botones con separacion uniforme. */}
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setRowToEdit(row)} disabled={!canEditDelete || saving}>Editar{/* Abre modal de edicion para la fila. */}</button>
                          <ConfirmButton className="btn btn-sm btn-outline-danger" confirmText={`Confirma eliminar este registro de ${catalogo?.label || 'catalogo'}?`} onConfirm={() => handleDelete(row)} disabled={!canEditDelete || saving}>Eliminar{/* Solicita confirmacion antes de borrar. */}</ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  ))} {/* Cierra iteracion de filas. */}
                </tbody>
              </table>
            </div>
          )} {/* Cierra arbol condicional de estados. */}
        </div>
      </div>

      <CreateCatalogoModal show={showCreateModal} title={`Nuevo registro - ${catalogo?.label || 'Catalogo'}`} fields={formFields} saving={saving} onClose={() => setShowCreateModal(false)} onSubmit={handleCreate} />
      <EditCatalogoModal show={Boolean(rowToEdit)} title={`Editar registro - ${catalogo?.label || 'Catalogo'}`} row={rowToEdit} fields={formFields} saving={saving} onClose={() => setRowToEdit(null)} onSubmit={handleEditSave} />
    </>
  ); // Cierra retorno JSX.
}; // Cierra componente CatalogoTab.

export default CatalogoTab; // Exporta tab generico para uso desde Parametros.




