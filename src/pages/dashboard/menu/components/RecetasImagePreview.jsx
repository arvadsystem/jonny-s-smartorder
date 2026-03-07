import { useEffect, useMemo, useState } from 'react';
import { getImageUrlCandidates } from '../utils/recetasAdminUtils';

const RecetasImagePreview = ({ imageUrl, hasError, onError }) => {
  const candidates = useMemo(() => getImageUrlCandidates(imageUrl), [imageUrl]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setAttempt(0);
  }, [imageUrl]);

  const currentUrl = candidates[attempt] || '';

  const handleError = () => {
    if (attempt + 1 < candidates.length) {
      setAttempt((prev) => prev + 1);
      return;
    }
    if (typeof onError === 'function') {
      onError();
    }
  };

  return (
    <div className="menu-recetas-admin__form-image-preview">
      {currentUrl && !hasError ? (
        <img
          src={currentUrl}
          alt="Preview de receta"
          onError={handleError}
        />
      ) : (
        <div className="menu-recetas-admin__form-image-placeholder">
          <i className="bi bi-image" />
          <span>{imageUrl ? 'No se pudo cargar la URL' : 'Sin imagen seleccionada'}</span>
        </div>
      )}
    </div>
  );
};

export default RecetasImagePreview;
