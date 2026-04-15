import { useState, useEffect, useRef } from 'react';
import { AudioVisualizer } from './AudioVisualizer';
import { ReactiveBackground } from './ReactiveBackground';

interface SplashScreenProps {
  onComplete: () => void;
}

const LINES: { text: string; brand: string; startSec: number; endSec: number }[] = [
  { text: 'Are you tired of', brand: 'IBExpert', startSec: 0, endSec: 4 },
  { text: 'Are you tired of', brand: 'FlameRobin', startSec: 4, endSec: 8 },
  { text: 'Are you tired of', brand: 'Database Workbench', startSec: 8, endSec: 12 },
  { text: 'Are you tired of', brand: 'Firebird Maestro', startSec: 12, endSec: 16 },
  { text: 'Are you tired of', brand: 'desktop-only', startSec: 16, endSec: 20 },
];

const SUBTEXTS: Record<string, string> = {
  'IBExpert': 'licensing?',
  'FlameRobin': 'crashing?',
  'Database Workbench': 'limitations?',
  'Firebird Maestro': 'subscriptions?',
  'desktop-only': 'clients?',
};

const TOTAL_DURATION = 29;

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'playing' | 'fading'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const startTimeRef = useRef(0);

  // Preload audio into memory on mount
  useEffect(() => {
    const audio = new Audio('/splash-music.mp3');
    audio.preload = 'auto';
    audio.loop = true;
    // Force browser to fetch the entire file
    audio.load();
    (window as unknown as Record<string, unknown>).__splashAudio = audio;
    audioRef.current = audio;
  }, []);

  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      const t = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(t);
      if (t >= TOTAL_DURATION) {
        clearInterval(interval);
        setPhase('fading');
        setTimeout(() => onCompleteRef.current(), 800);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [phase]);

  const handleStart = () => {
    setPhase('waiting');
    setTimeout(() => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      startTimeRef.current = Date.now();
      setPhase('playing');
    }, 1000);
  };

  const currentLine = LINES.find((l) => elapsed >= l.startSec && elapsed < l.endSec);
  const showSolution = elapsed >= 20 && elapsed < 22.5;
  const showAscent = elapsed >= 22.5 && elapsed < 26;
  const showCountdown = elapsed >= 26 && elapsed < 28;
  const showPresents = elapsed >= 28;

  // Ascent: scale up gently
  const ascentProgress = Math.min((elapsed - 22.5) / 3.5, 1);

  // Countdown: 4 numbers in 2 seconds (0.5s each)
  const countdownNum = showCountdown ? Math.min(4, Math.floor((elapsed - 26) / 0.5) + 1) : 0;

  if (phase === 'idle' || phase === 'waiting') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden" style={{ background: '#07080c' }}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute inset-0 animate-[bgShift_12s_ease-in-out_infinite]" style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 70%)',
          }} />
        </div>

        <div className={`transition-opacity duration-500 ${phase === 'waiting' ? 'opacity-0' : 'opacity-100'}`}>
          <button
            onClick={handleStart}
            disabled={phase === 'waiting'}
            className="group relative px-12 py-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-500 hover:border-white/20 hover:scale-105 active:scale-100 disabled:pointer-events-none"
          >
            <span className="text-xl font-extralight text-white/70 tracking-[0.3em] uppercase group-hover:text-white/90 transition-colors duration-500">
              Start
            </span>
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ boxShadow: '0 0 60px rgba(59, 130, 246, 0.12)' }} />
          </button>
        </div>

        <style>{`
          @keyframes bgShift {
            0%, 100% { transform: translate(0%, 0%) scale(1); }
            33% { transform: translate(5%, -3%) scale(1.1); }
            66% { transform: translate(-5%, 3%) scale(0.95); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-700 ${phase === 'fading' ? 'opacity-0' : 'opacity-100'}`}
      style={{ background: '#07080c' }}
    >
      {/* Reactive background */}
      <ReactiveBackground audio={audioRef.current} active={phase === 'playing'} />

      {/* Audio visualizer */}
      <AudioVisualizer audio={audioRef.current} visible={phase === 'playing'} position="bottom" />

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] transition-all duration-200 ease-linear z-10"
        style={{
          width: `${Math.min((elapsed / TOTAL_DURATION) * 100, 100)}%`,
          background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)',
          boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)',
        }}
      />

      {/* Content */}
      <div className="relative text-center px-8 max-w-3xl z-10">
        {/* Phase 1: Brand questions */}
        {currentLine && !showSolution && !showAscent && !showPresents && (
          <div key={currentLine.brand} className="animate-[slideIn_0.7s_cubic-bezier(0.16,1,0.3,1)]">
            <p className="text-2xl md:text-[2rem] font-extralight text-white/60 leading-relaxed tracking-wide mb-3 animate-[pulse_2s_ease-in-out_infinite]">
              {currentLine.text}
            </p>
            <p className="text-3xl md:text-5xl font-semibold tracking-tight mb-3" style={{
              background: 'linear-gradient(135deg, #f59e0b, #f97316, #ef4444)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(245, 158, 11, 0.2))',
            }}>
              {currentLine.brand}
            </p>
            <p className="text-xl md:text-2xl font-extralight text-white/30 tracking-wide mt-2">
              {SUBTEXTS[currentLine.brand]}
            </p>
          </div>
        )}

        {/* Phase 2: "We found a solution" */}
        {showSolution && (
          <div className="animate-[slideIn_0.6s_cubic-bezier(0.16,1,0.3,1)]">
            <p className="text-3xl md:text-5xl font-light leading-snug tracking-wide">
              <span className="text-white/80">We found a </span>
              <span className="font-semibold" style={{
                background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>solution</span>
              <span className="text-white/80"> for you.</span>
            </p>
          </div>
        )}

        {/* Phase 3: Ascent Systèmes — smooth reveal */}
        {showAscent && (
          <div
            className="animate-[fadeIn_1s_ease-out]"
            style={{
              transform: `scale(${0.95 + ascentProgress * 0.05})`,
              transition: 'transform 0.3s ease-out',
            }}
          >
            <div className="mb-8">
              <p className="text-5xl md:text-7xl font-bold tracking-wide text-white" style={{
                textShadow: '0 0 60px rgba(59, 130, 246, 0.25), 0 0 120px rgba(59, 130, 246, 0.1)',
              }}>
                Ascent Systèmes
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px flex-1 max-w-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15))' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400/40" />
              <div className="h-px flex-1 max-w-20" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.15), transparent)' }} />
            </div>
            <p className="text-sm md:text-base text-white/30 tracking-[0.35em] uppercase font-light">
              proudly presents to you
            </p>
          </div>
        )}

        {/* Phase 4: Countdown */}
        {showCountdown && (
          <div key={countdownNum} className="animate-[countPop_0.4s_cubic-bezier(0.16,1,0.3,1)]">
            <p className="text-8xl md:text-9xl font-bold tabular-nums" style={{
              background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.3))',
            }}>
              {countdownNum}
            </p>
          </div>
        )}

        {/* Phase 5: Product reveal */}
        {showPresents && (
          <div className="animate-[revealUp_1s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/20" style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))',
            }}>
              <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-3">
              Firebird <span style={{
                background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Web Client</span>
            </h1>
            <p className="text-base md:text-lg text-white/30 font-light tracking-wider">
              The modern way to manage Firebird databases
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.85; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes countPop {
          0% { opacity: 0; transform: scale(1.8); }
          40% { opacity: 1; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes revealUp {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bgShift {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33% { transform: translate(5%, -3%) scale(1.1); }
          66% { transform: translate(-5%, 3%) scale(0.95); }
        }
        @keyframes bgShift2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          50% { transform: translate(-8%, 5%) scale(1.15); }
        }
      `}</style>
    </div>
  );
}
