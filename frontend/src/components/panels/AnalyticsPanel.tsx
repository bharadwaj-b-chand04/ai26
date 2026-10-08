import { useEffect, useState } from "react"
import { ArrowRight, BarChart3, Activity, Video } from "lucide-react"
import { getCameras, getStats, type Camera, type Stats } from "@/lib/api"
import { OsmMap } from "@/components/OsmMap"
import { DEMO_FLOWS } from "@/lib/demo"

export function AnalyticsPanel() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCameras().then(setCameras).catch((reason: Error) => setError(reason.message))
  }, [])

  useEffect(() => {
    let alive = true
    const tick = () =>
      getStats()
        .then((s) => alive && setStats(s))
        .catch((reason: Error) => alive && setError(reason.message))
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const perCam = stats ? Object.entries(stats.per_camera).sort((a, b) => b[1] - a[1]) : []
  const max = perCam.length ? perCam[0][1] : 1
  const total = stats?.total_events || 1
  const mapColor = (share: number) => (share > 0.35 ? "#ff5c72" : share > 0.18 ? "#ffb545" : "#22d3c8")

  return (
    <div className="h-full overflow-y-auto bg-black font-sans text-white p-4 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {/* Top Header Card */}
        <div className="flex flex-col gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-zinc-400" />
            <h1 className="text-sm font-semibold text-white tracking-wide">Traffic & Detection Analytics</h1>
          </div>
          <p className="text-xs text-zinc-400 font-sans leading-relaxed">
            Rolling 5-minute detection window. Real event counts normalized to prevent looping demo artifacts.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-950/60 p-3 text-xs text-red-200 font-sans">
            Analytics API unavailable: {error}
          </div>
        )}

        {/* Map Overview Section */}
        <div className="relative h-64 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950">
          <OsmMap
            points={cameras.map((cam) => {
              const share = (stats?.per_camera[cam.id] ?? 0) / total
              return { id: cam.id, lat: cam.lat, lon: cam.lon, label: cam.id, color: mapColor(share), size: 5 + share * 16 }
            })}
            className="h-full w-full"
            ariaLabel="OpenStreetMap congestion overview of Kochi"
          />
          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-3 rounded-md border border-zinc-800 bg-black/90 px-2.5 py-1 text-[10px] font-sans text-zinc-300 backdrop-blur-md">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#22d3c8" }} /> baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#ffb545" }} /> elevated
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "#ff5c72" }} /> busiest
            </span>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">Detections (5 min)</span>
              <Activity className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums font-sans">
              {stats?.total_events ?? "—"}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">Total verified events logged</div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">Avg Confidence</span>
              <Activity className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums font-sans">
              {stats ? `${Math.round(stats.avg_confidence * 100)}%` : "—"}
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">Inference model certainty</div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[11px] font-medium uppercase tracking-wider">Active Nodes</span>
              <Video className="h-3.5 w-3.5 text-zinc-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2 text-2xl font-bold tracking-tight text-white tabular-nums font-sans">
              {cameras.length || "—"}
              <span className="text-xs font-semibold text-zinc-400">online</span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">Grid stream processors healthy</div>
          </div>
        </div>

        {/* Detections per camera breakdown */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Detections Per Camera
            </div>
            <span className="text-[11px] text-zinc-500">Relative distribution</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {perCam.map(([cam, count]) => (
              <div key={cam} className="flex items-center gap-3">
                <span className="w-20 text-xs font-semibold text-zinc-300 font-sans">{cam}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-300"
                    style={{ width: `${Math.max(2, (count / max) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold tabular-nums text-white font-sans">
                  {count}
                </span>
              </div>
            ))}
            {perCam.length === 0 && <div className="text-xs text-zinc-500 py-2">No detection records yet.</div>}
          </div>
        </div>

        {/* Origin / destination flow */}
        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Origin / Destination Flow
            </div>
            <span className="inline-flex items-center rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-sans font-medium uppercase tracking-wider text-zinc-400">
              Walkthrough / Not live
            </span>
          </div>
          <div className="divide-y divide-zinc-900">
            {DEMO_FLOWS.map((flow) => (
              <div key={`${flow.from}-${flow.to}`} className="flex items-center gap-3 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-zinc-300 font-medium font-sans">{flow.from}</span>
                <ArrowRight className="h-3.5 w-3.5 flex-none text-zinc-600" />
                <span className="min-w-0 flex-1 truncate text-zinc-300 font-medium font-sans">{flow.to}</span>
                <span className="w-8 text-right font-sans font-semibold tabular-nums text-white">{flow.count}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-zinc-500 font-sans">
            Flow reconstruction is shown as a demo scenario until multi-camera trajectory synthesis is connected.
          </div>
        </div>
      </div>
    </div>
  )
}
