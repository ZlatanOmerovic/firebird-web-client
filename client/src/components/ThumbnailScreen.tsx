export function ThumbnailScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#080a12] overflow-hidden">
      {/* Ambient glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-20" style={{
        background: 'radial-gradient(circle, rgba(59,130,246,0.3) 0%, rgba(99,102,241,0.1) 40%, transparent 70%)',
      }} />
      <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full opacity-15" style={{
        background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 60%)',
      }} />
      <div className="absolute bottom-1/3 right-1/3 w-[300px] h-[300px] rounded-full opacity-10" style={{
        background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 60%)',
      }} />

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Main content */}
      <div className="relative flex flex-col items-center gap-8">
        {/* Logo icon */}
        <div className="relative">
          {/* Outer glow ring */}
          <div className="absolute inset-[-20px] rounded-full" style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          }} />
          {/* Icon container */}
          <div className="relative w-28 h-28 rounded-3xl flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.08) 100%)',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 0 80px rgba(59,130,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="url(#logoGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="24" y2="24">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-5xl font-bold tracking-tight">
            <span className="text-white">Firebird </span>
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>Web Client</span>
          </h1>
          <div className="flex items-center gap-3">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-blue-500/30" />
            <p className="text-sm font-medium tracking-[0.3em] uppercase text-white/30">
              The complete IDE for Firebird databases
            </p>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-blue-500/30" />
          </div>
        </div>

        {/* Version badge */}
        <div className="flex items-center gap-3 mt-2">
          <span className="px-3 py-1 text-xs font-mono rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400/80">
            v0.0.1-beta
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400/80">
            Open Source
          </span>
          <span className="px-3 py-1 text-xs font-medium rounded-full border border-orange-500/20 bg-orange-500/5 text-orange-400/80">
            Free Forever
          </span>
        </div>

        {/* Tech stack pills */}
        <div className="flex items-center gap-2 mt-4">
          {['React 19', 'TypeScript', 'Tailwind CSS', 'Fastify', 'CodeMirror 6'].map((tech) => (
            <span key={tech} className="px-2.5 py-1 text-[10px] font-medium text-white/20 border border-white/5 rounded-md">
              {tech}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom attribution */}
      <div className="absolute bottom-8 flex flex-col items-center gap-2">
        <p className="text-[11px] text-white/15 tracking-widest uppercase">
          Built by Ascent Syst&egrave;mes
        </p>
      </div>
    </div>
  );
}
