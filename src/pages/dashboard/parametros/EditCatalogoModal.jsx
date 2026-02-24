import { useEffect, useMemo, useState } from 'react'; // Importa hooks para estado local y sincronizacion del formulario.

const toFieldLabel = (fieldName) => { // Convierte nombre tecnico de columna a etiqueta legible.
  return String(fieldName || '') // Asegura que siempre trabaje con texto.
    .replace(/^id_/i, 'ID ') // Hace visible el prefijo id_ como ID.
    .replace(/_/g, ' ') // Reemplaza guiones bajos por espacios.
    .replace(/\s+/g, ' ') // Elimina espacios repetidos para una etiqueta limpia.
    .trim() // Remueve espacios extremos.
    .replace(/\b\w/g, (letter) => letter.toUpperCase()); // Capitaliza cada palabra para interfaz.
}; // Cierra helper de etiqueta.

const toComparableText = (value) => { // Normaliza valores para comparar cambios sin errores de tipo.
  if (value === null || value === undefined) return ''; // Convierte nulos e indefinidos a cadena vacia.
  return String(value); // Convierte el resto de tipos a texto sin casteo adicional.
}; // Cierra helper de comparacion.

const EditCatalogoModal = ({ show, title, row, fields = [], saving = false, onClose, onSubmit }) => { // Define modal generico de edicion.
  const [form, setForm] = useState({}); // Guarda los valores editables por campo.
  const [localError, setLocalError] = useState(''); // Guarda errores locales del modal.

  const hasRow = useMemo(() => !!row && typeof row === 'object', [row]); // Valida que exista una fila seleccionada para editar.
  const hasFields = useMemo(() => Array.isArray(fields) && fields.length > 0, [fields]); // Verifica que existan campos editables.

  useEffect(() => { // Sincroniza el formulario cada vez que abre modal o cambia la fila.
    if (!show || !hasRow) { // Maneja cierre del modal o ausencia de fila.
      setForm({}); // Limpia el formulario cuando no hay fila activa.
      setLocalError(''); // Limpia errores al cerrar/reiniciar.
      return; // Finaliza temprano cuando no hay contexto valido.
    } // Cierra condicion de seguridad inicial.

    const nextForm = {}; // Prepara objeto local de formulario.
    fields.forEach((field) => { // Recorre todos los campos editables.
      nextForm[field] = toComparableText(row?.[field]); // Precarga cada input con el valor original visible.
    }); // Cierra ciclo de precarga.

    setForm(nextForm); // Aplica valores iniciales de edicion.
    setLocalError(''); // Limpia errores previos antes de editar.
  }, [show, hasRow, row, fields]); // Ejecuta efecto al cambiar visibilidad, fila o columnas.

  const handleChange = (field, value) => { // Actualiza un campo del formulario de edicion.
    setForm((prev) => ({ ...prev, [field]: value })); // Mantiene valores existentes y cambia solo el campo objetivo.
  }; // Cierra manejador de cambios.

  const handleSubmit = async (event) => { // Construye y envia solo campos modificados.
    event.preventDefault(); // Evita recarga de pagina.
    setLocalError(''); // Limpia error antes del intento de guardado.

    if (!hasRow) { // Verifica que exista un registro para comparar cambios.
      setLocalError('No se encontro el registro a editar.'); // Informa inconsistencia de estado.
      return; // Cancela envio si no hay fila activa.
    } // Cierra validacion de fila activa.

    if (!hasFields) { // Verifica metadatos de campos editables.
      setLocalError('No hay columnas disponibles para actualizar.'); // Informa problema de configuracion.
      return; // Evita llamar al backend sin campos.
    } // Cierra validacion de campos.

    const changes = {}; // Acumula pares campo/valor realmente modificados.
    fields.forEach((field) => { // Revisa campo por campo para detectar diferencias.
      const originalValue = toComparableText(row?.[field]); // Obtiene valor original normalizado.
      const updatedValue = toComparableText(form[field]); // Obtiene valor editado normalizado.
      if (updatedValue !== originalValue) { // Detecta cambios reales para minimizar PUT innecesarios.
        changes[field] = form[field]; // Conserva valor tal cual fue escrito en el input.
      } // Cierra comparacion por campo.
    }); // Cierra calculo de cambios.

    try { // Intenta delegar guardado secuencial al componente padre.
      await onSubmit?.(changes); // Llama callback opcional con solo los cambios.
    } catch (error) { // Captura error retornado por la capa de datos.
      setLocalError(error?.message || 'No se pudo actualizar el registro.'); // Muestra mensaje explicativo en modal.
    } // Cierra bloque try/catch.
  }; // Cierra manejador de submit.

  if (!show || !hasRow) return null; // No renderiza modal cuando no esta visible o no hay fila.

  return ( // Renderiza modal bootstrap de edicion.
    <> {/* Agrupa modal y backdrop en un unico retorno. */}
      <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true" onClick={onClose}> {/* Dibuja overlay y wrapper del modal. */}
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}> {/* Centra dialogo y evita cierre por click interno. */}
          <div className="modal-content"> {/* Contenedor principal del modal. */}
            <form onSubmit={handleSubmit}> {/* Vincula submit con validacion y deteccion de cambios. */}
              <div className="modal-header"> {/* Encabezado con titulo contextual y boton cerrar. */}
                <h5 className="modal-title">{title || 'Editar registro'}{/* Muestra titulo dinamico del modal. */}</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} disabled={saving} />
              </div>

              <div className="modal-body"> {/* Cuerpo con mensajes y campos editables. */}
                {localError ? <div className="alert alert-danger py-2 mb-3">{localError}</div> : null} {/* Muestra errores locales de edicion. */}
                {!hasFields ? <div className="alert alert-warning py-2 mb-0">No hay columnas configuradas para editar.</div> : null} {/* Advierte si no hay metadatos para editar. */}

                {hasFields ? ( // Dibuja grilla solo cuando hay campos configurados.
                  <div className="row g-3"> {/* Distribuye inputs en dos columnas responsivas. */}
                    {fields.map((field) => ( // Itera campos editables para crear controles dinamicos.
                      <div className="col-12 col-md-6" key={`edit-field-${field}`}> {/* Define columna responsive por campo. */}
                        <label className="form-label">{toFieldLabel(field)}{/* Muestra etiqueta amigable de columna. */}</label>
                        <input className="form-control" value={form[field] ?? ''} onChange={(event) => handleChange(field, event.target.value)} placeholder={`Edita ${toFieldLabel(field).toLowerCase()}...`} />
                      </div>
                    ))} {/* Cierra mapa de campos dinamicos. */}
                  </div>
                ) : null} {/* Cierra render condicional de campos. */}
              </div>

              <div className="modal-footer"> {/* Pie con acciones de cancelar y guardar. */}
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar{/* Cierra sin guardar cambios. */}</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !hasFields}>{saving ? 'Guardando...' : 'Guardar cambios'}{/* Ejecuta submit de cambios. */}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  ); // Cierra retorno JSX.
}; // Cierra componente EditCatalogoModal.

export default EditCatalogoModal; // Exporta componente para uso en CatalogoTab.



