import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Último recurso ante un error de render.
 *
 * React 19 **desmonta el árbol completo** cuando un error de render no se
 * captura: la app no queda a medias, queda en blanco. Es exactamente lo que
 * pasó dos veces en este proyecto (el `<Tabs.Indicator />` de HeroUI, y una
 * pantalla en blanco después) y en ambas el diagnóstico costó más que el
 * arreglo, porque una pantalla blanca no dice nada y el error solo vivía en la
 * consola del navegador.
 *
 * Con esto, el mismo fallo muestra el mensaje y el componente donde ocurrió.
 * No "arregla" nada — hace que el problema se pueda leer sin abrir DevTools, y
 * que el resto de la sesión no se pierda.
 *
 * Tiene que ser una clase: no hay equivalente en hooks para `componentDidCatch`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // La consola sigue siendo el lugar donde mirar el stack completo; acá solo
    // se guarda lo justo para mostrarlo en pantalla.
    console.error('Error no capturado en el árbol de React:', error, info);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium tracking-[0.14em] text-danger uppercase">
              SMI · Error de la aplicación
            </span>
            <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
              La pantalla no se pudo dibujar
            </h1>
          </div>

          <p className="rounded-lg bg-danger-soft px-3 py-2 font-mono text-sm text-danger-soft-foreground">
            {error.message}
          </p>

          {componentStack ? (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">
                Dónde ocurrió
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border p-3 font-mono text-xs whitespace-pre-wrap">
                {componentStack.trim()}
              </pre>
            </details>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              className="h-10 rounded-lg bg-(--accent) px-4 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
              type="button"
            >
              Recargar
            </button>
            <button
              className="h-10 rounded-lg border border-border px-4 text-sm font-semibold text-foreground"
              onClick={() => this.setState({ error: null, componentStack: null })}
              type="button"
            >
              Reintentar sin recargar
            </button>
          </div>
        </div>
      </main>
    );
  }
}
