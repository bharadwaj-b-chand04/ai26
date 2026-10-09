import { useEffect, useState } from "react"
import { getAlerts, getCameras, getRules, reviewAlert, saveRules, type Alert, type Camera, type RuleConfig } from "@/lib/api"
import { DEMO_ALERTS } from "@/lib/demo"

const button="rounded border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
const field="min-w-0 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base"

function Rules() {
  const [rules,setRules]=useState<RuleConfig|null>(null)
  const [cameras,setCameras]=useState<Camera[]>([])
  const [watch,setWatch]=useState("")
  const [restricted,setRestricted]=useState<string[]>([])
  const [message,setMessage]=useState("")
  const [busy,setBusy]=useState(false)
  const [camera,setCamera]=useState("CAM-01")
  const [zone,setZone]=useState<[number,number,number,number]>([0,0,1,1])
  const [seconds,setSeconds]=useState(30)
  useEffect(()=>{
    let alive=true
    Promise.all([getRules(),getCameras()]).then(([r,c])=>{if(alive){setRules(r);setCameras(c);setWatch(Object.entries(r.watchlist).map(([plate,reason])=>`${plate} | ${reason}`).join("\n"));setRestricted(r.restricted_cameras)}}).catch(e=>alive&&setMessage(e.message))
    return()=>{alive=false}
  },[])
  async function save() {
    if(!rules||busy)return
    setBusy(true)
    try{
      const watchlist:Record<string,string>={}
      for(const line of watch.split("\n").filter(l=>l.trim())){
        const [plate,...reason]=line.split("|")
        if(!reason.join("|").trim())throw new Error("Each watchlist entry needs a plate and reason, separated by |")
        watchlist[plate.trim().toUpperCase()]=reason.join("|").trim()
      }
      const result=await saveRules({...rules,watchlist,restricted_cameras:restricted})
      setRules(result);setMessage("Rules saved. They apply to subsequent evaluations.")
    }catch(e){setMessage(e instanceof Error?e.message:"Rules could not be saved")}
    finally{setBusy(false)}
  }
  return <details className="rounded border border-zinc-800 p-4"><summary className="cursor-pointer font-semibold">Configure local rules</summary><p className="my-3 text-sm text-zinc-400">Local course configuration. A zone sighting is a review prompt; permit verification and external registry checks are not connected.</p>
    {message && <p className="my-3 text-sm" role="status">{message}</p>}
    {rules && <div className="flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm">Watchlist — one plate | reason per line<textarea className={field} rows={3} value={watch} onChange={e=>setWatch(e.target.value)} /></label><fieldset><legend className="mb-2 text-sm">Zone-sighting cameras</legend><div className="flex flex-wrap gap-4">{cameras.map(c=><label key={c.id} className="flex gap-2 text-sm"><input type="checkbox" checked={restricted.includes(c.id)} onChange={e=>setRestricted(e.target.checked?[...restricted,c.id]:restricted.filter(id=>id!==c.id))} />{c.id}</label>)}</div></fieldset>
    <div><h3 className="font-semibold">Dwell zones</h3><p className="my-2 text-sm text-zinc-400">Configure an image region before enabling dwell rules. Coordinates are fractions of frame width/height from 0 to 1. This detects time inside a zone, not malicious intent.</p>{rules.dwell_zones.map((z,i)=><div className="my-2 flex flex-wrap items-center gap-3 text-sm" key={i}><span>{z.camera_id} · [{z.zone.join(", ")}] · {z.dwell_seconds}s</span><button className={button} onClick={()=>setRules({...rules,dwell_zones:rules.dwell_zones.filter((_,j)=>i!==j)})}>Remove zone</button></div>)}<div className="flex flex-wrap items-end gap-3"><label className="flex flex-col text-sm">Camera<select className={field} value={camera} onChange={e=>setCamera(e.target.value)}>{cameras.map(c=><option key={c.id}>{c.id}</option>)}</select></label>{["Left","Top","Right","Bottom"].map((name,i)=><label className="flex w-24 flex-col text-sm" key={name}>{name}<input className={field} type="number" min="0" max="1" step=".05" value={zone[i]} onChange={e=>setZone(zone.map((v,j)=>i===j?Number(e.target.value):v) as typeof zone)} /></label>)}<label className="flex w-28 flex-col text-sm">Dwell seconds<input className={field} type="number" min="10" max="3600" value={seconds} onChange={e=>setSeconds(Number(e.target.value))} /></label><button className={button} onClick={()=>setRules({...rules,dwell_zones:[...rules.dwell_zones,{camera_id:camera,zone:[...zone],dwell_seconds:seconds,max_gap_seconds:5}]})}>Add zone</button></div></div>
    <button className={`${button} self-start`} disabled={busy} onClick={save}>{busy?"Saving…":"Save local rules"}</button></div>}
  </details>
}

export function AlertsPanel() {
  const [alerts,setAlerts]=useState<Alert[]>([])
  const [demo,setDemo]=useState(false)
  const [reviewer,setReviewer]=useState("")
  const [note,setNote]=useState("")
  const [busy,setBusy]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)
  useEffect(()=>{
    let alive=true,pending=false
    const tick=async()=>{if(pending)return;pending=true;try{const a=await getAlerts();if(alive){setAlerts(a);setError(null)}}catch(e){if(alive)setError(e instanceof Error?e.message:"Alerts failed")}finally{pending=false}}
    tick();const timer=setInterval(tick,3000)
    return()=>{alive=false;clearInterval(timer)}
  },[])
  async function review(alert:Alert,state:string){
    if(!alert.alert_id||busy)return
    if(!reviewer.trim()){setError("Enter your reviewer name before recording a decision");return}
    setBusy(alert.alert_id)
    try{await reviewAlert(alert.alert_id,state,reviewer,note);setAlerts(await getAlerts());setError(null)}
    catch(e){setError(e instanceof Error?e.message:"Review could not be saved")}
    finally{setBusy(null)}
  }
  const shown=demo?DEMO_ALERTS:alerts
  return <div className="h-full overflow-y-auto bg-black p-4 text-white sm:p-6"><div className="mx-auto flex max-w-5xl flex-col gap-4">
    <div><h1 className="text-lg font-semibold">Rule alerts and review</h1><p className="mt-2 text-sm text-zinc-400">Supported plate watchlist, zone sightings, camera-transition review, and configured per-track dwell. Class co-occurrence is not an identity match.</p></div>
    <button className={`${button} self-start`} onClick={()=>setDemo(!demo)}>{demo?"Return to real rule alerts":"Preview synthetic alerts"}</button>
    {demo?<p className="text-sm text-amber-200">Synthetic examples only. Review actions are unavailable for these fixtures.</p>:<><Rules /><div className="flex flex-wrap gap-3"><label className="flex flex-col gap-1 text-sm">Reviewer<input className={field} maxLength={100} value={reviewer} onChange={e=>setReviewer(e.target.value)} /></label><label className="flex flex-1 flex-col gap-1 text-sm">Review note<input className={field} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} /></label></div></>}
    {error && <p role="alert" className="rounded border border-red-400/40 p-3 text-red-200">{error}</p>}
    {!shown.length && <p className="rounded border border-zinc-800 p-6 text-sm text-zinc-400">No configured rule alerts in the last five minutes. This does not establish that every camera is processing or that no event occurred.</p>}
    {shown.map((a,i)=><article key={a.alert_id ?? i} className="rounded border border-zinc-800 p-4"><p className={`text-sm ${a.severity==="critical"?"text-red-200":a.severity==="warning"?"text-amber-200":"text-zinc-400"}`}>{a.severity} · {a.type} · {a.state ?? "synthetic"}</p><h2 className="my-2 font-semibold">{a.summary}</h2><p className="text-sm text-zinc-400">{a.detail}</p><p className="mt-2 text-xs text-zinc-400">{new Date(a.ts*1000).toLocaleString()}</p>{a.review?.map((r,j)=><p key={j} className="mt-2 text-sm">{r.reviewer} · {r.state} · {r.note}</p>)}{a.alert_id && <div className="mt-3 flex flex-wrap gap-2">{["acknowledged","reviewed","dismissed"].map(state=><button key={state} className={button} disabled={!!busy} onClick={()=>review(a,state)}>{busy===a.alert_id?"Saving…":state === "acknowledged"?"Acknowledge":state==="reviewed"?"Mark reviewed":"Dismiss"}</button>)}</div>}</article>)}
  </div></div>
}
