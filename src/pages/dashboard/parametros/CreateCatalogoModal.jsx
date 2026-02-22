import { useEffect, useMemo, useState } from 'react'; // Importa hooks para estado local, memo y sincronizacion del modal.

const toFieldLabel = (fieldName) => { // Convierte el nombre tecnico de columna a etiqueta legible.
  return String(fieldName || '') // Asegura que siempre trabaje con texto.
    .replace(/^id_/i, 'ID ') // Hace visible el prefijo id_ como ID.
    .replace(/_/g, ' ') // Reemplaza guiones bajos por espacios.
    .replace(/\s+/g, ' ') // Limpia espacios repetidos en la etiqueta.
    .trim() // Remueve espacios al inicio o final.
    .replace(/\b\w/g, (letter) => letter.toUpperCase()); // Capitaliza cada palabra para UI.
}; // Cierra helper de etiqueta.

const CreateCatalogoModal = ({ show, title, fields = [], saving = false, onClose, onSubmit }) => { // Define el modal generico de creacion.
  const [form, setForm] = useState({}); // Guarda los valores capturados por campo.
  const [localError, setLocalError] = useState(''); // Guarda un error local del modal.

  const hasFields = useMemo(() => Array.isArray(fields) && fields.length > 0, [fields]); // Determina si hay columnas editables disponibles.

  useEffect(() => { // Reinicia el formulario al abrir el modal o cambiar campos.
    if (!show) return; // Evita trabajo cuando el modal no esta visible.
    const nextForm = {}; // Prepara el objeto base para cada input.
    fields.forEach((field) => { // Recorre todos los campos permitidos.
      nextForm[field] = ''; // Inicializa cada input como cadena vacia.
    }); // Cierra iteracion de campos.
    setForm(nextForm); // Aplica el formulario limpio para una nueva creacion.
    setLocalError(''); // Limpia mensajes de error anteriores.
  }, [show, fields]); // Reacciona a visibilidad y metadatos de columnas.

  const handleChange = (field, value) => { // Actualiza solo el campo modificado por el usuario.
    setForm((prev) => ({ ...prev, [field]: value })); // Conserva valores previos y sobrescribe el campo actual.
  }; // Cierra manejador de cambio.

  const handleSubmit = async (event) => { // Envia el payload de creacion al componente padre.
    event.preventDefault(); // Evita recarga completa de pagina.
    setLocalError(''); // Limpia error local antes de validar.

    if (!hasFields) { // Bloquea envio cuando no hay columnas para crear.
      setLocalError('No hay columnas disponibles para crear registros.'); // Notifica problema de metadata.
      return; // Sale temprano para evitar request invalida.
    } // Cierra validacion de campos.

    const payload = {}; // Construye el objeto final que viaja al backend.
    fields.forEach((field) => { // Recorre todos los campos visibles del formulario.
      const rawValue = form[field]; // Lee el valor escrito por el usuario.
      if (rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== '') { // Solo incluye campos con contenido.
        payload[field] = rawValue; // Asigna el valor sin casteos agresivos.
      } // Cierra condicion de campo con valor.
    }); // Cierra la construccion del payload.

    if (Object.keys(payload).length === 0) { // Evita POST vacio para reducir errores de base de datos.
      setLocalError('Completa al menos un campo antes de guardar.'); // Informa al usuario como proceder.
      return; // Detiene el envio del formulario.
    } // Cierra validacion de payload minimo.

    try { // Intenta ejecutar la operacion de creacion delegada al padre.
      await onSubmit?.(payload); // Ejecuta callback opcional con los datos listos.
    } catch (error) { // Captura cualquier error lanzado por el guardado.
      setLocalError(error?.message || 'No se pudo crear el registro.'); // Muestra mensaje util en el modal.
    } // Cierra bloque try/catch de submit.
  }; // Cierra manejador de envio.

  if (!show) return null; // No renderiza nada cuando el modal esta cerrado.

  return ( // Renderiza modal bootstrap controlado por React.
    <> {/* Agrupa modal y backdrop en un fragmento. */}
      <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.55)' }} role="dialog" aria-modal="true" onClick={onClose}> {/* Dibuja capa oscura y contenedor modal. */}
        <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(event) => event.stopPropagation()}> {/* Centra el dialogo y evita cierre al click interno. */}
          <div className="modal-content"> {/* Renderiza tarjeta principal del modal. */}
            <form onSubmit={handleSubmit}> {/* Enlaza el submit con validacion y guardado. */}
              <div className="modal-header"> {/* Encabezado del modal con titulo y cierre. */}
                <h5 className="modal-title">{title || 'Nuevo registro'}{/* Muestra titulo dinamico del formulario. */}</h5>
                <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} disabled={saving} />
              </div>

              <div className="modal-body"> {/* Cuerpo con errores y campos dinamicos. */}
                {localError ? <div className="alert alert-danger py-2 mb-3">{localError}</div> : null} {/* Presenta errores locales del modal. */}
                {!hasFields ? <div className="alert alert-warning py-2 mb-0">No hay columnas configuradas para este catalogo.</div> : null} {/* Advierte cuando no hay metadata util. */}

                {hasFields ? ( // Solo pinta formulario cuando existen campos editables.
                  <div className="row g-3"> {/* Usa grilla bootstrap para acomodar inputs. */}
                    {fields.map((field) => ( // Crea un input por cada columna editable.
                      <div className="col-12 col-md-6" key={`create-field-${field}`}> {/* Define ancho responsive por campo. */}
                        <label className="form-label">{toFieldLabel(field)}{/* Etiqueta legible para el usuario. */}</label>
                        <input className="form-control" value={form[field] ?? ''} onChange={(event) => handleChange(field, event.target.value)} placeholder={`Ingresa ${toFieldLabel(field).toLowerCase()}...`} />
                      </div>
                    ))} {/* Cierra renderizado dinamico de campos. */}
                  </div>
                ) : null} {/* Cierra render condicional del formulario. */}
              </div>

              <div className="modal-footer"> {/* Pie del modal con acciones principales. */}
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancelar{/* Permite salir sin guardar cambios. */}</button>
                <button type="submit" className="btn btn-primary" disabled={saving || !hasFields}>{saving ? 'Guardando...' : 'Guardar'}{/* Ejecuta submit de creacion. */}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  ); // Cierra retorno JSX.
}; // Cierra componente CreateCatalogoModal.

export default CreateCatalogoModal; // Exporta modal para uso en CatalogoTab.




