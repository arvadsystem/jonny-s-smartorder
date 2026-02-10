import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Importamos el hook
import userAvatar from '../../assets/images/logo-jonnys.png';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth(); // Traemos datos del contexto

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleLogout = async () => {

    await logout();
    navigate('/', { replace: true });
  };

  // Datos seguros del usuario
  const userName = user?.nombre_usuario || 'Invitado';
  const userRole = user?.rol === 1 ? 'Super Admin' : 'Usuario';

  return (
    <div className="top-navbar">
      {/* 1. Buscador Central/Izquierdo */}
      <div>
        
        
      </div>

      {/* 2. Perfil Dropdown */}
      <div className="user-profile-container" onClick={toggleDropdown}>
        {/* Parte visible siempre */}
        <div className="user-profile">
          <div className="text-info d-none d-sm-block">
            <h6>{userName}</h6>
            <p>{userRole}</p>
          </div>
          <img src={userAvatar} alt="Perfil" />

          {/* Indicadores de flecha */}
          <i
            className={`bi bi-chevron-down small ms-2 text-muted ${isOpen ? 'd-none' : ''}`}
            style={{ fontSize: '0.8rem' }}
          ></i>
          <i
            className={`bi bi-chevron-up small ms-2 text-muted ${!isOpen ? 'd-none' : ''}`}
            style={{ fontSize: '0.8rem' }}
          ></i>
        </div>

        {/* Menú Flotante (Dropdown) */}
        {isOpen && (
          <div className="dropdown-menu-custom">
            <ul>
              <li onClick={() => navigate("/dashboard/perfil")}>
                  <i className="bi bi-person-circle"></i>
                  Mi perfil
              </li>
              <li onClick={handleLogout}>
                <i className="bi bi-box-arrow-right"></i>
                Cerrar Sesión
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;


