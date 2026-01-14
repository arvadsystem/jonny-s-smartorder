import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Importamos el hook de seguridad
import authService from '../../services/authService';
import logo from '../../assets/images/Logo-jonnys-sinFondo.jpeg';
import './Login.scss';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); // Usamos la función login del contexto

  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credentials = {
        nombre_usuario: nombreUsuario,
        clave: password
      };

      const response = await authService.login(credentials);

      console.log('Login exitoso:', response);

      // ✅ NUEVA LÓGICA (cookies): ya no existe response.token, solo guardamos usuario en contexto
      if (response?.usuario) {
        login(response.usuario);
      }

      // Redirigimos al Dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error(err);

      let mensajeError = err.message;

      // Personalizamos el error de conexión
      if (mensajeError === 'Failed to fetch' || mensajeError.includes('NetworkError')) {
        mensajeError = 'Error de conexión con el servidor';
      }

      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card shadow-lg">
        <img src={logo} alt="Jonny's Logo" className="login-logo img-fluid" />

        <h3>Jonny's Smart Orden</h3>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="mb-4 text-start">
            <input
              type="text"
              className="form-control"
              placeholder="Nombre de Usuario"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              required
            />
          </div>

          <div className="input-group mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              className="form-control"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ borderRight: 'none' }}
            />
            <span className="input-group-text" onClick={togglePasswordVisibility}>
              <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
            </span>
          </div>

          <div className="d-flex justify-content-between align-items-center options-row">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="rememberMe" />
              <label className="form-check-label" htmlFor="rememberMe">
                Recordar contraseña
              </label>
            </div>
            <a href="#" className="">
              Olvidé mi contraseña
            </a>
          </div>

          <div className="d-grid gap-3">
            <button
              type="submit"
              className="btn btn-jonnys-red text-uppercase fw-bold"
              disabled={loading}
            >
              {loading ? 'Validando...' : 'Iniciar Sesion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

