import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pipette } from 'lucide-react';

// Web port of the native ColorPickerPanel (macOS) / ColorPickerWindow
// (Windows): hue ring + saturation/value disc, eyedropper, old/new preview,
// hex entry, quick swatches, Cancel/Done. Live edits stream through onLive;
// Done commits, Cancel restores the caller's prior color.

interface NeonColorPickerProps {
  title: string;
  initial: string;
  swatches: string[];
  onLive: (hex: string) => void;
  onDone: (hex: string) => void;
  onCancel: () => void;
}

const SIZE = 264;
const RING_OUTER = SIZE / 2 - 4;
const RING_INNER = RING_OUTER - 24;
const DISC_RADIUS = RING_INNER - 12;

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255 || 0;
  const g = parseInt(m.slice(2, 4), 16) / 255 || 0;
  const b = parseInt(m.slice(4, 6), 16) / 255 || 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const to2 = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${to2(rgb[0])}${to2(rgb[1])}${to2(rgb[2])}`;
}

export const NeonColorPicker: React.FC<NeonColorPickerProps> = ({
  title,
  initial,
  swatches,
  onLive,
  onDone,
  onCancel,
}) => {
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const [hexDraft, setHexDraft] = useState(hex);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<'ring' | 'disc' | null>(null);

  useEffect(() => setHexDraft(hex), [hex]);

  const setColor = useCallback(
    (next: { h: number; s: number; v: number }) => {
      setHsv(next);
      onLive(hsvToHex(next.h, next.s, next.v));
    },
    [onLive]
  );

  // Render the wheel: hue annulus + SV disc + handles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Hue ring
    for (let deg = 0; deg < 360; deg += 2) {
      const start = ((deg - 91) * Math.PI) / 180;
      const end = ((deg - 88.5) * Math.PI) / 180;
      ctx.beginPath();
      ctx.strokeStyle = `hsl(${deg}, 100%, 50%)`;
      ctx.lineWidth = RING_OUTER - RING_INNER;
      ctx.arc(cx, cy, (RING_OUTER + RING_INNER) / 2, start, end);
      ctx.stroke();
    }

    // SV disc for the current hue: hue fill, then white→transparent
    // (saturation, left→right) and transparent→black (value, top→bottom)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, DISC_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = `hsl(${hsv.h}, 100%, 50%)`;
    ctx.fillRect(cx - DISC_RADIUS, cy - DISC_RADIUS, DISC_RADIUS * 2, DISC_RADIUS * 2);
    const satGrad = ctx.createLinearGradient(cx - DISC_RADIUS, 0, cx + DISC_RADIUS, 0);
    satGrad.addColorStop(0, 'rgba(255,255,255,1)');
    satGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = satGrad;
    ctx.fillRect(cx - DISC_RADIUS, cy - DISC_RADIUS, DISC_RADIUS * 2, DISC_RADIUS * 2);
    const valGrad = ctx.createLinearGradient(0, cy - DISC_RADIUS, 0, cy + DISC_RADIUS);
    valGrad.addColorStop(0, 'rgba(0,0,0,0)');
    valGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = valGrad;
    ctx.fillRect(cx - DISC_RADIUS, cy - DISC_RADIUS, DISC_RADIUS * 2, DISC_RADIUS * 2);
    ctx.restore();

    // Handles
    const hueAngle = ((hsv.h - 90) * Math.PI) / 180;
    const hueR = (RING_OUTER + RING_INNER) / 2;
    const drawHandle = (x: number, y: number, fill: string) => {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    };
    drawHandle(cx + Math.cos(hueAngle) * hueR, cy + Math.sin(hueAngle) * hueR, `hsl(${hsv.h}, 100%, 50%)`);
    const sx = cx + (hsv.s * 2 - 1) * DISC_RADIUS;
    const sy = cy + (1 - hsv.v * 2) * DISC_RADIUS;
    drawHandle(
      Math.max(cx - DISC_RADIUS, Math.min(cx + DISC_RADIUS, sx)),
      Math.max(cy - DISC_RADIUS, Math.min(cy + DISC_RADIUS, sy)),
      hex
    );
  }, [hsv, hex]);

  const applyPointer = useCallback(
    (clientX: number, clientY: number, zone: 'ring' | 'disc') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left - SIZE / 2;
      const y = clientY - rect.top - SIZE / 2;
      if (zone === 'ring') {
        let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
        if (deg < 0) deg += 360;
        setColor({ ...hsv, h: deg });
      } else {
        const s = Math.max(0, Math.min(1, (x / DISC_RADIUS + 1) / 2));
        const v = Math.max(0, Math.min(1, (1 - y / DISC_RADIUS) / 2));
        setColor({ ...hsv, s, v });
      }
    },
    [hsv, setColor]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - SIZE / 2;
    const y = e.clientY - rect.top - SIZE / 2;
    const r = Math.hypot(x, y);
    const zone = r > RING_INNER ? 'ring' : 'disc';
    if (r > RING_OUTER + 6) return;
    dragRef.current = zone;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyPointer(e.clientX, e.clientY, zone);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) applyPointer(e.clientX, e.clientY, dragRef.current);
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const applyHexDraft = () => {
    const m = hexDraft.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (m) {
      const next = hexToHsv(`#${m[1]}`);
      setColor(next);
    } else {
      setHexDraft(hex);
    }
  };

  const eyedropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pickFromScreen = async () => {
    try {
      const result = await new (window as any).EyeDropper().open();
      if (result?.sRGBHex) setColor(hexToHsv(result.sRGBHex.toUpperCase()));
    } catch (err) {
      /* dismissed */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onCancel}>
      <div
        className="neon-frame w-[336px] p-5 text-xs text-neutral-300 select-none animate-in zoom-in-95 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header: title, eyedropper, old/new preview */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-bold text-neutral-100 flex-1">{title}</span>
          {eyedropperSupported && (
            <button
              onClick={pickFromScreen}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 cursor-pointer"
              title="Pick a color from the screen"
              aria-label="Pick a color from the screen"
            >
              <Pipette className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="flex -space-x-2" title="Old vs new color">
            <span className="w-6 h-6 rounded-full ring-1 ring-white/30" style={{ backgroundColor: initial }} />
            <span className="w-6 h-6 rounded-full ring-1 ring-white/60" style={{ backgroundColor: hex }} />
          </div>
        </div>

        {/* Wheel */}
        <canvas
          ref={canvasRef}
          style={{ width: SIZE, height: SIZE, touchAction: 'none' }}
          className="mx-auto block cursor-crosshair"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Hex entry */}
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={applyHexDraft}
          onKeyDown={(e) => e.key === 'Enter' && applyHexDraft()}
          className="neon-input rounded-lg px-2.5 py-1.5 font-mono w-full mt-4"
          aria-label="Hex color"
        />

        {/* Quick swatches */}
        <div className="mt-3">
          <div className="text-[10px] uppercase font-bold tracking-wider text-violet-300/60 mb-1.5">
            Quick Swatches
          </div>
          <div className="flex items-center gap-2">
            {swatches.map((swatch, i) => (
              <button
                key={i}
                onClick={() => setColor(hexToHsv(swatch))}
                className="w-6 h-6 rounded-full ring-1 ring-white/20 hover:ring-white/60 transition-shadow cursor-pointer"
                style={{ backgroundColor: swatch }}
                aria-label={`Swatch ${i + 1}: ${swatch}`}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-violet-100 font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onDone(hex)}
            className="neon-btn-primary px-4 py-2 rounded-xl font-bold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
