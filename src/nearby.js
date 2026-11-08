import { opportunities } from "./data.js";
import { state } from "./store.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const centers = {
  Miami: [25.7617, -80.1918],
  "Fort Lauderdale": [26.1224, -80.1373],
  Hollywood: [26.0112, -80.1495],
};
let origin = "Fort Lauderdale",
  radius = 50,
  serverResults = null,
  serverError = "";
export function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180,
    dLat = rad(b[0] - a[0]),
    dLon = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function coordinates(o) {
  if (
    Number.isFinite(o.latitude) &&
    Number.isFinite(o.longitude) &&
    o.latitude >= 24.9 &&
    o.latitude <= 26.5 &&
    o.longitude >= -80.9 &&
    o.longitude <= -79.9
  )
    return { point: [o.latitude, o.longitude], approximate: false };
  return centers[o.city] ? { point: centers[o.city], approximate: true } : null;
}
export function nearbyMarkup() {
  const location = centers[origin];
  const list = (serverResults || opportunities)
    .filter(
      (o) =>
        o.location !== "Remote" &&
        (serverResults ||
          !state.student.onboarded ||
          Number(state.student.age) >= o.minAge),
    )
    .map((o) => ({ o, geo: coordinates(o) }))
    .filter((x) => x.geo)
    .map((x) => ({ ...x, distance: distanceKm(location, x.geo.point) }))
    .filter((x) => x.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
  const x = (lon) => 35 + ((lon + 80.9) / 1) * 430,
    y = (lat) => 35 + ((26.5 - lat) / 1.6) * 440;
  return `<section class="page-heading"><div><div class="eyebrow">GOOD THINGS CLOSE TO HOME</div><h1>Find your <em>community.</em></h1><p>Explore Broward and Miami-Dade by distance from a city center.</p></div></section><p class="demo-notice">Demo opportunity map. Distances use city centers unless a coordinator supplies venue coordinates. Markers do not confirm exact venues, availability, or partnerships.</p><div class="nearby-actions"><button class="secondary" id="nearby-server">Load authenticated server events</button><button class="secondary" id="nearby-demo">Show browser demo events</button></div><p role="status" id="nearby-api-status">${esc(serverError || (serverResults ? "Showing authenticated database events with coordinator-provided coordinates." : "Showing browser demo events. Server lookup requires a signed-in account in Integrations."))}</p><div class="nearby-controls"><label>Starting city<select id="nearby-origin" aria-label="Starting city">${Object.keys(
    centers,
  )
    .map((c) => `<option ${c === origin ? "selected" : ""}>${c}</option>`)
    .join(
      "",
    )}</select></label><label>Within<select id="nearby-radius" aria-label="Within">${[10, 25, 50, 100].map((n) => `<option value="${n}" ${radius === n ? "selected" : ""}>${n} km</option>`).join("")}</select></label></div><div class="nearby-layout"><section class="journey-panel"><h2>South Florida · coordinate view</h2><p>This schematic plots coordinates; use the venue link for a street map. Overlapping markers may represent several opportunities in the same city.</p><svg class="nearby-map" viewBox="0 0 500 520" role="img" aria-label="Schematic opportunity locations in Broward and Miami-Dade"><rect width="500" height="520" rx="20" fill="#edf5f8"/><path d="M0 0H385L370 150L388 280L360 410L335 520H0Z" fill="#e8f0df"/><path d="M365 20L350 145L366 280L340 425L310 500" stroke="#fff" stroke-width="8" fill="none"/><text x="25" y="35" fill="#6f7680" font-size="12">BROWARD</text><text x="25" y="365" fill="#6f7680" font-size="12">MIAMI-DADE</text>${Object.entries(
    centers,
  )
    .map(
      ([city, p]) =>
        `<g><circle cx="${x(p[1])}" cy="${y(p[0])}" r="4" fill="#728264"/><text x="${x(p[1]) - 120}" y="${y(p[0]) - 10}" font-size="12" fill="#3b444a">${city}</text></g>`,
    )
    .join(
      "",
    )}${list.map(({ o, geo }) => `<g><title>${esc(o.role)} · ${geo.approximate ? "city center" : "coordinator coordinates"}</title><circle cx="${x(geo.point[1])}" cy="${y(geo.point[0])}" r="10" fill="#7454df" stroke="#fff" stroke-width="3"/></g>`).join("")}</svg></section><section class="journey-panel"><h2>${list.length} nearby possibilities</h2>${list.length ? list.map(({ o, geo, distance }) => `<article class="nearby-record"><span class="demo-label">${serverResults ? "SERVER RECORD" : "DEMO"} · ${geo.approximate ? "CITY CENTER" : "VENUE COORDINATES"}</span><h3>${esc(o.role)}</h3><p>${esc(o.nonprofit)}<br>${esc(o.city)} · about ${distance.toFixed(1)} km from ${esc(origin)} center<br>${esc(o.date)} · Ages ${esc(o.minAge)}+</p><div class="nearby-actions">${serverResults ? `<button class="secondary" data-page="Integrations">Open server workspace</button>` : `<button class="secondary" data-details="${esc(o.id)}">View opportunity</button>`}<a class="secondary" href="https://www.openstreetmap.org/?mlat=${geo.point[0]}&amp;mlon=${geo.point[1]}#map=13/${geo.point[0]}/${geo.point[1]}" target="_blank" rel="noopener noreferrer">Open street map ↗</a></div></article>`).join("") : "<p>No geocoded opportunities within this distance. Try a different city or radius.</p>"}</section></div>`;
}
export function bindNearby(render) {
  document.querySelector("#nearby-demo")?.addEventListener("click", () => {
    serverResults = null;
    serverError = "";
    render();
  });
  document
    .querySelector("#nearby-server")
    ?.addEventListener("click", async (e) => {
      const city = origin,
        km = radius,
        point = centers[city];
      e.currentTarget.disabled = true;
      try {
        const response = await fetch(
          `/api/maps/nearby?lat=${point[0]}&lon=${point[1]}&radius=${km}`,
          { credentials: "same-origin", signal: AbortSignal.timeout(10000) },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Server lookup failed.");
        if (!Array.isArray(result.events))
          throw new Error("The server returned an invalid map result.");
        if (city !== origin || km !== radius) return;
        serverResults = result.events.map((o) => ({
          ...o,
          role: o.title,
          nonprofit: "Published server opportunity",
          latitude: o.lat,
          longitude: o.lon,
        }));
        serverError = "";
        render();
      } catch (error) {
        if (city === origin && km === radius) {
          serverError =
            error.message === "Sign in to continue."
              ? "Sign in through Integrations to load server events."
              : "The map API is unavailable. Your browser demo map is unchanged.";
          render();
        }
      }
    });
  document.querySelector("#nearby-origin")?.addEventListener("change", (e) => {
    origin = e.target.value;
    serverResults = null;
    serverError = "";
    render();
  });
  document.querySelector("#nearby-radius")?.addEventListener("change", (e) => {
    radius = Number(e.target.value);
    serverResults = null;
    serverError = "";
    render();
  });
}
