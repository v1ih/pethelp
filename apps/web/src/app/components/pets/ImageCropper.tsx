import React, { useCallback, useEffect, useRef, useState } from 'react';

const VIEW = 260; // tamanho da área de recorte (quadrada), em px
const OUT = 512; // tamanho final da imagem gerada

type Props = {
  src: string;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
};

/** Recorte simples de foto (quadrado): arraste para posicionar e use o zoom. */
export default function ImageCropper({ src, onApply, onCancel }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const coverScale = natural ? Math.max(VIEW / natural.w, VIEW / natural.h) : 1;
  const dispW = natural ? natural.w * coverScale * scale : VIEW;
  const dispH = natural ? natural.h * coverScale * scale : VIEW;

  const clamp = useCallback(
    (x: number, y: number) => {
      const minX = VIEW - dispW;
      const minY = VIEW - dispH;
      return { x: Math.min(0, Math.max(minX, x)), y: Math.min(0, Math.max(minY, y)) };
    },
    [dispW, dispH]
  );

  useEffect(() => {
    setPos((p) => clamp(p.x, p.y));
  }, [clamp]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    // centraliza
    const cs = Math.max(VIEW / el.naturalWidth, VIEW / el.naturalHeight);
    const w = el.naturalWidth * cs;
    const h = el.naturalHeight * cs;
    setScale(1);
    setPos({ x: (VIEW - w) / 2, y: (VIEW - h) / 2 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.baseX + (e.clientX - drag.current.startX);
    const ny = drag.current.baseY + (e.clientY - drag.current.startY);
    setPos(clamp(nx, ny));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const apply = () => {
    if (!imgRef.current || !natural) return;
    const factor = coverScale * scale; // natural -> exibido
    const srcW = VIEW / factor;
    const srcH = VIEW / factor;
    const srcX = -pos.x / factor;
    const srcY = -pos.y / factor;

    const canvas = document.createElement('canvas');
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, OUT, OUT);
    onApply(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[28px] border border-border bg-card p-5 shadow-2xl">
        <h3 className="mb-1 text-lg text-foreground">Ajustar foto</h3>
        <p className="mb-4 text-sm text-muted-foreground">Arraste para posicionar e use o zoom.</p>

        <div
          className="relative mx-auto overflow-hidden rounded-full border-4 border-border bg-muted"
          style={{ width: VIEW, height: VIEW, touchAction: 'none', cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <img
            ref={imgRef}
            src={src}
            onLoad={onImgLoad}
            draggable={false}
            alt="Prévia"
            style={{ position: 'absolute', left: pos.x, top: pos.y, width: dispW, height: dispH, maxWidth: 'none', userSelect: 'none' }}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm text-muted-foreground">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-[16px] border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted">
            Cancelar
          </button>
          <button type="button" onClick={apply} className="rounded-[16px] bg-primary px-4 py-2 text-sm text-white transition-colors hover:bg-primary/90">
            Usar foto
          </button>
        </div>
      </div>
    </div>
  );
}
