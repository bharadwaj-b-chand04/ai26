import { useEffect, useState } from "react"
import { FileText, Route, Search } from "lucide-react"
import type { Camera, EvidenceReport, Trajectory } from "@/lib/api"
import { createEvidenceReport, getTrajectory } from "@/lib/api"
import { cn } from "@/lib/utils"
import { EvidenceTimeline } from "@/components/panels/EvidenceTimeline"
import { OsmMap } from "@/components/OsmMap"
import { DEMO_PLATE } from "@/lib/demo"

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString()
}

export function TimelinePage({ cameras }: { cameras: Camera[] }) {
  const [camId, setCamId] = useState("")
  const [mode, setMode] = useState<"live" | "trajectory">("live")
  const [plate, setPlate] = useState(DEMO_PLATE.plate)
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null)
  const [trajectoryPlate, setTrajectoryPlate] = useState("")
  const [trajectoryError, setTrajectoryError] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<EvidenceReport | null>(null)
  const [evidenceError, setEvidenceError] = useState<string | null>(null)
  const active = camId || cameras[0]?.id || ""

  useEffect(() => {
    if (mode !== "trajectory" || !plate.trim()) return
    let alive = true
    getTrajectory(plate.trim())
      .then((result) => {
        if (!alive) return
        setTrajectory(result)
        setTrajectoryPlate(plate.trim())
        setTrajectoryError(null)
      })
      .catch((error: Error) => alive && setTrajectoryError(error.message))
    return () => {
      alive = false
    }
  }, [mode, plate])

  async function printEvidence() {
    setEvidenceError(null)
    try {
      const result = await createEvidenceReport(plate.trim())
      setEvidence(result)
      window.setTimeout(() => window.print(), 0)
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : "Evidence export failed")
    }
  }

  if (mode === "trajectory") {
    const live = Boolean(trajectory?.observations.length && trajectoryPlate === plate.trim())
    const hops = live
      ? trajectory!.observations
      : DEMO_PLATE.hops.map((hop) => ({
        camera_id: hop.camera,
        location: hop.location,
        location_confirmed: false,
        lat: cameras.find((camera) => camera.id === hop.camera)?.lat ?? 0,
        lon: cameras.find((camera) => camera.id === hop.camera)?.lon ?? 0,
        ts: 0,
        confidence: hop.confidence,
        repairs: [],
      }))
    const points = hops.map((hop) => ({ id: hop.camera_id, lat: hop.lat, lon: hop.lon, label: hop.camera_id, active: true }))
    const rejected = live
      ? trajectory!.rejected_links.map((link) => link.reason).join("; ") || "None"
      : DEMO_PLATE.rejected
    const status = live ? trajectory!.status.replace("_", " ") : DEMO_PLATE.status

    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-black p-4 font-sans text-white">
        {/* Mode Toggle + Status */}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMode("live")} className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-sans text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white">Live camera log</button>
          <button type="button" onClick={() => setMode("trajectory")} className="rounded-md border border-white bg-white px-2.5 py-1.5 text-xs font-sans font-semibold text-black shadow-sm">Plate trajectory</button>
          <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-sans font-medium", live ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-zinc-700 bg-zinc-900 text-zinc-400")}>{live ? "Live event trajectory" : "Walkthrough demo"}</span>
        </div>

        {/* Plate Input Bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-800 bg-zinc-950 p-3">
          <Route className="h-4 w-4 text-zinc-400" />
          <input
            type="text"
            aria-label="Plate to investigate"
            value={plate}
            onChange={(event) => setPlate(event.target.value.toUpperCase())}
            className="h-8 w-44 rounded-md border border-zinc-800 bg-zinc-900/90 px-3 text-xs font-sans font-semibold tracking-wider text-white placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <span className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[11px] font-sans font-medium text-zinc-400">Indian format / mock registry</span>
          <button type="button" className="ml-auto flex items-center gap-1.5 rounded-md border border-white bg-white px-3 py-1.5 text-xs font-sans font-semibold text-black shadow-sm transition-colors hover:bg-zinc-200" onClick={printEvidence}><FileText className="h-3.5 w-3.5" /> Generate evidence</button>
        </div>

        {/* Error / Success States */}
        {trajectoryError && <div className="rounded-md border border-red-500/30 bg-red-950/40 p-2 text-xs font-sans text-red-200">Trajectory unavailable: {trajectoryError}</div>}
        {evidenceError && <div className="rounded-md border border-red-500/30 bg-red-950/40 p-2 text-xs font-sans text-red-200">Evidence export unavailable: {evidenceError}</div>}
        {evidence && <div className="rounded-md border border-zinc-700 bg-zinc-900 p-2 text-[11px] font-sans text-zinc-300">Report {evidence.report_id} · SHA-256 {evidence.package_hash.slice(0, 16)}… · {evidence.retention}</div>}

        {/* Map + Detail Card */}
        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="min-h-[360px] overflow-hidden rounded-md border border-zinc-800"><OsmMap points={points} lines={[{ id: "trajectory", points: points.map((point) => [point.lat, point.lon] as [number, number]), color: "#ffffff", width: 5 }]} className="h-full w-full" ariaLabel={`Evidence trajectory for ${plate}`} /></div>
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold tracking-wider text-white font-sans">{plate || DEMO_PLATE.plate}</div>
                <div className="text-xs text-zinc-400 font-sans">{live ? "Observed plate events" : DEMO_PLATE.vehicle}</div>
              </div>
              <span className={cn("inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-sans font-medium", live ? "border-zinc-700 bg-zinc-900 text-zinc-200" : "border-zinc-700 bg-zinc-900 text-zinc-400")}>{status}</span>
            </div>
            <div className="mt-4 space-y-3">
              {hops.map((hop, index) => (
                <div key={`${hop.camera_id}-${hop.ts}-${index}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-white" />
                    {index < hops.length - 1 && <span className="w-px flex-1 bg-zinc-800" />}
                  </div>
                  <div className="pb-3">
                    <div className="text-xs font-semibold text-white tracking-tight font-sans">{hop.camera_id} · {hop.ts ? formatTime(hop.ts) : DEMO_PLATE.hops[index]?.time}</div>
                    <div className="text-xs text-zinc-400 font-sans">{hop.location}</div>
                    <span className="mt-1 inline-flex items-center rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] font-sans font-medium text-zinc-300">{Math.round(hop.confidence * 100)}% confidence</span>
                    {hop.repairs.length > 0 && <div className="mt-1 text-[11px] text-zinc-400 font-sans">OCR repair: {hop.repairs.join(", ")}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-md border border-zinc-700/50 bg-zinc-900/60 p-2.5 text-[11px] text-zinc-400 font-sans">Rejected candidate: {rejected}</div>
            {!live && <div className="mt-2 text-[11px] text-zinc-500 font-sans">No matching plate events are currently in the five-minute log. This route is a labeled walkthrough.</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-black font-sans text-white">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-2.5">
        <button type="button" onClick={() => setMode("live")} className="rounded-md border border-white bg-white px-2.5 py-1.5 text-xs font-sans font-semibold text-black shadow-sm">Live camera log</button>
        <button type="button" onClick={() => setMode("trajectory")} className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs font-sans text-zinc-400 transition-colors hover:border-zinc-700 hover:text-white"><Search className="h-3.5 w-3.5" /> Plate trajectory</button>
        <span className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-sans font-medium text-zinc-200">Real event log</span>
        <span className="text-[11px] text-zinc-500 font-sans">Choose a camera for live evidence or investigate a normalized plate.</span>
      </div>

      {/* Camera Sidebar + Timeline */}
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-1 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-2.5">
          {cameras.map((camera) => (
            <button
              key={camera.id}
              type="button"
              onClick={() => setCamId(camera.id)}
              className={cn(
                "rounded-md px-2.5 py-2 text-left text-xs font-sans transition-all duration-150",
                camera.id === active
                  ? "border border-white bg-white text-black font-semibold shadow-sm"
                  : "border border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <div className="font-semibold font-sans tracking-tight">{camera.id}</div>
              <div className="truncate text-[11px] opacity-70 font-sans">{camera.location_confirmed ? camera.location : "Location unconfirmed"}</div>
            </button>
          ))}
        </div>
        <div className="min-h-0"><EvidenceTimeline cameras={cameras} focused={active} /></div>
      </div>
    </div>
  )
}
