import { useEffect, useRef } from 'react';

interface ReactiveBackgroundProps {
  audio: HTMLAudioElement | null;
  active: boolean;
}

interface AudioNodes {
  ctx: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
}

function getAudioNodes(): AudioNodes | null {
  return ((window as unknown as Record<string, unknown>).__vizNodes as AudioNodes) ?? null;
}

interface Orb {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  radius: number;
  freqBand: 'bass' | 'mid' | 'treble';
  hue: number;
  driftAngle: number;
  driftSpeed: number;
}

const ORBS: Orb[] = [
  { x: 0, y: 0, baseX: 0.3, baseY: 0.35, radius: 180, freqBand: 'bass', hue: 220, driftAngle: 0, driftSpeed: 0.0003 },
  { x: 0, y: 0, baseX: 0.7, baseY: 0.4, radius: 140, freqBand: 'mid', hue: 240, driftAngle: 2, driftSpeed: 0.0004 },
  { x: 0, y: 0, baseX: 0.5, baseY: 0.6, radius: 200, freqBand: 'bass', hue: 215, driftAngle: 4, driftSpeed: 0.0002 },
  { x: 0, y: 0, baseX: 0.2, baseY: 0.7, radius: 100, freqBand: 'treble', hue: 260, driftAngle: 1, driftSpeed: 0.0005 },
  { x: 0, y: 0, baseX: 0.8, baseY: 0.25, radius: 120, freqBand: 'mid', hue: 230, driftAngle: 3, driftSpeed: 0.0003 },
];

function getBandEnergy(freqData: Uint8Array, band: 'bass' | 'mid' | 'treble'): number {
  const len = freqData.length;
  let sum = 0;
  let count = 0;
  let start: number, end: number;

  switch (band) {
    case 'bass': start = 0; end = Math.floor(len * 0.08); break;
    case 'mid': start = Math.floor(len * 0.08); end = Math.floor(len * 0.4); break;
    case 'treble': start = Math.floor(len * 0.4); end = len; break;
  }

  for (let i = start; i < end; i++) { sum += freqData[i]; count++; }
  return count > 0 ? sum / (count * 255) : 0;
}

export function ReactiveBackground({ audio, active }: ReactiveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);
  const prevEnergyRef = useRef(0);

  useEffect(() => {
    if (!audio || !active) return;

    const freqData = new Uint8Array(1024);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      timeRef.current += 16;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const nodes = getAudioNodes();
      const c = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      c.scale(dpr, dpr);

      const W = rect.width;
      const H = rect.height;
      c.clearRect(0, 0, W, H);

      if (nodes) {
        nodes.analyser.getByteFrequencyData(freqData);
      }

      const bassEnergy = nodes ? getBandEnergy(freqData, 'bass') : 0;
      const midEnergy = nodes ? getBandEnergy(freqData, 'mid') : 0;
      const trebleEnergy = nodes ? getBandEnergy(freqData, 'treble') : 0;
      const totalEnergy = (bassEnergy + midEnergy + trebleEnergy) / 3;

      // Smooth energy for vignette
      prevEnergyRef.current += (totalEnergy - prevEnergyRef.current) * 0.1;
      const smoothEnergy = prevEnergyRef.current;

      const t = timeRef.current;

      // ── Pulsing radial glow ───────────────────────────────
      const glowScale = 1 + bassEnergy * 0.3;
      const glowAlpha = 0.04 + bassEnergy * 0.08;
      const glow = c.createRadialGradient(
        W * 0.5, H * 0.45, 0,
        W * 0.5, H * 0.45, W * 0.5 * glowScale,
      );
      glow.addColorStop(0, `rgba(59, 130, 246, ${glowAlpha})`);
      glow.addColorStop(0.5, `rgba(59, 130, 246, ${glowAlpha * 0.3})`);
      glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, W, H);

      // ── Floating orbs ─────────────────────────────────────
      for (const orb of ORBS) {
        const bandE = orb.freqBand === 'bass' ? bassEnergy
          : orb.freqBand === 'mid' ? midEnergy : trebleEnergy;

        orb.driftAngle += orb.driftSpeed * 16;
        orb.x = orb.baseX * W + Math.cos(orb.driftAngle) * 40;
        orb.y = orb.baseY * H + Math.sin(orb.driftAngle * 0.7) * 30;

        const scale = 1 + bandE * 0.5;
        const r = orb.radius * scale;
        const alpha = 0.015 + bandE * 0.04;

        const grad = c.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r);
        grad.addColorStop(0, `hsla(${orb.hue}, 80%, 60%, ${alpha})`);
        grad.addColorStop(0.4, `hsla(${orb.hue}, 70%, 50%, ${alpha * 0.5})`);
        grad.addColorStop(1, `hsla(${orb.hue}, 60%, 40%, 0)`);
        c.fillStyle = grad;
        c.fillRect(orb.x - r, orb.y - r, r * 2, r * 2);
      }

      // ── Ripple rings on bass hits ─────────────────────────
      if (bassEnergy > 0.55) {
        const ringAlpha = (bassEnergy - 0.55) * 1.5;
        const rippleRadius = W * 0.15 + bassEnergy * W * 0.2;
        c.beginPath();
        c.arc(W * 0.5, H * 0.45, rippleRadius, 0, Math.PI * 2);
        c.strokeStyle = `rgba(59, 130, 246, ${ringAlpha * 0.15})`;
        c.lineWidth = 1.5;
        c.stroke();

        // Second ring
        c.beginPath();
        c.arc(W * 0.5, H * 0.45, rippleRadius * 0.6, 0, Math.PI * 2);
        c.strokeStyle = `rgba(96, 165, 250, ${ringAlpha * 0.08})`;
        c.lineWidth = 1;
        c.stroke();
      }

      // ── Vignette pulse ────────────────────────────────────
      const vignetteStrength = 0.4 + smoothEnergy * 0.25;
      const vignette = c.createRadialGradient(
        W * 0.5, H * 0.5, W * 0.2,
        W * 0.5, H * 0.5, W * 0.8,
      );
      vignette.addColorStop(0, 'rgba(7, 8, 12, 0)');
      vignette.addColorStop(0.6, `rgba(7, 8, 12, ${vignetteStrength * 0.3})`);
      vignette.addColorStop(1, `rgba(7, 8, 12, ${vignetteStrength})`);
      c.fillStyle = vignette;
      c.fillRect(0, 0, W, H);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [audio, active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
