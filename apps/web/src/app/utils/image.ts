// Preparo de imagens escolhidas pelo usuário (foto de vacina, carteirinha etc.).
// A foto é reduzida no navegador antes de virar data URL: uma foto de celular tem
// vários MB e o backend limita o tamanho do registro.

const DEFAULT_MAX_SIDE = 1600;
const DEFAULT_QUALITY = 0.82;

/** Tamanho máximo do arquivo original aceito na escolha (antes de reduzir). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  // createImageBitmap respeita a orientação EXIF, então fotos de celular não saem deitadas.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height, draw: bitmap };
    } catch {
      // Navegador sem suporte à opção: cai no <img> abaixo.
    }
  }

  const dataUrl = await readAsDataUrl(file);
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
  });

  return { width: image.naturalWidth, height: image.naturalHeight, draw: image };
}

/**
 * Converte a imagem escolhida em um data URL JPEG reduzido, mantendo a proporção.
 * Lança Error com mensagem pronta para exibir quando o arquivo não serve.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxSide = DEFAULT_MAX_SIDE,
  quality = DEFAULT_QUALITY
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Escolha uma imagem (JPG, PNG ou HEIC).');
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('A imagem é muito grande. Escolha uma foto de até 20 MB.');
  }

  const { width, height, draw } = await loadBitmap(file);
  if (!width || !height) {
    throw new Error('Não foi possível abrir a imagem.');
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível processar a imagem neste navegador.');
  }

  // Fundo branco: JPEG não tem transparência e PNGs transparentes ficariam pretos.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(draw, 0, 0, canvas.width, canvas.height);

  if (typeof ImageBitmap !== 'undefined' && draw instanceof ImageBitmap) {
    draw.close();
  }

  return canvas.toDataURL('image/jpeg', quality);
}
