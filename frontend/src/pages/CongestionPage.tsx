import { useEffect, useState } from "react"
import { getCameras, getStats, type Camera, type Stats } from "@/lib/api"
import { OsmMap, type MapLine } from "@/components/OsmMap"
import { Badge } from "@/components/ui/badge"

const CORRIDORS = [
  ["CAM-01", "CAM-02", "CAM-03"],
  ["CAM-04", "CAM-01", "CAM-05"],
  ["CAM-06", "CAM-07", "CAM-08", "CAM-09"],
]

export function CongestionPage() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCameras().then(setCameras).catch((reason: Error) => setError(reason.message))
  }, [])

  useEffect(() => {
    let alive = true
    const tick = () => getStats().then((s) => alive && setStats(s)).catch((reason: Error) => alive && setError(reason.message))
    tick()
    const id = setInterval(tick, 2000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  const total = stats?.total_events || 1
  const ranked = cameras
    .map((c) => ({ cam: c, count: stats?.per_camera[c.id] ?? 0 }))
    .sort((a, b) => b.count - a.count)
  const load = (cameraId: string) => {
    const count = stats?.per_camera[cameraId] ?? 0
    return count / total
  }
  const congestionColor = (share: number) => (share > 0.35 ? "#ff5c72" : share > 0.18 ? "#ffb545" : "#22d3c8")
  const byId = Object.fromEntries(cameras.map((camera) => [camera.id, camera]))
  const lines: MapLine[] = CORRIDORS.map((corridor, index) => ({
    id: `corridor-${index}`,
    points: corridor
      .map((id) => byId[id])
      .filter(Boolean)
      .map((camera) => [camera.lat, camera.lon] as [number, number]),
    color: congestionColor(corridor.reduce((sum, id) => sum + load(id), 0) / corridor.length),
    width: 8,
  })).filter((line) => line.points.length > 1)

  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-0">
      {error && <div className="absolute left-4 top-4 z-20 rounded-md border border-red-400/30 bg-red-950/90 p-2 text-xs text-red-100">Congestion API unavailable: {error}</div>}
      <div className="relative min-h-0 border-r border-border p-4">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Live corridor load from the last 5 minutes. Line color and node radius are driven by real inference counts.</span>
          <Badge variant="outline" className="flex-none">Computed counts / not baseline</Badge>
        </div>
        <div className="relative h-[calc(100%-32px)] overflow-hidden rounded-lg border border-border">
          <OsmMap
            lines={lines}
            points={cameras.map((cam) => ({
              id: cam.id,
              lat: cam.lat,
              lon: cam.lon,
              label: cam.id,
              detail: `${stats?.per_camera[cam.id] ?? 0} detections / 5 min`,
              color: congestionColor(load(cam.id)),
              size: 5 + load(cam.id) * 24,
            }))}
            className="h-full w-full"
            ariaLabel="OpenStreetMap live congestion map of Kochi"
          />
          <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded bg-background/85 px-2.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> baseline</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" /> elevated</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> busiest</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-y-auto p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ranked by load
        </div>
        <div className="flex flex-col gap-2">
          {ranked.map(({ cam, count }, i) => {
            const share = count / total
            return (
              <div key={cam.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <span className="w-4 text-center font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-semibold">{cam.id}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {cam.location_confirmed ? cam.location : "Location unconfirmed"}
                  </div>
                </div>
                <Badge
                  variant={share > 0.35 ? "critical" : share > 0.18 ? "warning" : "info"}
                  className="flex-none"
                >
                  {count}
                </Badge>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
