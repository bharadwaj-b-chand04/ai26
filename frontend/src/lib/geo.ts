// Real Kochi bbox this deployment's 9 cameras sit within.
export const LAT_MIN = 9.955
export const LAT_MAX = 10.04
export const LON_MIN = 76.266
export const LON_MAX = 76.33

export function project(lat: number, lon: number, w: number, h: number, pad: number) {
  const x = pad + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * (w - pad * 2)
  const y = pad + (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * (h - pad * 2)
  return { x, y }
}

export function congestionColor(share: number) {
  if (share > 0.35) return "#ff5c72" // busiest slice — critical
  if (share > 0.18) return "#ffb545" // elevated
  return "#22d3c8" // baseline
}

// a loose road skeleton suggesting Kochi's NH66 / MG Road / backwater geography — schematic, not survey-accurate
export const SCHEMATIC_ROADS = [
  "M 40 260 L 600 220",
  "M 40 420 L 600 380",
  "M 120 40 L 200 480",
  "M 420 40 L 380 480",
  "M 40 340 C 200 300, 400 300, 600 340",
]
