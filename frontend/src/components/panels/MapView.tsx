import type { Camera } from "@/lib/api"
import { OsmMap } from "@/components/OsmMap"
import { Badge } from "@/components/ui/badge"

export function MapView({
  cameras,
  focused,
  onFocus,
}: {
  cameras: Camera[]
  focused: string
  onFocus: (id: string) => void
}) {
  const points = cameras.map((cam) => ({
    id: cam.id,
    lat: cam.lat,
    lon: cam.lon,
    label: cam.id,
    detail: cam.location_confirmed ? cam.location : "Location unconfirmed",
    active: cam.id === focused,
  }))

  return (
    <div className="relative h-full w-full overflow-hidden">
      <OsmMap points={points} onPointClick={onFocus} className="h-full w-full" />
      <Badge variant="outline" className="absolute right-3 top-3 bg-background/85">Camera metadata / honest locations</Badge>
      <div className="absolute bottom-2 left-2 flex items-center gap-3 rounded bg-background/80 px-2 py-1 text-[9px] text-muted-foreground backdrop-blur-sm">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> camera node
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff5c72]" /> focused
        </span>
      </div>
    </div>
  )
}
