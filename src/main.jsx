import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'; // <--- IMPORTANTE

import './index.css'
import App from './App.jsx'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider> {/* <--- ENVOLVEMOS LA APP AQUÍ */}
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
