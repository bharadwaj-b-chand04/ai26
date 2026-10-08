import { ArrowRight, ShieldCheck } from "lucide-react"

export function IntroSplash({ onComplete }: { onComplete: () => void }) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if (reducedMotion) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#070b0f] text-white"
      role="dialog"
      aria-label="Welcome to AI26"
      aria-modal="true"
    >
      <div className="relative mx-6 flex w-full max-w-sm flex-col items-center text-center font-sans">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-white/20 bg-white text-black shadow-lg backdrop-blur-sm">
          <ShieldCheck className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-400 font-sans">
          Surveillance Intelligence Console
        </p>
        <h1 className="text-4xl font-bold tracking-[0.18em] text-white font-sans">AI26</h1>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-300 font-sans">
          Establishing a clear view across the city.
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-10 inline-flex items-center gap-2 rounded-md border border-white/30 bg-white px-5 py-2.5 text-xs font-semibold text-black transition-all hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Enter Console <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="absolute bottom-5 left-0 right-0 text-center font-sans text-[10px] uppercase tracking-[0.24em] text-zinc-500">
        ANPR Trajectory Grid · Kochi
      </div>
    </div>
  )
}
