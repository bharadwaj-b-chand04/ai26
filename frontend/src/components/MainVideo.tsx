import { useState } from "react"
import { streamUrl, type Camera } from "@/lib/api"

function VideoFeed({ camera, startAt, anchorAt }: { camera: Camera | undefined; startAt?: number; anchorAt?: number }) {
  const [retry, setRetry] = useState(0)
  const [failed, setFailed] = useState(false)

  if (!camera) return null
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      <img
        key={`${camera.id}-${retry}-${startAt ?? "live"}-${anchorAt ?? "clock"}`}
        src={streamUrl(camera.id, startAt, retry, anchorAt)}
        alt={camera.id}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
        onLoad={() => setFailed(false)}
      />
      {(failed || !camera.source_available || camera.health.status === "error" || camera.health.status === "stopped") && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 text-center text-xs text-red-200"><span>{camera.health.error || "Inference stream unavailable."}</span><button type="button" className="rounded border border-red-300/40 px-2 py-1 text-[10px] hover:border-red-200" onClick={() => { setFailed(false); setRetry((value) => value + 1) }}>Retry stream</button></div>}
      <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/75 px-2.5 py-1 text-xs font-sans font-medium text-zinc-200 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" /> RECORDED INPUT · SHARED INFERENCE
        </span>
        <span className="rounded-md border border-white/10 bg-black/75 px-2.5 py-1 text-xs font-sans font-medium text-zinc-300 backdrop-blur-sm">
          {camera.kind === "vehicle" ? "YOLOv8 + object tracking" : "Plate detection + Fast-ALPR OCR"}
        </span>
      </div>
      <div className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/80 px-3 py-2 backdrop-blur-sm">
        <div className="font-sans text-sm font-semibold tracking-tight text-white">{camera.id}</div>
        <div className="font-sans text-xs text-zinc-400">
          {camera.location_confirmed ? camera.location : "Location unconfirmed"}
        </div>
      </div>
    </div>
  )
}

export function MainVideo(props: {camera: Camera | undefined; startAt?: number; anchorAt?: number}) {
  return <VideoFeed key={`${props.camera?.id}-${props.startAt}-${props.anchorAt}`} {...props} />
}
