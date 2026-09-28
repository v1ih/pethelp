import { jsPDF } from 'jspdf';

// PDFs de pagamento: o recibo de uma cobrança e o extrato de um período. Seguem o
// mesmo visual da carteirinha de vacinação para o material sair com cara de PetHelp.

export type PaymentPdfItem = {
  id: string;
  description: string;
  amountCents: number;
  amountLabel: string;
  status: 'pending' | 'paid' | 'cancelled';
  method: string | null;
  methodLabel: string | null;
  petName: string | null;
  tutorName: string | null;
  professionalName: string | null;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

type Rgb = [number, number, number];

const COLORS: Record<string, Rgb> = {
  primary: [127, 162, 106],
  primaryDark: [107, 140, 89],
  ink: [26, 26, 26],
  muted: [107, 101, 96],
  border: [229, 221, 216],
  surface: [250, 248, 246],
  white: [255, 255, 255],
  late: [190, 62, 54],
};

const PAGE = { width: 210, height: 297, margin: 16 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const FOOTER_TOP = 274;

const STATUS_LABEL: Record<PaymentPdfItem['status'], string> = {
  pending: 'Em aberto',
  paid: 'Pago',
  cancelled: 'Cancelada',
};

function setFill(doc: jsPDF, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setStroke(doc: jsPDF, color: Rgb) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function formatDay(value: string | null) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Corta o texto na largura da coluna, sinalizando com reticências. */
function fitText(doc: jsPDF, value: string, maxWidth: number) {
  if (doc.getTextWidth(value) <= maxWidth) return value;

  let cut = value;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

async function loadLogo(): Promise<string | null> {
  try {
    const resp = await fetch('/icon.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? '') || null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, title: string, subtitle: string, logo: string | null) {
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, PAGE.width, 46, 'F');
  setFill(doc, COLORS.primaryDark);
  doc.rect(0, 40, PAGE.width, 6, 'F');

  if (logo) doc.addImage(logo, 'PNG', PAGE.margin, 10, 15, 15, undefined, 'FAST');

  const textX = logo ? PAGE.margin + 20 : PAGE.margin;
  setText(doc, COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PETHELP', textX, 16);
  doc.setFontSize(19);
  doc.text(title, textX, 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(subtitle, textX, 32);
}

function drawFooters(doc: jsPDF, note: string) {
  const pages = doc.getNumberOfPages();
  const generatedAt = new Date().toLocaleString('pt-BR');

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    setStroke(doc, COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, FOOTER_TOP, PAGE.width - PAGE.margin, FOOTER_TOP);
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Gerado pelo PetHelp em ${generatedAt}`, PAGE.margin, FOOTER_TOP + 5);
    doc.text(`Página ${page} de ${pages}`, PAGE.width - PAGE.margin, FOOTER_TOP + 5, { align: 'right' });
    doc.text(note, PAGE.margin, FOOTER_TOP + 9.5);
  }
}

const FISCAL_NOTE = 'Comprovante de registro de atendimento no PetHelp. Não é documento fiscal.';

/** Recibo de uma cobrança. */
export async function buildPaymentReceiptPdf(payment: PaymentPdfItem) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const logo = await loadLogo();

  const isPaid = payment.status === 'paid';
  drawHeader(doc, isPaid ? 'Recibo' : 'Cobrança', payment.professionalName ?? 'PetHelp', logo);

  let y = 58;

  // Destaque do valor.
  setFill(doc, COLORS.surface);
  setStroke(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, 30, 4, 4, 'FD');
  setText(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('VALOR', PAGE.margin + 8, y + 11);
  setText(doc, isPaid ? COLORS.primaryDark : COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text(payment.amountLabel, PAGE.margin + 8, y + 23);

  const statusText = STATUS_LABEL[payment.status];
  doc.setFontSize(10);
  setText(doc, payment.status === 'cancelled' ? COLORS.muted : isPaid ? COLORS.primaryDark : COLORS.late);
  doc.text(statusText.toUpperCase(), PAGE.width - PAGE.margin - 8, y + 16, { align: 'right' });

  y += 40;

  const lines: Array<[string, string]> = [
    ['Serviço', payment.description],
    ['Responsável', payment.tutorName ?? 'Não informado'],
    ['Pet', payment.petName ?? 'Não vinculado'],
    ['Profissional', payment.professionalName ?? 'Não informado'],
    ['Lançado em', formatDay(payment.createdAt) ?? '—'],
  ];
  if (payment.methodLabel) lines.push(['Forma de pagamento', payment.methodLabel]);
  if (payment.dueDate) lines.push(['Vencimento', formatDay(payment.dueDate) ?? '—']);
  if (payment.paidAt) lines.push(['Pago em', formatDay(payment.paidAt) ?? '—']);

  setStroke(doc, COLORS.border);
  for (const [label, value] of lines) {
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, PAGE.margin, y);

    setText(doc, COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(fitText(doc, value, CONTENT_WIDTH - 55), PAGE.width - PAGE.margin, y, { align: 'right' });

    y += 6;
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
    y += 6;
  }

  if (payment.notes) {
    y += 2;
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Observações', PAGE.margin, y);
    y += 5;
    setText(doc, COLORS.ink);
    doc.setFontSize(10);
    for (const line of doc.splitTextToSize(payment.notes, CONTENT_WIDTH) as string[]) {
      doc.text(line, PAGE.margin, y);
      y += 5;
    }
  }

  drawFooters(doc, FISCAL_NOTE);

  return {
    blob: doc.output('blob'),
    fileName: `${isPaid ? 'recibo' : 'cobranca'}-${slugify(payment.description).slice(0, 30) || 'pethelp'}.pdf`,
  };
}

/** Extrato das cobranças de um período. */
export async function buildPaymentsStatementPdf(options: {
  payments: PaymentPdfItem[];
  periodLabel: string;
  ownerLabel: string;
  forTutor?: boolean;
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const logo = await loadLogo();

  drawHeader(doc, 'Extrato de pagamentos', `${options.ownerLabel} · ${options.periodLabel}`, logo);

  const paid = options.payments.filter((item) => item.status === 'paid');
  const pending = options.payments.filter((item) => item.status === 'pending');
  const sum = (items: PaymentPdfItem[]) => items.reduce((total, item) => total + item.amountCents, 0);

  let y = 56;

  // Resumo em três caixas.
  const boxWidth = (CONTENT_WIDTH - 8) / 3;
  const boxes: Array<[string, string, Rgb]> = [
    ['Lançamentos', String(options.payments.length), COLORS.ink],
    [options.forTutor ? 'Já pago' : 'Recebido', formatMoney(sum(paid)), COLORS.primaryDark],
    ['Em aberto', formatMoney(sum(pending)), COLORS.late],
  ];

  boxes.forEach(([label, value, color], index) => {
    const x = PAGE.margin + index * (boxWidth + 4);
    setFill(doc, COLORS.surface);
    setStroke(doc, COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxWidth, 20, 3, 3, 'FD');
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 5, y + 7);
    setText(doc, color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(value, x + 5, y + 15);
  });

  y += 30;

  // Cabeçalho da tabela.
  const drawTableHeader = () => {
    setFill(doc, COLORS.primary);
    doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, 8, 2, 2, 'F');
    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DATA', PAGE.margin + 4, y + 5.5);
    doc.text(options.forTutor ? 'PROFISSIONAL' : 'RESPONSÁVEL', PAGE.margin + 24, y + 5.5);
    doc.text('SERVIÇO', PAGE.margin + 74, y + 5.5);
    doc.text('SITUAÇÃO', PAGE.margin + 126, y + 5.5);
    doc.text('VALOR', PAGE.width - PAGE.margin - 4, y + 5.5, { align: 'right' });
    y += 12;
  };

  drawTableHeader();

  if (options.payments.length === 0) {
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Nenhum lançamento no período.', PAGE.width / 2, y + 6, { align: 'center' });
  }

  for (const payment of options.payments) {
    if (y > FOOTER_TOP - 14) {
      doc.addPage();
      y = PAGE.margin + 6;
      drawTableHeader();
    }

    setText(doc, COLORS.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(formatDay(payment.createdAt) ?? '—', PAGE.margin + 4, y);

    const who = options.forTutor ? payment.professionalName : payment.tutorName;
    doc.text(fitText(doc, who ?? '—', 46), PAGE.margin + 24, y);

    const service = [payment.description, payment.petName ? `(${payment.petName})` : null].filter(Boolean).join(' ');
    doc.text(fitText(doc, service, 48), PAGE.margin + 74, y);

    setText(doc, payment.status === 'paid' ? COLORS.primaryDark : payment.status === 'pending' ? COLORS.late : COLORS.muted);
    doc.text(STATUS_LABEL[payment.status], PAGE.margin + 126, y);

    setText(doc, COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.text(payment.amountLabel, PAGE.width - PAGE.margin - 4, y, { align: 'right' });

    y += 6;
    setStroke(doc, COLORS.border);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, y - 2, PAGE.width - PAGE.margin, y - 2);
    y += 2;
  }

  drawFooters(doc, FISCAL_NOTE);

  return {
    blob: doc.output('blob'),
    fileName: `extrato-${slugify(options.periodLabel) || 'pethelp'}.pdf`,
  };
}

/** Entrega o PDF: menu de compartilhar no celular, download no resto. */
export async function shareOrDownloadPdf(result: { blob: Blob; fileName: string }, title: string) {
  const file = new File([result.blob], result.fileName, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared' as const;
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return 'shared' as const;
    }
  }

  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);

  return 'downloaded' as const;
}
