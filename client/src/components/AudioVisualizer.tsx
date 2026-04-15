import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  audio: HTMLAudioElement | null;
  visible: boolean;
  position: 'bottom' | 'top' | 'bottom-full';
  compact?: boolean;
}

const POINTS = 256;

interface AudioNodes {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
}

function getOrCreateAudioNodes(audio: HTMLAudioElement): AudioNodes {
  const win = window as unknown as Record<string, unknown>;
  if (win.__vizNodes) return win.__vizNodes as AudioNodes;

  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;
  const source = ctx.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(ctx.destination);

  const nodes: AudioNodes = { ctx, analyser, source };
  win.__vizNodes = nodes;
  return nodes;
}

function getEnergy(freqData: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < freqData.length; i++) sum += freqData[i];
  return sum / (freqData.length * 255);
}

// Color themes: [line RGB, glow RGB]
const COLOR_THEMES = [
  { line: [96, 165, 250], glow: [59, 130, 246] },
  { line: [74, 222, 128], glow: [34, 197, 94] },
  { line: [251, 146, 60], glow: [249, 115, 22] },
  { line: [232, 232, 232], glow: [180, 180, 180] },
  { line: [192, 132, 252], glow: [139, 92, 246] },
  { line: [250, 204, 21], glow: [234, 179, 8] },
];

let currentThemeIndex = 0;
let nextThemeIndex = 1;
let lastThemeSwitch = 0;
const THEME_DURATION = 4000;
const BLEND_DURATION = 1500;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getCurrentColor(): { line: number[]; glow: number[] } {
  const now = Date.now();
  if (now - lastThemeSwitch > THEME_DURATION) {
    lastThemeSwitch = now;
    currentThemeIndex = nextThemeIndex;
    let next = Math.floor(Math.random() * COLOR_THEMES.length);
    while (next === currentThemeIndex) next = Math.floor(Math.random() * COLOR_THEMES.length);
    nextThemeIndex = next;
  }

  const elapsed = now - lastThemeSwitch;
  const t = Math.min(elapsed / BLEND_DURATION, 1);
  const cur = COLOR_THEMES[currentThemeIndex];
  const nxt = COLOR_THEMES[nextThemeIndex];

  return {
    line: [lerp(cur.line[0], nxt.line[0], t), lerp(cur.line[1], nxt.line[1], t), lerp(cur.line[2], nxt.line[2], t)],
    glow: [lerp(cur.glow[0], nxt.glow[0], t), lerp(cur.glow[1], nxt.glow[1], t), lerp(cur.glow[2], nxt.glow[2], t)],
  };
}

function drawWaveform(c: CanvasRenderingContext2D, W: number, H: number, timeData: Uint8Array, energy: number, bufferLength: number) {
  const midY = H * 0.5;
  const color = getCurrentColor();
  const [lr, lg, lb] = color.line;
  const [gr, gg, gb] = color.glow;

  const layers = [
    { alpha: 0.06, lineWidth: 28, blur: 20 },
    { alpha: 0.12, lineWidth: 12, blur: 12 },
    { alpha: 0.25, lineWidth: 4, blur: 6 },
    { alpha: 0.7 + energy * 0.3, lineWidth: 1.5, blur: 0 },
  ];

  for (const layer of layers) {
    const step = bufferLength / POINTS;
    c.beginPath();
    c.lineWidth = layer.lineWidth;
    c.strokeStyle = `rgba(${lr}, ${lg}, ${lb}, ${layer.alpha})`;
    if (layer.blur > 0) { c.shadowColor = `rgba(${gr}, ${gg}, ${gb}, ${layer.alpha})`; c.shadowBlur = layer.blur; } else { c.shadowBlur = 0; }

    const amplitude = 0.3 + energy * 0.7;
    for (let i = 0; i < POINTS; i++) {
      const di = Math.floor(i * step);
      const v = (timeData[di] - 128) / 128;
      const x = (i / (POINTS - 1)) * W;
      const y = midY + v * midY * amplitude;
      if (i === 0) { c.moveTo(x, y); } else {
        const pdi = Math.floor((i - 1) * step);
        const pv = (timeData[pdi] - 128) / 128;
        const px = ((i - 1) / (POINTS - 1)) * W;
        const py = midY + pv * midY * amplitude;
        c.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      }
    }
    c.stroke();
    c.shadowBlur = 0;
  }

  // Fill under
  const step = bufferLength / POINTS;
  const amplitude = 0.3 + energy * 0.7;
  c.beginPath();
  for (let i = 0; i < POINTS; i++) {
    const di = Math.floor(i * step);
    const v = (timeData[di] - 128) / 128;
    const x = (i / (POINTS - 1)) * W;
    const y = midY + v * midY * amplitude;
    if (i === 0) c.moveTo(x, y); else {
      const pdi = Math.floor((i - 1) * step);
      const pv = (timeData[pdi] - 128) / 128;
      const px = ((i - 1) / (POINTS - 1)) * W;
      const py = midY + pv * midY * amplitude;
      c.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    }
  }
  c.lineTo(W, H); c.lineTo(0, H); c.closePath();
  const fg = c.createLinearGradient(0, midY, 0, H);
  fg.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, ${0.08 + energy * 0.1})`);
  fg.addColorStop(1, `rgba(${gr}, ${gg}, ${gb}, 0)`);
  c.fillStyle = fg; c.fill();
}

export function AudioVisualizer({ audio, visible, position, compact = false }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!audio || !visible) return;

    const { analyser } = getOrCreateAudioNodes(audio);
    const bufferLength = analyser.fftSize;
    const freqLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(freqLength);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      rafRef.current = requestAnimationFrame(draw);

      const c = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      c.scale(dpr, dpr);

      const W = rect.width;
      const H = rect.height;
      c.clearRect(0, 0, W, H);

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);
      const energy = getEnergy(freqData);

      drawWaveform(c, W, H, timeData, energy, bufferLength);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [audio, visible]);

  if (!visible) return null;

  // Top position — full width on login, compact when connected
  if (position === 'top') {
    return (
      <div
        className="fixed z-[110] pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          top: compact ? '6px' : '6px',
          left: compact ? 'auto' : '0',
          right: compact ? '250px' : '100px',
          height: compact ? '32px' : '40px',
          width: compact ? '55%' : 'auto',
        }}
      >
        <div
          className="w-full h-full transition-all duration-700"
          style={{
            transform: 'scaleY(-1)',
            maskImage: `linear-gradient(to right, transparent 0%, black ${compact ? '15%' : '5%'}, black ${compact ? '85%' : '95%'}, transparent 100%)`,
            WebkitMaskImage: `linear-gradient(to right, transparent 0%, black ${compact ? '15%' : '5%'}, black ${compact ? '85%' : '95%'}, transparent 100%)`,
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>
    );
  }

  // Bottom full — outro mode, full width, animated slide down
  if (position === 'bottom-full') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[110] pointer-events-none animate-[slideToBottom_1s_cubic-bezier(0.16,1,0.3,1)]">
        <div
          className="w-full h-20"
          style={{
            maskImage: 'linear-gradient(to top, black 50%, transparent 100%), linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
            maskComposite: 'intersect',
            WebkitMaskImage: 'linear-gradient(to top, black 50%, transparent 100%), linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
            WebkitMaskComposite: 'source-in',
          }}
        >
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        <style>{`
          @keyframes slideToBottom {
            from { opacity: 0; transform: translateY(-100vh); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  // Bottom — splash screen mode
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
      }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
