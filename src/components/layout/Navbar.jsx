import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Para redireccionar
import userAvatar from '../../assets/images/logo-jonnys.png'; 

const Navbar = ({ nombreUsuario }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleLogout = () => {
    localStorage.removeItem('usuario');
    navigate('/', { replace: true });
  };

  return (
    <div className="top-navbar">
      {/* Buscador */}
      <div className="search-container">
        <i className="bi bi-search"></i>
        <input type="text" placeholder="Buscar en el sistema..." />
      </div>

      {/* Perfil Dropdown */}
      <div className="user-profile-container" onClick={toggleDropdown}>
        
        {/* La parte visible siempre */}
        <div className="user-profile">
            <div className="text-info d-none d-sm-block">
                <h6>{nombreUsuario}</h6>
                <p>Super Admin</p>
            </div>
            <img src={userAvatar} alt="Perfil" />
            {/* Pequeña flecha indicando que es menú */}
            <i className={`bi bi-chevron-down small ms-2 text-muted ${isOpen ? 'd-none' : ''}`} style={{fontSize: '0.8rem'}}></i>
             <i className={`bi bi-chevron-up small ms-2 text-muted ${!isOpen ? 'd-none' : ''}`} style={{fontSize: '0.8rem'}}></i>
        </div>

        {/* El Menú Desplegable (Solo si isOpen es true) */}
        {isOpen && (
            <div className="dropdown-menu-custom">
                <ul>
                    {/* Aquí puedes agregar 'Mi Perfil' en el futuro */}
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