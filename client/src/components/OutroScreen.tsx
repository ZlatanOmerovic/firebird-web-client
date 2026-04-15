import { useState, useEffect } from 'react';

const TECH_STACK = [
  { category: 'Frontend', items: ['React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'TanStack Table', 'TanStack Query', 'CodeMirror 6', 'Zustand'] },
  { category: 'Backend', items: ['Node.js', 'Fastify', 'node-firebird', 'Zod'] },
  { category: 'Database', items: ['Firebird SQL'] },
  { category: 'Infra', items: ['Docker', 'Docker Compose', 'Self-hosted'] },
  { category: 'AI', items: ['Claude Code', 'Claude Opus 4.6'] },
];

// Sequential sections — no overlaps. Each fully fades in, holds, fully fades out.
const SECTIONS = [
  { id: 'company', fadeIn: 0, holdStart: 1.2, holdEnd: 4.5, fadeOut: 6 },
  { id: 'product', fadeIn: 6, holdStart: 7.2, holdEnd: 10.5, fadeOut: 12 },
  { id: 'tech', fadeIn: 12, holdStart: 13.2, holdEnd: 17, fadeOut: 18.5 },
  { id: 'soon', fadeIn: 18.5, holdStart: 19.5, holdEnd: 23, fadeOut: 24.5 },
  { id: 'thanks', fadeIn: 25, holdStart: 26.5, holdEnd: Infinity, fadeOut: Infinity },
];

function sectionOpacity(id: string, t: number): number {
  const s = SECTIONS.find((s) => s.id === id);
  if (!s) return 0;
  if (t < s.fadeIn) return 0;
  if (t < s.holdStart) return (t - s.fadeIn) / (s.holdStart - s.fadeIn);
  if (t <= s.holdEnd) return 1;
  if (t < s.fadeOut) return 1 - (t - s.holdEnd) / (s.fadeOut - s.holdEnd);
  return 0;
}

export function OutroScreen() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - start) / 1000);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Fade-to-black entrance over the first 1.5s
  const entranceOpacity = Math.min(elapsed / 1.5, 1);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center select-none overflow-hidden"
      style={{ background: `rgba(5, 6, 10, ${entranceOpacity})` }}
    >
      {/* Animated background */}
      <div className="absolute inset-0" style={{ opacity: entranceOpacity }}>
        <div className="absolute inset-0 animate-[outroBg1_20s_ease-in-out_infinite]" style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% 50%, rgba(59,130,246,0.05) 0%, transparent 70%)',
        }} />
        <div className="absolute inset-0 animate-[outroBg2_25s_ease-in-out_infinite]" style={{
          background: 'radial-gradient(ellipse 60% 100% at 70% 40%, rgba(139,92,246,0.04) 0%, transparent 70%)',
        }} />
        <div className="absolute inset-0 animate-[outroBg3_30s_ease-in-out_infinite]" style={{
          background: 'radial-gradient(ellipse 70% 50% at 30% 70%, rgba(59,130,246,0.03) 0%, transparent 70%)',
        }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden" style={{ opacity: entranceOpacity }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              background: `rgba(96, 165, 250, ${0.1 + (i % 3) * 0.05})`,
              left: `${10 + i * 11}%`,
              animation: `floatUp ${14 + i * 2}s linear infinite`,
              animationDelay: `${i * 1.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center px-8 max-w-3xl w-full h-full flex items-center justify-center">

        {/* Section 1: Company */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: sectionOpacity('company', elapsed) }}
        >
          <div className="w-16 h-px mb-7" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent)' }} />
          <p className="text-sm text-white/20 tracking-[0.4em] uppercase mb-5">A product by</p>
          <h2 className="text-5xl md:text-7xl font-bold text-white tracking-wide" style={{
            textShadow: '0 0 80px rgba(59, 130, 246, 0.25), 0 0 160px rgba(59, 130, 246, 0.1)',
          }}>
            Ascent Systèmes
          </h2>
          <div className="flex items-center justify-center gap-4 mt-7">
            <div className="h-px flex-1 max-w-20" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12))' }} />
            <div className="h-px flex-1 max-w-20" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.12), transparent)' }} />
          </div>
          <a href="https://github.com/ZlatanOmerovic" target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center gap-2 text-xs text-white/15 hover:text-white/30 transition-colors tracking-[0.15em]">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400/30" />
            github.com/ZlatanOmerovic
          </a>
        </div>

        {/* Section 2: Product */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: sectionOpacity('product', elapsed) }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ring-1 ring-blue-500/15" style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.02))',
          }}>
            <svg className="w-8 h-8 text-blue-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
          </div>
          <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-3">
            Firebird <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Web Client</span>
          </h2>
          <p className="text-sm text-white/20 tracking-[0.2em] mt-2">
            Open source &middot; Modern &middot; Web-based
          </p>
          <a href="https://github.com/ZlatanOmerovic/firebird-web-client" target="_blank" rel="noopener noreferrer" className="mt-5 text-xs text-blue-400/30 hover:text-blue-400/50 transition-colors tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            firebird-web-client
          </a>
        </div>

        {/* Section 3: Tech Stack */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: sectionOpacity('tech', elapsed) }}
        >
          <p className="text-sm text-white/20 tracking-[0.35em] uppercase mb-10">Built with</p>
          <div className="flex gap-14 justify-center">
            {TECH_STACK.map((group) => (
              <div key={group.category} className="text-center">
                <p className="text-[11px] tracking-[0.25em] uppercase mb-4" style={{
                  background: 'linear-gradient(135deg, #3b82f6, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>{group.category}</p>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <p key={item} className="text-sm text-white/40 font-light tracking-wide">{item}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Coming soon */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: sectionOpacity('soon', elapsed) }}
        >
          <p className="text-4xl md:text-5xl font-light text-white/70 tracking-wide leading-relaxed">
            Soon at your <span className="font-semibold" style={{
              background: 'linear-gradient(135deg, #3b82f6, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.2))',
            }}>service</span>
          </p>
          <div className="w-12 h-px bg-white/8 mt-8" />
        </div>

        {/* Section 5: Thank you — stays visible forever */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: sectionOpacity('thanks', elapsed) }}
        >
          <div className="w-24 h-px mb-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent)' }} />
          <h2 className="text-3xl md:text-5xl font-bold tracking-[0.12em] uppercase leading-snug" style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.4))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Thank you for your
            <br />
            attention to this matter
          </h2>
          <div className="w-24 h-px mt-10" style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent)' }} />
          <p className="mt-8 text-xs text-white/10 tracking-[0.4em] uppercase">&copy; {new Date().getFullYear()} Ascent Systèmes</p>
        </div>
      </div>

      {/* Subtle progress line */}
      <div
        className="absolute bottom-0 left-0 h-[1px] transition-all duration-200 ease-linear"
        style={{
          width: `${Math.min((elapsed / 30) * 100, 100)}%`,
          background: 'linear-gradient(90deg, rgba(59,130,246,0.2), rgba(96,165,250,0.3), rgba(59,130,246,0.2))',
        }}
      />

      <style>{`
        @keyframes outroBg1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3%, -2%) scale(1.05); }
        }
        @keyframes outroBg2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4%, 3%) scale(1.1); }
        }
        @keyframes outroBg3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(2%, 4%) scale(1.08); }
          66% { transform: translate(-3%, -2%) scale(0.95); }
        }
        @keyframes floatUp {
          0% { top: 110%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: -10%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
