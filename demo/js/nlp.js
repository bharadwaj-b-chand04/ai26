/**
 * Camera-wall NLP query — MOCKED.
 *
 * Scope, deliberately narrow: this box only searches the cameras currently
 * selected in the wall (the "particular cameras" the user picked), and it
 * only recognizes a fixed set of hardcoded attribute queries — color + vehicle
 * type, occasionally + a location word. There is no real vision model behind
 * this; it's a keyword matcher over the mock OBSERVATIONS/VEHICLES tables in
 * data.js, standing in for what a real CLIP-style attribute search would do.
 *
 * Hardcoded queries this box understands (see demo/README.md for the full list):
 *   "find a blue bus", "show me red cars", "any white suv",
 *   "grey truck", "two wheelers" / "bikes", "black auto"
 */

const AI26_CAMERA_NLP = (() => {

  const RULES = [
    { test: /blue.*bus|bus.*blue/i,        color: "blue",   type: "bus" },
    { test: /red.*car|car.*red/i,          color: "red",    type: "car" },
    { test: /white.*suv|suv.*white/i,      color: "white",  type: "suv" },
    { test: /grey.*truck|gray.*truck|truck/i, color: "grey", type: "truck" },
    { test: /two.?wheeler|bike|motorcycle/i, color: null,   type: "two_wheeler" },
    { test: /black.*auto|auto.*black|auto.?rickshaw/i, color: "black", type: "auto" },
  ];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function matchPlatesFor(color, type) {
    return Object.entries(AI26_DATA.VEHICLES)
      .filter(([, v]) => (color ? v.color === color : true) && (type ? v.type === type : true))
      .map(([plate]) => plate);
  }

  /**
   * @param {string} query          raw text typed into the camera-wall search box
   * @param {string[]} cameraIds    only these cameras are searched (the wall's current selection)
   */
  function run(query, cameraIds) {
    const q = (query || "").trim();
    if (!q) {
      return { ok: false, message: "Type a query, or click one of the sample chips below." };
    }
    if (!cameraIds || cameraIds.length === 0) {
      return { ok: false, message: "Select at least one camera in the wall to search — this box only queries the cameras you've selected, not the whole city." };
    }

    const rule = RULES.find(r => r.test.test(q));
    if (!rule) {
      return {
        ok: false,
        message: `No hardcoded handler for "${escapeHtml(q)}". This demo only recognizes: find a blue bus, show me red cars, any white suv, grey truck, two wheelers, black auto.`,
      };
    }

    const plates = matchPlatesFor(rule.color, rule.type);
    const hits = AI26_DATA.observationsForCameras(cameraIds)
      .filter(o => plates.includes(o.plate_norm))
      .map(o => ({
        ...o,
        vehicle: AI26_DATA.VEHICLES[o.plate_norm],
        camera: AI26_DATA.cameraById(o.camera_id),
      }))
      .sort((a, b) => a.ts.localeCompare(b.ts));

    return {
      ok: true,
      query: q,
      attribute: `${rule.color ? rule.color + " " : ""}${rule.type}`.trim(),
      camerasSearched: cameraIds.map(id => AI26_DATA.cameraById(id).name),
      matches: hits,
      message: hits.length
        ? `${hits.length} possible match${hits.length > 1 ? "es" : ""} for "${rule.color ? rule.color + " " : ""}${rule.type}" in the selected cameras. This is an attribute match, not a plate read — confirm visually before acting.`
        : `No sightings of "${rule.color ? rule.color + " " : ""}${rule.type}" in the selected cameras. Try selecting more cameras, or widen the time window (mocked — always "now" in this demo).`,
    };
  }

  const SAMPLE_QUERIES = [
    "find a blue bus",
    "show me red cars",
    "any white suv",
    "grey truck",
    "two wheelers",
    "black auto",
  ];

  return { run, SAMPLE_QUERIES };
})();
