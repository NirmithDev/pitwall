// Historical educational snapshot. No keys, logos, photos, audio, or broadcasts.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const sessionKey = 9590;
const root = new URL("../", import.meta.url);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(endpoint, query = {}) {
  const url = new URL(`https://api.openf1.org/v1/${endpoint}`);
  for (const [k, v] of Object.entries({ session_key: sessionKey, ...query }))
    url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (response.ok) {
      const data = await response.json();
      await sleep(2200);
      return data;
    }
    if (response.status !== 429 && response.status < 500)
      throw new Error(`${endpoint}: HTTP ${response.status}`);
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Could not import ${endpoint}`);
}
console.log("Importing historical Monza 2024 data from OpenF1...");
const [session] = await get("sessions");
const rawDrivers = await get("drivers");
const rawLaps = await get("laps");
const rawPositions = await get("position");
const rawStints = await get("stints");
const rawControl = await get("race_control");
const validLaps = rawLaps.filter(
  (l) => l.date_start && Number.isFinite(l.lap_duration) && l.lap_duration > 0,
);
const startMs = Math.min(
  ...validLaps
    .filter((l) => l.lap_number === 1)
    .map((l) => Date.parse(l.date_start)),
);
const relative = (d) =>
  Math.round(((Date.parse(d) - startMs) / 1000) * 1000) / 1000;
const laps = validLaps
  .map((l) => ({
    driver: l.driver_number,
    lap: l.lap_number,
    start: relative(l.date_start),
    duration: l.lap_duration,
    pitOut: l.is_pit_out_lap === true,
  }))
  .sort((a, b) => a.start - b.start);
const duration = Math.max(...laps.map((l) => l.start + l.duration));
const probe = validLaps.find(
  (l) => l.driver_number === 16 && l.lap_number === 5,
);
const location = await get("location", {
  driver_number: 16,
  "date>": probe.date_start,
  "date<": new Date(
    Date.parse(probe.date_start) + probe.lap_duration * 1000,
  ).toISOString(),
});
const coords = location
  .filter((p) => p.x !== 0 || p.y !== 0)
  .filter((_, i) => i % 3 === 0)
  .map((p) => [p.x, p.y]);
if (coords.length < 20) throw new Error("Insufficient circuit coordinates");
const minX = Math.min(...coords.map((p) => p[0])),
  maxX = Math.max(...coords.map((p) => p[0]));
const minY = Math.min(...coords.map((p) => p[1])),
  maxY = Math.max(...coords.map((p) => p[1]));
const scale = Math.min(660 / (maxX - minX), 420 / (maxY - minY));
const track = coords.map(([x, y]) => [
  Math.round((x - minX) * scale + (800 - (maxX - minX) * scale) / 2),
  Math.round((maxY - y) * scale + (520 - (maxY - minY) * scale) / 2),
]);
const previous = new Map();
const positions = rawPositions
  .filter((p) => p.date && relative(p.date) <= duration)
  .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  .filter((p) => {
    if (previous.get(p.driver_number) === p.position) return false;
    previous.set(p.driver_number, p.position);
    return true;
  })
  .map((p) => ({
    driver: p.driver_number,
    time: Math.max(0, relative(p.date)),
    position: p.position,
  }));
const stints = rawStints.map((s) => ({
  driver: s.driver_number,
  number: s.stint_number,
  compound: s.compound ?? "UNKNOWN",
  startLap: s.lap_start,
  endLap: s.lap_end,
  tyreAge: s.tyre_age_at_start ?? 0,
}));
const events = rawControl
  .filter(
    (e) =>
      e.date &&
      relative(e.date) >= 0 &&
      relative(e.date) <= duration &&
      !/TRACK LIMITS|DELETED|REINSTATED/i.test(e.message ?? ""),
  )
  .map((e) => ({
    time: relative(e.date),
    lap: e.lap_number ?? null,
    category: e.category,
    message: e.message,
    flag: e.flag ?? null,
  }));
const data = {
  id: "monza-2024",
  sessionKey,
  title: "Italian Grand Prix",
  circuit: "Monza",
  country: "Italy",
  date: "2024-09-01",
  year: 2024,
  totalLaps: 53,
  duration,
  startTime: new Date(startMs).toISOString(),
  distanceKm: 5.793,
  source: {
    name: "OpenF1",
    url: "https://openf1.org/",
    importedAt: new Date().toISOString(),
    mode: "historical",
    mapNote:
      "Circuit outline from one recorded lap. Car movement interpolated from lap timing; not GPS playback.",
  },
  drivers: rawDrivers.map((d) => ({
    number: d.driver_number,
    code: d.name_acronym,
    firstName: d.first_name,
    lastName: d.last_name,
    team: d.team_name,
    color: "#" + d.team_colour,
  })),
  laps,
  positions,
  stints,
  events,
  track,
};
const folder = new URL("data/", root);
await mkdir(folder, { recursive: true });
await writeFile(new URL("monza-2024.json", folder), JSON.stringify(data));
console.log(
  JSON.stringify(
    {
      file: fileURLToPath(new URL("monza-2024.json", folder)),
      drivers: data.drivers.length,
      laps: laps.length,
      positionChanges: positions.length,
      trackPoints: track.length,
      duration,
    },
    null,
    2,
  ),
);
