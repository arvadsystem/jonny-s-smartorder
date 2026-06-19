import React from 'react';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('APP_ERROR_BOUNDARY', error, info);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#f8f9fa',
          color: '#212529',
          padding: 24
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            background: '#fff',
            border: '1px solid #e9ecef',
            borderRadius: 12,
            padding: 24,
            boxShadow: '0 8px 28px rgba(0,0,0,0.06)',
            textAlign: 'center'
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>Ocurrio un error inesperado</h2>
          <p style={{ margin: '12px 0 16px', color: '#495057' }}>
            La interfaz no pudo renderizarse correctamente. Puedes reintentar sin perder tu sesion activa.
          </p>
          <button type="button" className="btn btn-primary" onClick={this.handleReload}>
            Recargar aplicacion
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;

