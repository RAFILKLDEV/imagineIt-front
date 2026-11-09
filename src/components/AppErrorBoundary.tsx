import React from 'react';

type State = { error: Error | null };

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="flex min-h-screen items-center justify-center bg-[#0e0e16] p-6 text-white"><section className="max-w-lg rounded-3xl border border-red-300/20 bg-red-300/5 p-6"><h1 className="text-xl font-semibold">Não foi possível abrir esta tela</h1><p className="mt-2 text-sm text-white/65">Recarregue a página. Se o problema persistir, reinicie o frontend e verifique o backend.</p><button type="button" className="mt-5 rounded-xl bg-[#8f86ff] px-4 py-2 font-semibold text-[#141420]" onClick={() => window.location.reload()}>Recarregar</button></section></main>;
  }
}
