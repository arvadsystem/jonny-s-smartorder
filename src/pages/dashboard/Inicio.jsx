import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Inicio = () => {
  const { user } = useAuth();

  const nombre = user?.nombre_usuario ? user.nombre_usuario : 'Gerson';

  return (
    <div className="welcome-section fade-in">
      <div className="welcome-card">
        <div className="content">
          <h1>¡Bienvenido de nuevo, {nombre}!</h1>
          <p>
            Selecciona una opción del menú lateral para comenzar a gestionar tu negocio.
          </p>

          <Link to="/dashboard/ventas">
            <button className="btn-black">Ir al Dashboard</button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Inicio;

