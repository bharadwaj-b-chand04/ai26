import { usePolling } from "@/hooks/usePolling"
import { useState } from "react"
import { getStats, type Camera, type Stats } from "@/lib/api"
import { OsmMap } from "@/components/OsmMap"

export function CongestionPage({ cameras }: { cameras: Camera[] }) {
  const [stats,setStats]=useState<Stats|null>(null)
  const [error,setError]=useState<string|null>(null)
  usePolling(async signal => {
    try {
      const s = await getStats(signal)
      if (!signal.aborted) { setStats(s); setError(null) }
    } catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : "Activity unavailable") }
  }, 3000)
  const total=stats?.vehicle_passages || 1
  const ranked=cameras.map(c=>({camera:c,count:stats?.per_camera_passages[c.id] ?? 0})).sort((a,b)=>b.count-a.count)
  return <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
    <div><h1 className="text-lg font-semibold">Sampled traffic activity</h1><p className="mt-2 text-sm text-muted-foreground">Camera-local track passages over five minutes. Relative activity does not establish congestion, physical speed, or a historical baseline. Missing feeds remain unobserved.</p></div>
    {error && <p role="alert" className="text-red-200">{error}</p>}
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_280px]">
      <div className="min-h-80 overflow-hidden rounded border border-border"><OsmMap points={ranked.map(({camera:c,count})=>({id:c.id,lat:c.lat,lon:c.lon,label:c.id,detail:c.source_available?`${count} sampled passages; ${c.location_confirmed?c.location:"location unconfirmed"}`:"Source missing: traffic unknown",size:5+count/total*24,color:c.source_available?"#38d1c2":"#84949d"}))} className="h-full w-full" /></div>
      <div><h2 className="font-semibold">Observed passages</h2>{ranked.map(({camera:c,count})=><div className="flex justify-between border-b border-border py-3 text-sm" key={c.id}><div>{c.id}<p className="text-xs text-muted-foreground">{c.source_available?c.health.status:"source missing"}</p></div><span>{c.source_available?count:"unknown"}</span></div>)}</div>
    </div>
  </div>
}
