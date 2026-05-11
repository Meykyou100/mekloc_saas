import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Erreur inconnue' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App runtime error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#050505] px-6 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-200">Erreur application</p>
          <h1 className="mt-3 text-2xl font-bold">Un problème bloque le chargement</h1>
          <p className="mt-3 text-rose-100">Message: {this.state.message}</p>
          <p className="mt-4 text-sm text-rose-100/90">
            Rechargez la page. Si l’erreur persiste, envoyez ce message pour correction immédiate.
          </p>
        </div>
      </div>
    );
  }
}

