import type { Camera } from "@/lib/api"
import { OsmMap } from "@/components/OsmMap"

export function MapView({
  cameras,
  focused,
  onFocus,
}: {
  cameras: Camera[]
  focused: string
  onFocus: (id: string) => void
}) {
  // A named junction plus coordinates is enough to show a useful map reference,
  // but it does not confirm the camera's exact pole or surveyed position.
  const hasMapReference = (location: string) => location.trim().length > 0 && location !== "Unconfirmed"
  const points = cameras.filter(cam =>
    Number.isFinite(cam.lat) && Number.isFinite(cam.lon) &&
    (cam.location_confirmed || hasMapReference(cam.location))
  ).map((cam) => {
    const approximate = !cam.location_confirmed || cam.location.toLowerCase().includes("junction reference")
    return {
      id: cam.id,
      lat: cam.lat,
      lon: cam.lon,
      label: cam.id,
      detail: approximate
        ? `${cam.location} · approximate reference; exact camera position unverified`
        : `${cam.location} · confirmed`,
      color: approximate ? "#e6b454" : undefined,
      active: cam.id === focused,
    }
  })
  const unlocated = cameras.filter(cam =>
    !Number.isFinite(cam.lat) || !Number.isFinite(cam.lon) ||
    (!cam.location_confirmed && !hasMapReference(cam.location))
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      <OsmMap points={points} onPointClick={onFocus} className="h-full w-full" />
      {(points.some(point => point.color) || unlocated.length > 0) && <div className="absolute left-3 top-3 max-w-[min(34rem,calc(100%-5rem))] rounded border border-border bg-background/95 px-3 py-2 text-xs leading-5 text-foreground shadow-sm">
        {points.some(point => point.color) && <p>Amber markers show approximate junction references; exact camera positions are unverified.</p>}
        {unlocated.length > 0 && <p className="text-muted-foreground">Not plotted: {unlocated.map(cam => cam.id).join(", ")} (no location reference).</p>}
      </div>}
      {points.length === 0 && <div className="absolute left-1/2 top-1/2 max-w-xs -translate-x-1/2 -translate-y-1/2 rounded border border-border bg-background/95 p-4 text-center text-sm text-muted-foreground">No camera map references are configured. Cameras remain available in settings and the wall.</div>}
      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded bg-background/90 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur-sm">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-primary" /> confirmed location
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#e6b454]" /> approximate reference
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#ff5c72]" /> focused
        </span>
      </div>
    </div>
  )
}
