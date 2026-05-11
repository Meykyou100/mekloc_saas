import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppErrorBoundary from './components/system/AppErrorBoundary';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <DataProvider>
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
          </DataProvider>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
