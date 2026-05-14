/**
 * MenuPublico.jsx
 * Catálogo público de productos/platos de Jonnys.
 * Puede ser accedido sin autenticación.
 * El cliente puede agregar ítems al carrito (localStorage).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clientePublicoService from '../../services/clientePublicoService';
import { useCarrito } from '../../hooks/useCarrito';
import './MenuPublico.scss';

const MenuPublico = () => {
  const navigate = useNavigate();
  const { agregar, cantidad } = useCarrito();

  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('Todos');
  const [busqueda, setBusqueda] = useState('');
  const [agregado, setAgregado] = useState({});

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      try {
        const data = await clientePublicoService.getMenu();
        setMenu(data?.menu || []);
      } catch (err) {
        setError('No se pudo cargar el menú. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  const categorias = ['Todos', ...new Set(menu.map((i) => i.categoria).filter(Boolean))];

  const filtrados = menu.filter((item) => {
    const enCategoria = categoriaActiva === 'Todos' || item.categoria === categoriaActiva;
    const enBusqueda =
      !busqueda ||
      item.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.descripcion?.toLowerCase().includes(busqueda.toLowerCase());
    return enCategoria && enBusqueda;
  });

  const handleAgregar = (item) => {
    agregar({
      id: item.id_menu,
      nombre: item.nombre,
      precio: parseFloat(item.precio),
      imagen_url: item.imagen_url
    });
    setAgregado((prev) => ({ ...prev, [item.id_menu]: true }));
    setTimeout(() => setAgregado((prev) => ({ ...prev, [item.id_menu]: false })), 1200);
  };

  return (
    <div className="menu-publico">
      {/* Header */}
      <div className="menu-publico__header">
        <h1>Nuestro Menú</h1>
        <p>Explora nuestros platos y agrégalos a tu pedido</p>

        <div className="menu-publico__search">
          <i className="bi bi-search" />
          <input
            type="text"
            placeholder="Buscar platos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Categorías */}
      <div className="menu-publico__cats">
        {categorias.map((cat) => (
          <button
            key={cat}
            className={`menu-publico__cat-btn${categoriaActiva === cat ? ' active' : ''}`}
            onClick={() => setCategoriaActiva(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Estado */}
      {loading && (
        <div className="menu-publico__loading">
          <div className="spinner" />
          <span>Cargando menú...</span>
        </div>
      )}

      {error && !loading && (
        <div className="menu-publico__error">{error}</div>
      )}

      {/* Grid de ítems */}
      {!loading && !error && (
        <div className="menu-publico__grid">
          {filtrados.length === 0 ? (
            <div className="menu-publico__empty">No se encontraron platos.</div>
          ) : (
            filtrados.map((item) => (
              <div className="menu-card" key={item.id_menu}>
                <div className="menu-card__img-wrap">
                  {item.imagen_url ? (
                    <img src={item.imagen_url} alt={item.nombre} />
                  ) : (
                    <div className="menu-card__img-placeholder">
                      <i className="bi bi-egg-fried" />
                    </div>
                  )}
                  {item.categoria && (
                    <span className="menu-card__cat-tag">{item.categoria}</span>
                  )}
                </div>

                <div className="menu-card__body">
                  <h3>{item.nombre}</h3>
                  {item.descripcion && <p>{item.descripcion}</p>}
                  <div className="menu-card__footer">
                    <span className="menu-card__price">
                      L. {parseFloat(item.precio).toFixed(2)}
                    </span>
                    <button
                      className={`menu-card__add-btn${agregado[item.id_menu] ? ' added' : ''}`}
                      onClick={() => handleAgregar(item)}
                    >
                      {agregado[item.id_menu] ? (
                        <><i className="bi bi-check2" /> Agregado</>
                      ) : (
                        <><i className="bi bi-plus-lg" /> Agregar</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Botón flotante del carrito */}
      {cantidad > 0 && (
        <button className="menu-publico__cart-fab" onClick={() => navigate('/carrito')}>
          <i className="bi bi-cart3" />
          <span className="fab-badge">{cantidad}</span>
          Ver carrito
        </button>
      )}
    </div>
  );
};

export default MenuPublico;

