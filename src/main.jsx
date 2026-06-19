import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import { bootstrapClientStorage } from './utils/appBoot';

import './index.css';
import App from './App.jsx';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

bootstrapClientStorage();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </AppErrorBoundary>
  </StrictMode>
);

