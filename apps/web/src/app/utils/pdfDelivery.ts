// Entrega de PDFs gerados no navegador. Em vez de decidir sozinho entre baixar e
// compartilhar, expõe as três ações para a pessoa escolher: visualizar, baixar ou
// compartilhar — no celular o menu de compartilhar tomava conta e não deixava só salvar.

export type PdfFile = { blob: Blob; fileName: string };

/** Abre o PDF numa nova aba, para ler antes de salvar ou enviar. */
export function viewPdf(file: PdfFile) {
  const url = URL.createObjectURL(file.blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  if (!opened) {
    // Bloqueador de pop-up: navega por um link, que conta como gesto do usuário.
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Só libera depois: revogar cedo quebra a aba que acabou de abrir.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Salva o arquivo no aparelho. */
export function downloadPdf(file: PdfFile) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function toFile(file: PdfFile) {
  return new File([file.blob], file.fileName, { type: 'application/pdf' });
}

/** O aparelho sabe compartilhar arquivos? (celulares sim; a maioria dos desktops não) */
export function canSharePdf(file: PdfFile) {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [toFile(file)] });
  } catch {
    return false;
  }
}

/** Abre o menu nativo de compartilhar. Devolve false se não deu para compartilhar. */
export async function sharePdf(file: PdfFile, title: string) {
  if (!canSharePdf(file)) return false;

  try {
    await navigator.share({ files: [toFile(file)], title });
    return true;
  } catch (error) {
    // Fechar o menu não é erro — só não force um download por cima.
    if ((error as DOMException)?.name === 'AbortError') return true;
    return false;
  }
}
