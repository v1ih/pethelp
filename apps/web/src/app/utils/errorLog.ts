// Guarda os últimos erros do navegador para irem junto no relato de suporte. Sem isso,
// o relato chega como "deu erro" e não dá para investigar nada.

const MAX_ENTRIES = 5;
const entries: string[] = [];

function record(entry: string) {
  const stamped = `[${new Date().toLocaleTimeString('pt-BR')}] ${entry}`.slice(0, 600);
  entries.push(stamped);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getRecentErrors(): string[] {
  return [...entries];
}

let installed = false;

/** Liga a captura uma única vez, no início da aplicação. */
export function installErrorLog() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const where = event.filename ? ` (${event.filename}:${event.lineno})` : '';
    record(`Erro: ${event.message}${where}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
    record(`Promessa rejeitada: ${reason}`);
  });

  // console.error cobre as falhas que a aplicação trata mas registra no console,
  // como respostas de API que deram errado.
  const original = console.error;
  console.error = (...args: unknown[]) => {
    record(
      args
        .map((arg) => (arg instanceof Error ? arg.message : typeof arg === 'string' ? arg : ''))
        .filter(Boolean)
        .join(' ')
    );
    original.apply(console, args as []);
  };
}
