import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppErrorBoundary from './components/system/AppErrorBoundary';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { SupportModeProvider } from './context/SupportModeContext';
import './styles/index.css';

const bootWatchdog = window.setTimeout(() => {
  const w = window as Window & { __MEKLOC_APP_READY__?: boolean };
  if (w.__MEKLOC_APP_READY__) return;
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;background:#050505;color:#fff;padding:48px 24px;font-family:Inter,system-ui,sans-serif">
      <div style="max-width:760px;margin:0 auto;border:1px solid rgba(244,63,94,.4);background:rgba(244,63,94,.08);border-radius:16px;padding:20px">
        <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#fecdd3;font-weight:700">Erreur de démarrage</p>
        <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2">L'application ne démarre pas correctement</h1>
        <p style="margin:12px 0 0;color:#ffe4e6">Rechargez la page (Cmd+Shift+R). Si ça continue, ouvrez la console navigateur et envoyez la première erreur rouge.</p>
      </div>
    </div>
  `;
}, 4000);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <SupportModeProvider>
            <DataProvider>
              <AppErrorBoundary>
                <App />
              </AppErrorBoundary>
            </DataProvider>
          </SupportModeProvider>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
