// Shared CLI/worker for historical OpenF1 ingestion. No API keys or npm packages.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let locationCache = false;
export const sessionId = (key) =>
  Number(key) === 9590 ? "monza-2024" : `session-${key}`;
async function get(endpoint, query = {}) {
  const url = new URL(`https://api.openf1.org/v1/${endpoint}`);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, String(value));
  const cacheFile =
    locationCache && endpoint === "location"
      ? new URL(
          `../.cache/provider/${createHash("sha256").update(url.href).digest("hex")}.json`,
          import.meta.url,
        )
      : null;
  if (cacheFile) {
    try {
      const cached = JSON.parse(await readFile(cacheFile, "utf8"));
      if (Array.isArray(cached)) return cached;
    } catch {
      /* Fetch when no complete raw cache is available. */
    }
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (response.ok) {
      const data = await response.json();
      await sleep(2300);
      if (!Array.isArray(data))
        throw new Error(`${endpoint}: unexpected response`);
      if (cacheFile) {
        await mkdir(new URL("./", cacheFile), { recursive: true });
        await writeFile(cacheFile, JSON.stringify(data));
      }
      return data;
    }
    if (response.status !== 429 && response.status < 500)
      throw new Error(`${endpoint}: HTTP ${response.status}`);
    const delay = Number(response.headers.get("retry-after"));
    await sleep(
      Math.min(
        60000,
        Math.max(
          5000 * (attempt + 1),
          Number.isFinite(delay) ? delay * 1000 : 0,
        ),
      ),
    );
  }
  throw new Error(
    `Provider unavailable while loading ${endpoint}. Try again later.`,
  );
}
export function normalizeCatalog(sessions, now = Date.now()) {
  return sessions
    .filter(
      (s) =>
        s.year >= 2023 &&
        ["Race", "Sprint"].includes(s.session_name) &&
        !s.is_cancelled &&
        Date.parse(s.date_end) < now,
    )
    .sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start))
    .map((s) => ({
      id: sessionId(s.session_key),
      sessionKey: s.session_key,
      title: `${s.country_name} ${s.session_name === "Sprint" ? "Sprint" : "Grand Prix"}`,
      circuit: s.circuit_short_name,
      country: s.country_name,
      countryCode: s.country_code,
      year: s.year,
      date: s.date_start.slice(0, 10),
      kind: s.session_name,
    }));
}
export async function fetchCatalog() {
  const sessions = normalizeCatalog(await get("sessions"));
  if (!sessions.length)
    throw new Error(
      "Provider returned no historical races; keeping the existing catalog.",
    );
  return { refreshedAt: new Date().toISOString(), sessions };
}
export function sampleLocations(
  raw,
  projection,
  startMs,
  durationMs,
  intervalMs = 1000,
) {
  const samples = [];
  let previousBucket = -Infinity,
    rejected = 0;
  const ordered = raw
    .map((p) => ({ ...p, time: Date.parse(p.date) - startMs }))
    .filter((p) => Number.isFinite(p.time))
    .sort((a, b) => a.time - b.time);
  for (const point of ordered) {
    if (point.time < -2500 || point.time > durationMs + 2500) continue;
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      (point.x === 0 && point.y === 0)
    ) {
      rejected++;
      continue;
    }
    const x =
      (point.x - projection.minX) * projection.scale + projection.offsetX;
    const y =
      (projection.maxY - point.y) * projection.scale + projection.offsetY;
    if (x < 0 || x > 800 || y < 0 || y > 520) {
      rejected++;
      continue;
    }
    const bucket = Math.floor(point.time / intervalMs);
    if (bucket === previousBucket) continue;
    samples.push([
      Math.round(point.time),
      Math.round(x * 10) / 10,
      Math.round(y * 10) / 10,
    ]);
    previousBucket = bucket;
  }
  let coveredMs = 0;
  const gaps = [];
  for (let i = 1; i < samples.length; i++) {
    const from = samples[i - 1][0],
      to = samples[i][0];
    if (to - from <= 2500)
      coveredMs += Math.max(0, Math.min(durationMs, to) - Math.max(0, from));
    else gaps.push([Math.max(0, from), Math.min(durationMs, to)]);
  }
  return {
    samples,
    rawCount: raw.length,
    rejected,
    coverage: Math.round((coveredMs / durationMs) * 1000) / 10,
    gaps,
  };
}
export async function importRace(
  sessionKey,
  { includeLocations = false } = {},
) {
  if (!Number.isSafeInteger(sessionKey) || sessionKey <= 0)
    throw new Error("Invalid session key");
  const query = { session_key: sessionKey };
  const [session] = await get("sessions", query);
  if (
    !session ||
    !["Race", "Sprint"].includes(session.session_name) ||
    session.is_cancelled ||
    Date.parse(session.date_end) > Date.now()
  )
    throw new Error(
      "Only completed historical Grand Prix and Sprint sessions can be loaded.",
    );
  const rawDrivers = await get("drivers", query);
  const rawLaps = await get("laps", query);
  const valid = rawLaps.filter(
    (l) =>
      l.date_start && Number.isFinite(l.lap_duration) && l.lap_duration > 0,
  );
  if (!valid.length || !rawDrivers.length)
    throw new Error("No usable lap timing is available for this session yet.");
  const firstLaps = valid.filter((l) => l.lap_number === 1);
  const startMs = firstLaps.length
    ? Math.min(...firstLaps.map((l) => Date.parse(l.date_start)))
    : Date.parse(session.date_start);
  const relative = (date) => Math.round(Date.parse(date) - startMs) / 1000;
  const laps = valid
    .map((l) => ({
      driver: l.driver_number,
      lap: l.lap_number,
      start: relative(l.date_start),
      duration: l.lap_duration,
      pitOut: l.is_pit_out_lap === true,
    }))
    .sort((a, b) => a.start - b.start);
  const totalLaps = Math.max(...rawLaps.map((l) => Number(l.lap_number) || 0));
  const duration = Math.max(...laps.map((l) => l.start + l.duration));
  const positionsRaw = await get("position", query),
    stintsRaw = await get("stints", query),
    controlRaw = await get("race_control", query);
  let track = [],
    projection = null;
  const probes = valid
    .filter((l) => l.lap_number >= 3 && !l.is_pit_out_lap)
    .filter(
      (l, i, a) =>
        a.findIndex((x) => x.driver_number === l.driver_number) === i,
    )
    .slice(0, 3);
  for (const probe of probes) {
    const locations = await get("location", {
      ...query,
      driver_number: probe.driver_number,
      "date>": probe.date_start,
      "date<": new Date(
        Date.parse(probe.date_start) + probe.lap_duration * 1000,
      ).toISOString(),
    });
    const coords = locations
      .filter(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          (p.x !== 0 || p.y !== 0),
      )
      .filter((_, i) => i % 3 === 0)
      .map((p) => [p.x, p.y]);
    if (coords.length < 20) continue;
    const xs = coords.map((p) => p[0]),
      ys = coords.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    if (maxX - minX < 1 || maxY - minY < 1) continue;
    const scale = Math.min(660 / (maxX - minX), 420 / (maxY - minY));
    projection = {
      minX,
      maxY,
      scale,
      offsetX: (800 - (maxX - minX) * scale) / 2,
      offsetY: (520 - (maxY - minY) * scale) / 2,
    };
    track = coords.map(([x, y]) => [
      Math.round((x - minX) * scale + (800 - (maxX - minX) * scale) / 2),
      Math.round((maxY - y) * scale + (520 - (maxY - minY) * scale) / 2),
    ]);
    break;
  }
  const previous = new Map();
  const positions = positionsRaw
    .filter((p) => p.date && relative(p.date) <= duration && p.position > 0)
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
  const stints = stintsRaw
    .filter((s) => s.lap_start > 0)
    .map((s) => ({
      driver: s.driver_number,
      number: s.stint_number,
      compound: s.compound ?? "UNKNOWN",
      startLap: s.lap_start,
      endLap: s.lap_end ?? totalLaps,
      tyreAge: s.tyre_age_at_start ?? 0,
    }))
    .sort((a, b) => a.startLap - b.startLap);
  const events = controlRaw
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
      message: e.message ?? "",
      flag: e.flag ?? null,
    }))
    .sort((a, b) => a.time - b.time);
  const meta = normalizeCatalog([session])[0];
  let locations;
  if (includeLocations) {
    if (!projection)
      throw new Error(
        "Cannot align recorded locations without a valid circuit projection.",
      );
    const traces = [];
    for (const driver of rawDrivers) {
      if (!process.argv.includes("--worker"))
        console.error(
          `Recorded locations: ${driver.name_acronym ?? driver.driver_number}`,
        );
      const raw = await get("location", {
        ...query,
        driver_number: driver.driver_number,
        "date>": new Date(startMs - 2500).toISOString(),
        "date<": new Date(startMs + duration * 1000 + 2500).toISOString(),
      });
      traces.push({
        driver: driver.driver_number,
        ...sampleLocations(
          raw.filter((p) => p.driver_number === driver.driver_number),
          projection,
          startMs,
          duration * 1000,
        ),
      });
    }
    if (!traces.some((t) => t.samples.length > 1))
      throw new Error("No usable recorded locations were returned.");
    locations = {
      version: 1,
      intervalMs: 1000,
      maxInterpolationGapMs: 2500,
      description:
        "Approximate provider coordinates, sampled to at most one point per second; smoothed only between nearby recorded samples.",
      traces,
    };
  }
  return {
    ...meta,
    schemaVersion: includeLocations ? 2 : 1,
    totalLaps,
    duration,
    startTime: new Date(startMs).toISOString(),
    distanceKm: sessionKey === 9590 ? 5.793 : null,
    source: {
      name: "OpenF1",
      url: "https://openf1.org/",
      importedAt: new Date().toISOString(),
      mode: "historical",
      mapNote: locations
        ? "Approximate recorded positions. Smoothing between samples only; gaps over 2.5 seconds are hidden."
        : track.length
          ? "Circuit outline from one recorded lap. Car movement interpolated from lap timing; not GPS playback."
          : "Circuit coordinates unavailable for this session; timing remains available.",
    },
    drivers: rawDrivers.map((d) => ({
      number: d.driver_number,
      code: d.name_acronym ?? String(d.driver_number),
      firstName: d.first_name ?? "",
      lastName: d.last_name ?? d.full_name ?? String(d.driver_number),
      team: d.team_name ?? "Unknown",
      color: /^[0-9a-f]{6}$/i.test(d.team_colour)
        ? "#" + d.team_colour
        : "#8b99ac",
    })),
    laps,
    positions,
    stints,
    events,
    track,
    ...(locations ? { locations } : {}),
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2),
      worker = args.includes("--worker"),
      catalog = args.includes("--catalog"),
      index = args.indexOf("--session");
    locationCache = args.includes("--locations") && !worker;
    const data = catalog
      ? await fetchCatalog()
      : await importRace(index >= 0 ? Number(args[index + 1]) : 9590, {
          includeLocations: args.includes("--locations"),
        });
    if (worker) process.stdout.write(JSON.stringify(data));
    else {
      const folder = new URL("../data/", import.meta.url);
      await mkdir(folder, { recursive: true });
      await writeFile(
        new URL(catalog ? "catalog.json" : `${data.id}.json`, folder),
        JSON.stringify(data),
      );
      console.log(
        catalog
          ? `Catalog saved: ${data.sessions.length} completed sessions. Latest: ${data.sessions[0].circuit} ${data.sessions[0].date}`
          : `Saved ${data.id}: ${data.drivers.length} drivers, ${data.laps.length} timed laps.`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
