const RecetasEmptyState = ({ message = 'No hay recetas para mostrar.' }) => (
  <div className="text-center py-5 text-muted">
    <i className="bi bi-journal-richtext fs-3 d-block mb-2" />
    {message}
  </div>
);

export default RecetasEmptyState;
