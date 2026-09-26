import { jsPDF } from 'jspdf';
import { formatBirthDate, petAgeLabel } from './age';

// Carteirinha de vacinação em PDF: uma folha A4 desenhada para parecer a carteirinha
// de papel — cabeçalho colorido, ficha do pet e a lista de vacinas. As fotos que o
// responsável anexou entram numa seção de comprovantes no fim.

export type VaccinationCardPet = {
  name: string;
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  weight?: string | null;
  neutered?: boolean | null;
  age?: string | null;
  birthDate?: string | null;
  photo?: string | null;
};

export type VaccinationCardVaccine = {
  name: string;
  date: string;
  nextDose?: string;
  status: 'up-to-date' | 'late';
  veterinarian?: string;
  clinicName?: string;
  photo?: string | null;
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
  lateSoft: [253, 236, 234],
  okSoft: [237, 243, 232],
};

const PAGE = { width: 210, height: 297, margin: 14 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const FOOTER_TOP = 276;

function setFill(doc: jsPDF, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setStroke(doc: jsPDF, color: Rgb) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function setText(doc: jsPDF, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function formatDay(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

/** Descobre a proporção da imagem para ela não sair achatada no PDF. */
function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
}

function imageFormat(dataUrl: string): 'PNG' | 'JPEG' {
  return /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG';
}

/** Desenha a imagem encaixada (sem distorcer) dentro da caixa, centralizada. */
async function drawImageFitted(
  doc: jsPDF,
  dataUrl: string,
  box: { x: number; y: number; width: number; height: number }
) {
  const image = await loadImage(dataUrl);
  if (!image || !image.naturalWidth || !image.naturalHeight) return;

  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = box.x + (box.width - width) / 2;
  const y = box.y + (box.height - height) / 2;

  doc.addImage(dataUrl, imageFormat(dataUrl), x, y, width, height, undefined, 'FAST');
}

/** Recorta a imagem no centro para preencher a caixa toda (estilo object-fit: cover). */
async function drawImageCover(
  doc: jsPDF,
  dataUrl: string,
  box: { x: number; y: number; width: number; height: number }
) {
  const image = await loadImage(dataUrl);
  if (!image || !image.naturalWidth || !image.naturalHeight) return false;

  const canvas = document.createElement('canvas');
  const side = 420;
  canvas.width = side;
  canvas.height = Math.round((side * box.height) / box.width);

  const context = canvas.getContext('2d');
  if (!context) return false;

  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);

  doc.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', box.x, box.y, box.width, box.height, undefined, 'FAST');
  return true;
}

function drawHeader(doc: jsPDF, petName: string, logo: string | null) {
  setFill(doc, COLORS.primary);
  doc.rect(0, 0, PAGE.width, 54, 'F');

  // Faixa mais escura embaixo dá um leve degradê sem precisar de imagem.
  setFill(doc, COLORS.primaryDark);
  doc.rect(0, 46, PAGE.width, 8, 'F');

  if (logo) {
    doc.addImage(logo, 'PNG', PAGE.margin, 11, 16, 16, undefined, 'FAST');
  }

  setText(doc, COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PETHELP', logo ? PAGE.margin + 21 : PAGE.margin, 17);

  doc.setFontSize(21);
  doc.text('Carteira de Vacinação', logo ? PAGE.margin + 21 : PAGE.margin, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(petName, logo ? PAGE.margin + 21 : PAGE.margin, 33);
}

async function drawPetCard(doc: jsPDF, pet: VaccinationCardPet, tutorName: string | null) {
  const top = 44;
  const height = 44;

  setFill(doc, COLORS.white);
  setStroke(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE.margin, top, CONTENT_WIDTH, height, 4, 4, 'FD');

  const photoBox = { x: PAGE.margin + 6, y: top + 6, width: 32, height: 32 };
  setFill(doc, COLORS.surface);
  doc.roundedRect(photoBox.x, photoBox.y, photoBox.width, photoBox.height, 3, 3, 'F');
  const drewPhoto = pet.photo ? await drawImageCover(doc, pet.photo, photoBox) : false;
  if (!drewPhoto) {
    // Sem foto: inicial do nome num círculo. As fontes padrão do PDF não têm emoji.
    setFill(doc, COLORS.primary);
    doc.circle(photoBox.x + photoBox.width / 2, photoBox.y + photoBox.height / 2, 11, 'F');
    setText(doc, COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(
      (pet.name.trim()[0] ?? 'P').toUpperCase(),
      photoBox.x + photoBox.width / 2,
      photoBox.y + photoBox.height / 2 + 5.5,
      { align: 'center' }
    );
  }

  const textX = photoBox.x + photoBox.width + 8;
  setText(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pet.name, textX, top + 14);

  setText(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const subtitle = [pet.species, pet.breed].filter(Boolean).join(' · ') || 'Espécie não informada';
  doc.text(subtitle, textX, top + 20);

  // Ficha em duas colunas de rótulo/valor.
  const birth = formatBirthDate(pet.birthDate);
  const entries: Array<[string, string]> = [
    ['Idade', petAgeLabel(pet)],
    ['Nascimento', birth ?? 'Não informado'],
    ['Sexo', pet.sex || 'Não informado'],
    ['Peso', pet.weight || 'Não informado'],
    ['Castrado(a)', pet.neutered === null || pet.neutered === undefined ? 'Não informado' : pet.neutered ? 'Sim' : 'Não'],
    ['Responsável', tutorName || 'Não informado'],
  ];

  const columnWidth = (CONTENT_WIDTH - (textX - PAGE.margin) - 8) / 3;
  entries.forEach(([label, value], index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = textX + column * columnWidth;
    const y = top + 28 + row * 9;

    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, y);

    setText(doc, COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(value, columnWidth - 3)[0] ?? value, x, y + 4.5);
  });

  return top + height;
}

function drawSectionTitle(doc: jsPDF, title: string, subtitle: string, y: number) {
  setText(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, PAGE.margin, y);

  setText(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(subtitle, PAGE.margin, y + 5);

  setStroke(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(PAGE.margin, y + 8.5, PAGE.width - PAGE.margin, y + 8.5);

  return y + 14;
}

async function drawVaccineRow(doc: jsPDF, vaccine: VaccinationCardVaccine, y: number) {
  const height = 24;
  const late = vaccine.status === 'late';

  setFill(doc, COLORS.white);
  setStroke(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, height, 3, 3, 'FD');

  // Faixa lateral colorida marca o status de relance.
  setFill(doc, late ? COLORS.late : COLORS.primary);
  doc.roundedRect(PAGE.margin, y, 2.4, height, 1.2, 1.2, 'F');

  const hasPhoto = Boolean(vaccine.photo);
  const photoBox = { x: PAGE.width - PAGE.margin - 22, y: y + 3, width: 18, height: 18 };
  if (hasPhoto && vaccine.photo) {
    setFill(doc, COLORS.surface);
    doc.roundedRect(photoBox.x, photoBox.y, photoBox.width, photoBox.height, 2, 2, 'F');
    await drawImageCover(doc, vaccine.photo, photoBox);
  }

  const textX = PAGE.margin + 7;
  const maxTextWidth = (hasPhoto ? photoBox.x - 4 : PAGE.width - PAGE.margin) - textX - 26;

  setText(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(doc.splitTextToSize(vaccine.name, maxTextWidth)[0] ?? vaccine.name, textX, y + 8.5);

  setText(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const applied = formatDay(vaccine.date) ?? '—';
  const next = formatDay(vaccine.nextDose);
  doc.text(`Aplicada em ${applied}${next ? `   •   Próxima dose: ${next}` : '   •   Sem próxima dose'}`, textX, y + 14.5);

  const who = [vaccine.veterinarian, vaccine.clinicName].filter(Boolean).join(' · ');
  doc.text(doc.splitTextToSize(who || 'Profissional não informado', maxTextWidth)[0] ?? '', textX, y + 20);

  // Selo de status alinhado à direita do bloco de texto.
  const badgeText = late ? 'ATRASADA' : 'EM DIA';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  const badgeWidth = doc.getTextWidth(badgeText) + 6;
  const badgeX = (hasPhoto ? photoBox.x - 4 : PAGE.width - PAGE.margin) - badgeWidth;
  setFill(doc, late ? COLORS.lateSoft : COLORS.okSoft);
  doc.roundedRect(badgeX, y + 5, badgeWidth, 6, 3, 3, 'F');
  setText(doc, late ? COLORS.late : COLORS.primaryDark);
  doc.text(badgeText, badgeX + badgeWidth / 2, y + 9.1, { align: 'center' });

  return y + height + 4;
}

function drawFooters(doc: jsPDF, petName: string) {
  const pages = doc.getNumberOfPages();
  const generatedAt = new Date().toLocaleDateString('pt-BR');

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    setStroke(doc, COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(PAGE.margin, FOOTER_TOP, PAGE.width - PAGE.margin, FOOTER_TOP);

    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Carteira de vacinação de ${petName} · gerada pelo PetHelp em ${generatedAt}`, PAGE.margin, FOOTER_TOP + 5);
    doc.text(`Página ${page} de ${pages}`, PAGE.width - PAGE.margin, FOOTER_TOP + 5, { align: 'right' });
    doc.text(
      'Documento informativo gerado pelo responsável. Não substitui a carteira oficial assinada pelo veterinário.',
      PAGE.margin,
      FOOTER_TOP + 9.5
    );
  }
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

export async function buildVaccinationCardPdf(options: {
  pet: VaccinationCardPet;
  vaccines: VaccinationCardVaccine[];
  tutorName?: string | null;
}): Promise<{ blob: Blob; fileName: string }> {
  const { pet, vaccines, tutorName = null } = options;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const logo = await loadLogo();
  drawHeader(doc, pet.name, logo);
  let y = await drawPetCard(doc, pet, tutorName);

  y += 10;
  const upToDate = vaccines.filter((vaccine) => vaccine.status !== 'late').length;
  const lateCount = vaccines.length - upToDate;
  y = drawSectionTitle(
    doc,
    'Vacinas registradas',
    vaccines.length === 0
      ? 'Nenhuma vacina registrada até aqui.'
      : `${vaccines.length} registro${vaccines.length === 1 ? '' : 's'} · ${upToDate} em dia · ${lateCount} atrasada${lateCount === 1 ? '' : 's'}`,
    y
  );

  if (vaccines.length === 0) {
    setFill(doc, COLORS.surface);
    setStroke(doc, COLORS.border);
    doc.roundedRect(PAGE.margin, y, CONTENT_WIDTH, 20, 3, 3, 'FD');
    setText(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('Nenhuma vacina foi registrada para este pet.', PAGE.width / 2, y + 12, { align: 'center' });
    y += 26;
  }

  for (const vaccine of vaccines) {
    if (y + 24 > FOOTER_TOP - 6) {
      doc.addPage();
      y = PAGE.margin + 6;
    }
    y = await drawVaccineRow(doc, vaccine, y);
  }

  // Comprovantes: as fotos que o responsável anexou, em tamanho grande.
  const withPhotos = vaccines.filter((vaccine) => Boolean(vaccine.photo));
  if (withPhotos.length > 0) {
    doc.addPage();
    let photoY = drawSectionTitle(
      doc,
      'Comprovantes',
      `${withPhotos.length} foto${withPhotos.length === 1 ? '' : 's'} anexada${withPhotos.length === 1 ? '' : 's'} pelo responsável.`,
      PAGE.margin + 6
    );

    const columnWidth = (CONTENT_WIDTH - 8) / 2;
    const cardHeight = 72;

    for (let index = 0; index < withPhotos.length; index += 1) {
      const column = index % 2;
      if (column === 0 && photoY + cardHeight > FOOTER_TOP - 6) {
        doc.addPage();
        photoY = PAGE.margin + 6;
      }

      const vaccine = withPhotos[index];
      const x = PAGE.margin + column * (columnWidth + 8);

      setFill(doc, COLORS.white);
      setStroke(doc, COLORS.border);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, photoY, columnWidth, cardHeight, 3, 3, 'FD');

      setFill(doc, COLORS.surface);
      doc.roundedRect(x + 3, photoY + 3, columnWidth - 6, cardHeight - 17, 2, 2, 'F');
      if (vaccine.photo) {
        await drawImageFitted(doc, vaccine.photo, {
          x: x + 3,
          y: photoY + 3,
          width: columnWidth - 6,
          height: cardHeight - 17,
        });
      }

      setText(doc, COLORS.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(vaccine.name, columnWidth - 8)[0] ?? vaccine.name, x + 4, photoY + cardHeight - 8);

      setText(doc, COLORS.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Aplicada em ${formatDay(vaccine.date) ?? '—'}`, x + 4, photoY + cardHeight - 3.5);

      if (column === 1) photoY += cardHeight + 8;
    }
  }

  drawFooters(doc, pet.name);

  const slug = pet.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');

  return { blob: doc.output('blob'), fileName: `carteirinha-${slug || 'pet'}.pdf` };
}

/**
 * Gera o PDF e entrega ao usuário: no celular oferece o menu de compartilhar
 * (WhatsApp, e-mail…), e no resto baixa o arquivo.
 */
export async function shareOrDownloadVaccinationCard(options: {
  pet: VaccinationCardPet;
  vaccines: VaccinationCardVaccine[];
  tutorName?: string | null;
}): Promise<'shared' | 'downloaded'> {
  const { blob, fileName } = await buildVaccinationCardPdf(options);
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Carteira de vacinação de ${options.pet.name}`,
      });
      return 'shared';
    } catch (error) {
      // Usuário fechou o menu de compartilhar: não é erro, cai para o download.
      if ((error as DOMException)?.name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);

  return 'downloaded';
}
