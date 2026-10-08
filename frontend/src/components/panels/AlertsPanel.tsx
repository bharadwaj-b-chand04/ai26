import { useEffect, useState } from "react"
import { Bell, CheckCircle2 } from "lucide-react"
import { getAlerts, type Alert } from "@/lib/api"
import { DEMO_ALERTS } from "@/lib/demo"

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [showDemo, setShowDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const tick = () =>
      getAlerts()
        .then((a) => alive && setAlerts(a))
        .catch((reason: Error) => alive && setError(reason.message))
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const displayAlerts = [...alerts, ...(showDemo ? DEMO_ALERTS : [])]

  return (
    <div className="h-full overflow-y-auto bg-black font-sans text-white p-4 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {/* Top Header Card */}
        <div className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-zinc-400" />
            <h1 className="text-sm font-semibold text-white tracking-wide">Automated Anomaly & Match Alerts</h1>
          </div>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed">
            Rule-based route-anomaly and cross-camera appearance matches computed continuously from the detection log.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200 font-sans">
            Alert API unavailable: {error}
          </div>
        )}

        {/* Demo Controller Console */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-white tracking-wide">Alert Review Console</div>
            <div className="text-xs text-zinc-400">
              Toggle labeled walkthrough scenario to inspect human-operator escalation flows.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDemo((value) => !value)}
            className={`cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-sans font-medium transition-colors ${
              showDemo
                ? "bg-white text-black border border-white font-semibold shadow-sm"
                : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
            }`}
          >
            {showDemo ? "Hide Walkthrough Demo" : "Preview Walkthrough Demo"}
          </button>
        </div>

        {showDemo && (
          <div className="flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            Displaying simulated demonstration alerts — not live occurrences
          </div>
        )}

        {/* Alerts List */}
        {displayAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 py-16 text-center">
            <CheckCircle2 className="mb-2 h-6 w-6 text-zinc-600" />
            <div className="text-sm font-medium text-zinc-300">No active anomalies detected</div>
            <div className="mt-1 text-xs text-zinc-500">
              Active detection rules: Cross-camera appearance match, perimeter loitering, and route deviations.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {displayAlerts.map((a, i) => (
              <div
                key={i}
                className="group flex gap-3.5 rounded-md border border-zinc-800 bg-zinc-950 p-4 transition-colors hover:border-zinc-700"
              >
                <div
                  className={`w-1 flex-none rounded-full ${
                    a.severity === "critical"
                      ? "bg-red-500"
                      : a.severity === "warning"
                      ? "bg-amber-400"
                      : "bg-zinc-400"
                  }`}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider ${
                        a.severity === "critical"
                          ? "border border-red-500/30 bg-red-950/40 text-red-400"
                          : a.severity === "warning"
                          ? "border border-amber-500/30 bg-amber-950/40 text-amber-300"
                          : "border border-zinc-700 bg-zinc-800 text-zinc-200"
                      }`}
                    >
                      {a.severity}
                    </span>
                    <span className="inline-flex items-center rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-sans font-medium text-zinc-400 uppercase tracking-wider">
                      {a.type}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white tracking-wide">{a.summary}</div>
                  <div className="text-xs text-zinc-400 leading-relaxed font-sans">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
