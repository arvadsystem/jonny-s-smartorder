// ventasService/storage es la UNICA fuente de verdad sobre si existe una operacion de
// pedido pendiente protegida. El estado de React (pedidoPendienteOperationRef /
// pedidoPendienteOperation) es solo una representacion de esa verdad -- nunca debe
// divergir de ella despues de un resultado terminal (SUCCESS/FAILED/REJECTED/422).
//
// Incidente corregido: tras un rechazo definitivo, ventasService ya limpiaba
// correctamente su storage (getPedidoPendienteOperation() devolvia null), pero
// CajaView restauraba en su lugar `error.operation` o la operacion previa (`target`/
// el ref anterior), dejando un UNKNOWN "fantasma" solo en React que seguia
// bloqueando el POS aunque el service ya no tuviera ningun candado.
//
// Esta funcion PURA es el unico punto de decision: el resultado depende exclusivamente
// de `serviceOperation` (lo que el service tiene AHORA). `previousOperation` y `error`
// se aceptan solo para dejar explicito en el call-site que existieron y fueron
// deliberadamente descartados -- nunca influyen en el resultado.
export const resolvePedidoPendienteUiAfterError = ({
  serviceOperation = null,
  previousOperation = null, // eslint-disable-line no-unused-vars
  error = null // eslint-disable-line no-unused-vars
} = {}) => serviceOperation || null;

export const dispatchPedidoPendientePostCreationTasks = (tasks = [], onTaskError = null) => {
  const executions = (Array.isArray(tasks) ? tasks : []).map(({ name = 'unknown', run }) => (
    Promise.resolve()
      .then(() => run?.())
      .catch((error) => {
        try {
          onTaskError?.({ name, error });
        } catch {
          // Incluso una notificacion secundaria defectuosa queda fuera de la creacion confirmada.
        }
        return null;
      })
  ));
  void Promise.all(executions);
  return executions;
};
