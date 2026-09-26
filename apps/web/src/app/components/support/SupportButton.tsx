import React, { useState } from 'react';
import { MessageCircle, MessageCircleWarning, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '../../context/SessionContext';
import { getApiBase, getAuthHeaders } from '../../context/shared';
import { getRecentErrors } from '../../utils/errorLog';

// Botão de suporte presente em todas as telas. O relato vai por e-mail para quem cuida
// do PetHelp (com tela, navegador e erros do console juntos) e há o atalho do WhatsApp
// para quando a pessoa prefere falar na hora — ou quando o envio por e-mail falha.

const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string) ?? '5524992643632';

function buildWhatsappLink(message: string, pageUrl: string, who: string) {
  const text = [
    'Olá! Preciso de ajuda no PetHelp.',
    '',
    message.trim() || '(descreva o problema aqui)',
    '',
    `Tela: ${pageUrl}`,
    `Conta: ${who}`,
  ].join('\n');

  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}

export default function SupportButton() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sending, setSending] = useState(false);

  const pageUrl = typeof window === 'undefined' ? '' : window.location.href;
  const who = user?.email ? `${user.email}` : 'ainda não entrei na conta';

  const close = () => {
    setOpen(false);
    setMessage('');
    setSending(false);
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;

    if (message.trim().length < 5) {
      toast.error('Conte rapidinho o que aconteceu.');
      return;
    }

    setSending(true);
    try {
      const resp = await fetch(`${getApiBase()}/api/support/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          message: message.trim(),
          pageUrl,
          contactEmail: contactEmail.trim() || user?.email || '',
          errors: getRecentErrors(),
        }),
      });

      const payload = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(payload?.message ?? 'Não foi possível enviar o relato.');
      }

      toast.success('Relato enviado! Vamos responder no seu e-mail.');
      close();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o relato.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Com texto, e não só ícone: o "?" do cabeçalho já é o tutorial, então este
          precisa dizer na letra que serve para relatar problema. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Suporte: relatar um problema"
        title="Relatar um problema"
        className="fixed bottom-4 right-4 z-50 inline-flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 text-[15px] font-medium text-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.45)] transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:bottom-6 sm:right-6"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <MessageCircleWarning className="h-5 w-5 shrink-0" />
        Suporte
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Falar com o suporte"
          onClick={close}
        >
          <div
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-border bg-card p-5 shadow-2xl sm:max-w-[460px] sm:rounded-[28px] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-medium text-foreground">Deu algum problema?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conte o que aconteceu e a gente resolve. Enviamos junto a tela em que você está, para facilitar a
                  investigação.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSend} className="mt-4 grid gap-4">
              <div>
                <label htmlFor="supportMessage" className="mb-2 block text-sm font-medium text-foreground">
                  O que aconteceu? <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="supportMessage"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                  placeholder="Ex: tentei salvar a vacina do Max e apareceu uma mensagem de erro."
                  required
                />
              </div>

              {!user?.email ? (
                <div>
                  <label htmlFor="supportEmail" className="mb-2 block text-sm font-medium text-foreground">
                    Seu e-mail para resposta
                  </label>
                  <input
                    id="supportEmail"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className="min-h-12 w-full rounded-[18px] border border-border bg-input-background px-4 py-3 text-base text-foreground outline-none transition-colors focus:border-primary"
                    placeholder="seu@email.com"
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={sending}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {sending ? 'Enviando...' : 'Enviar para o suporte'}
              </button>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou fale agora
                <span className="h-px flex-1 bg-border" />
              </div>

              <a
                href={buildWhatsappLink(message, pageUrl, who)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted"
              >
                <MessageCircle className="h-4 w-4" />
                Chamar no WhatsApp
              </a>

              <p className="text-center text-xs text-muted-foreground">
                Quer aprender a usar o app? Toque no <strong className="text-foreground">?</strong> no topo da tela
                para rever o tutorial.
              </p>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
