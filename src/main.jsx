import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // <--- IMPORTANTE
import './index.css'
import App from './App.jsx'
// Importamos JS de Bootstrap para que funcione el toggle del sidebar móvil
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
