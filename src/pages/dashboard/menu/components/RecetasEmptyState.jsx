const RecetasEmptyState = ({ message = 'No hay recetas para mostrar.' }) => (
  <div className="text-center py-4">{message}</div>
);

export default RecetasEmptyState;
