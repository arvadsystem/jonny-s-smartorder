import { useState } from 'react';
import logo from '../../assets/images/logo-jonnys.png';
import './Login.scss'; // <--- AQUÍ importamos el archivo de estilos que acabas de crear

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Intento de login:', { email, password });
  };

  return (
    <div className="login-page">
      <div className="login-card shadow-lg">
        <img src={logo} alt="Jonny's Logo" className="login-logo img-fluid" />
        
        <h3>Jonny's Smart Orden</h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4 text-start">
            <input
              type="email"
              className="form-control"
              placeholder="Correo Electronico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group mb-4">
            <input
              type={showPassword ? "text" : "password"}
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
            <a href="#" className="">Olvidé mi contraseña</a>
          </div>

          <div className="d-grid gap-3">
            <button type="button" className="btn btn-jonnys-red text-uppercase">
              Registrar
            </button>
             <button type="submit" className="btn btn-jonnys-outline text-uppercase">
              Iniciar Sesion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;