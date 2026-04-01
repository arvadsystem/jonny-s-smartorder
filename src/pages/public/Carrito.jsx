/**
 * Carrito.jsx
 * Página de carrito. Muestra ítems del carrito local (localStorage).
 * Si el usuario no está autenticado y toca "Confirmar pedido",
 * lo redirige al Login con un parámetro indicando que viene del carrito.
 */
import { useNavigate } from 'react-router-dom';
import { useCarrito } from '../../hooks/useCarrito';
import { useAuth } from '../../hooks/useAuth';
import './Carrito.scss';

const Carrito = () => {
  const navigate = useNavigate();
  const { items, quitar, actualizar, limpiar, total } = useCarrito();
  const { user } = useAuth();

  const isCliente = user?.tipo_usuario === 'CLIENTE' || user?.roles?.includes('Cliente');

  const handleConfirmar = () => {
    if (!user || !isCliente) {
      // Redirigir al login con el origen del carrito.
      navigate('/?from=carrito');
      return;
    }
    // Si ya está autenticado como cliente, proceder al checkout.
    navigate('/cliente/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="carrito carrito--vacio">
        <i className="bi bi-cart-x" />
        <h2>Tu carrito está vacío</h2>
        <p>Agrega productos desde el menú para comenzar tu pedido.</p>
        <button className="carrito__volver-btn" onClick={() => navigate('/menu')}>
          Ver menú
        </button>
      </div>
    );
  }

  return (
    <div className="carrito">
      <div className="carrito__header">
        <h2>Tu pedido</h2>
        <button className="carrito__limpiar" onClick={limpiar}>
          <i className="bi bi-trash3" /> Vaciar
        </button>
      </div>

      <div className="carrito__items">
        {items.map((item) => (
          <div className="carrito-item" key={item.id}>
            {item.imagen_url && (
              <img src={item.imagen_url} alt={item.nombre} className="carrito-item__img" />
            )}
            <div className="carrito-item__info">
              <span className="carrito-item__nombre">{item.nombre}</span>
              <span className="carrito-item__precio">
                L. {(item.precio * item.cantidad).toFixed(2)}
              </span>
            </div>
            <div className="carrito-item__qty">
              <button onClick={() => actualizar(item.id, item.cantidad - 1)}>−</button>
              <span>{item.cantidad}</span>
              <button onClick={() => actualizar(item.id, item.cantidad + 1)}>+</button>
            </div>
            <button className="carrito-item__remove" onClick={() => quitar(item.id)}>
              <i className="bi bi-x-lg" />
            </button>
          </div>
        ))}
      </div>

      <div className="carrito__resumen">
        <div className="carrito__total">
          <span>Total estimado</span>
          <strong>L. {total.toFixed(2)}</strong>
        </div>
        <p className="carrito__nota">
          * Precio final sujeto a confirmación en caja.
        </p>
        <button className="carrito__confirmar" onClick={handleConfirmar}>
          {!user || !isCliente ? 'Iniciar sesión para confirmar' : 'Confirmar pedido →'}
        </button>
        <button className="carrito__seguir" onClick={() => navigate('/menu')}>
          ← Seguir viendo el menú
        </button>
      </div>
    </div>
  );
};

export default Carrito;
