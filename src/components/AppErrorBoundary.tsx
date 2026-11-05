import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro na interface do Envio de Brindes:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1F4F8] p-6">
        <section role="alert" className="w-full max-w-md rounded-lg border border-[#DDE3EC] bg-white p-7 shadow-sm space-y-4">
          <p className="font-bold text-[#1A3A6B]">HERCULES · ENVIO DE BRINDES</p>
          <h1 className="text-xl font-semibold text-[#1E293B]">Não foi possível abrir esta tela</h1>
          <p className="text-sm text-[#64748B]">
            Ocorreu um erro ao exibir o sistema. Nenhum registro foi alterado por esta mensagem.
            Atualize a página para tentar novamente.
          </p>
          <button onClick={() => window.location.reload()}
            className="rounded bg-[#1A3A6B] px-4 py-2 text-white text-sm">
            Atualizar página
          </button>
          <p className="text-xs text-[#64748B]">
            Se o problema continuar, abra F12 → Console e informe a primeira mensagem de erro.
          </p>
        </section>
      </div>
    );
  }
}
