const DepartamentosEmptyState = ({ message = 'No hay departamentos para mostrar.' }) => (
  <div className="text-center py-5 text-muted">
    <i className="bi bi-diagram-3 fs-3 d-block mb-2" />
    {message}
  </div>
);

export default DepartamentosEmptyState;
