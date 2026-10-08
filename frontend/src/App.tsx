import { useEffect, useState } from "react"
import { Menu, ShieldCheck } from "lucide-react"
import { getCameras, type Camera } from "@/lib/api"
import { CameraWall } from "@/components/CameraWall"
import { MainVideo } from "@/components/MainVideo"
import { NavDrawer } from "@/components/NavDrawer"
import { MapView } from "@/components/panels/MapView"
import { AlertsPanel } from "@/components/panels/AlertsPanel"
import { AnalyticsPanel } from "@/components/panels/AnalyticsPanel"
import { TimelinePage } from "@/pages/TimelinePage"
import { QueryPage } from "@/pages/QueryPage"
import { CongestionPage } from "@/pages/CongestionPage"
import { IntroSplash } from "@/components/IntroSplash"

export type Page = "cameras" | "map" | "congestion" | "timeline" | "alerts" | "analytics" | "query"

const TITLES: Record<Page, string> = {
  cameras: "Camera Wall",
  map: "Map",
  congestion: "Congestion",
  timeline: "Evidence Timeline",
  alerts: "Alerts",
  analytics: "Analytics",
  query: "Ask the Grid",
}

export default function App() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [focused, setFocused] = useState<string>("CAM-01")
  const [focusedPosition, setFocusedPosition] = useState<number>()
  const [focusedAnchor, setFocusedAnchor] = useState<number>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [page, setPage] = useState<Page>("cameras")
  const [introVisible, setIntroVisible] = useState(true)

  useEffect(() => {
    getCameras().then((c) => {
      setCameras(c)
      if (c.length) setFocused(c[0].id)
    }).catch((error: Error) => setCameraError(error.message))
  }, [])

  const focusedCam = cameras.find((c) => c.id === focused)

  function navigate(p: Page) {
    setPage(p)
    setDrawerOpen(false)
  }

  function focusCamera(id: string, position?: number) {
    setFocused(id)
    setFocusedPosition(position)
    setFocusedAnchor(position === undefined ? undefined : Date.now() / 1000)
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
      {introVisible && <IntroSplash onComplete={() => setIntroVisible(false)} />}
      <header className="flex flex-none items-center justify-between border-b border-zinc-800 bg-black/95 px-4 py-2.5 backdrop-blur-md sm:px-5 font-sans text-white select-none">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="group flex min-w-0 items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-zinc-900"
        >
          <Menu className="h-4 w-4 flex-none text-zinc-400 transition-colors group-hover:text-white" />
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-white/20 bg-white text-black shadow-sm">
            <ShieldCheck className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="truncate text-sm font-bold tracking-[0.2em] text-white font-sans">AI26</span>
          <span className="hidden truncate border-l border-zinc-800 pl-3 text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-sans sm:inline">
            {TITLES[page]} / Kochi
          </span>
        </button>
        <div className="flex flex-none items-center gap-2">
          <span className="hidden md:inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-sans font-medium text-zinc-400">
            Recorded input / live inference
          </span>
          <span className="hidden sm:inline-flex items-center rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-sans font-medium text-zinc-400">
            Mock registry / not VAHAN
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-zinc-900 px-2.5 py-1 text-xs font-sans font-medium text-zinc-200">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> {cameras.length}/9 cams
          </span>
        </div>
      </header>

      <NavDrawer open={drawerOpen} page={page} onNavigate={navigate} onClose={() => setDrawerOpen(false)} />

      <main className="min-h-0 flex-1">
        {cameraError && <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-md border border-red-400/30 bg-red-950/90 px-3 py-2 text-xs text-red-100">Camera API unavailable: {cameraError}</div>}
        {page === "cameras" && (
          <div className="grid h-full grid-rows-[260px_1fr]">
            <div className="min-h-0 border-b border-zinc-800 bg-black">
              <CameraWall cameras={cameras} focused={focused} onFocus={focusCamera} />
            </div>
            <div className="min-h-0">
              <MainVideo camera={focusedCam} startAt={focusedPosition} anchorAt={focusedAnchor} />
            </div>
          </div>
        )}
        {page === "map" && <MapView cameras={cameras} focused={focused} onFocus={focusCamera} />}
        {page === "congestion" && <CongestionPage />}
        {page === "timeline" && <TimelinePage cameras={cameras} />}
        {page === "alerts" && <AlertsPanel />}
        {page === "analytics" && <AnalyticsPanel />}
        {page === "query" && <QueryPage />}
      </main>
    </div>
  )
}
