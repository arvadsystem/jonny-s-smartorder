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
