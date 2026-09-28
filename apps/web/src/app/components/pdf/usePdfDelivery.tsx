import React, { useCallback, useMemo, useState } from 'react';
import { Download, Eye, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { canSharePdf, downloadPdf, sharePdf, viewPdf, type PdfFile } from '../../utils/pdfDelivery';

// Depois que um PDF é gerado, esta folha pergunta o que fazer com ele: visualizar,
// baixar ou compartilhar. Fica num hook para as telas de vacina e de pagamentos
// oferecerem exatamente as mesmas opções.

type Pending = PdfFile & { title: string; description?: string };

export function usePdfDelivery() {
  const [pending, setPending] = useState<Pending | null>(null);

  const present = useCallback((file: PdfFile, title: string, description?: string) => {
    setPending({ ...file, title, description });
  }, []);

  const close = useCallback(() => setPending(null), []);

  const dialog = useMemo(() => {
    if (!pending) return null;

    const file: PdfFile = { blob: pending.blob, fileName: pending.fileName };
    const shareAvailable = canSharePdf(file);

    return (
      <div
        className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-label="O que fazer com o PDF"
        onClick={close}
      >
        <div
          className="w-full rounded-t-[28px] border border-border bg-card p-5 shadow-2xl sm:max-w-[420px] sm:rounded-[28px] sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-medium text-foreground">PDF pronto</h2>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {pending.description ?? pending.fileName}
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

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={() => {
                viewPdf(file);
                close();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted"
            >
              <Eye className="h-5 w-5" />
              Visualizar
            </button>

            <button
              type="button"
              onClick={() => {
                downloadPdf(file);
                toast.success('Download iniciado.');
                close();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90"
            >
              <Download className="h-5 w-5" />
              Baixar
            </button>

            {shareAvailable ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const shared = await sharePdf(file, pending.title);
                    if (!shared) toast.error('Não foi possível compartilhar. Tente baixar.');
                    close();
                  })();
                }}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-border bg-background px-5 py-3 text-foreground transition-colors hover:bg-muted"
              >
                <Share2 className="h-5 w-5" />
                Compartilhar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }, [pending, close]);

  return { present, dialog };
}
