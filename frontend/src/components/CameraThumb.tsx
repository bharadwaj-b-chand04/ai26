import { useCallback, useEffect, useRef, useState } from "react"
import { cameraPlaybackOffset, videoUrl } from "@/lib/api"

export function CameraThumb({ cameraId, className, onTimeUpdate }: { cameraId: string; className?: string; onTimeUpdate?: (time: number) => void }) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const offsetRef = useRef<number | null>(null)

  const playFromOffset = useCallback((restart = false) => {
    const video = videoRef.current
    if (!video) return
    if (video.duration && Number.isFinite(video.duration) && (restart || offsetRef.current === null)) {
      offsetRef.current = cameraPlaybackOffset(cameraId, video.duration)
      video.currentTime = offsetRef.current
    }
    void video.play().catch(() => undefined)
  }, [cameraId])

  useEffect(() => {
    offsetRef.current = null
    const video = videoRef.current
    if (!video) return
    video.muted = true
    playFromOffset()
  }, [cameraId, playFromOffset])

  if (failed) {
    return <div role="img" aria-label={`${cameraId} feed unavailable`} className="flex h-full items-center justify-center bg-zinc-950 font-sans text-xs text-zinc-500">Feed unavailable</div>
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl(cameraId)}
      aria-label={`${cameraId} continuous camera playback`}
      className={className}
      autoPlay
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={() => playFromOffset()}
      onCanPlay={() => {
        setFailed(false)
        playFromOffset()
      }}
      onEnded={() => {
        offsetRef.current = null
        playFromOffset(true)
      }}
      onTimeUpdate={(event) => onTimeUpdate?.(event.currentTarget.currentTime)}
      onError={() => setFailed(true)}
    />
  )
}
