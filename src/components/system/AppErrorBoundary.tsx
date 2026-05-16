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
    const message = this.state.message || 'Erreur inconnue';
    const isChunkIssue = /mime type|text\/html|dynamically imported module|loading chunk|failed to fetch/i.test(message);

    return (
      <div className="min-h-screen bg-[#050505] px-6 py-16 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-rose-200">Erreur application</p>
          <h1 className="mt-3 text-2xl font-bold">Un problème bloque le chargement</h1>
          <p className="mt-3 text-rose-100">Message: {message}</p>
          {isChunkIssue ? (
            <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
              Connexion lente ou cache navigateur détecté. Utilisez “Recharger” pour relancer proprement.
            </p>
          ) : null}
          <p className="mt-4 text-sm text-rose-100/90">
            Rechargez la page. Si l’erreur persiste, envoyez ce message pour correction immédiate.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }
}
