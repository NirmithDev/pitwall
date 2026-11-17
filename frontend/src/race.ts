export interface Driver {
  number: number;
  code: string;
  firstName: string;
  lastName: string;
  team: string;
  color: string;
}
export interface Lap {
  driver: number;
  lap: number;
  start: number;
  duration: number;
  pitOut: boolean;
}
export interface Stint {
  driver: number;
  number: number;
  compound: string;
  startLap: number;
  endLap: number;
  tyreAge: number;
}
export interface RaceEvent {
  time: number;
  lap: number | null;
  category: string;
  message: string;
  flag: string | null;
}
export interface Race {
  id: string;
  schemaVersion?: number;
  analysis?: {
    id: string;
    version: number;
    importedAt: string;
    source: string;
    pitWarning?: string | null;
    laps: {
      driver: number;
      lap: number;
      sectors: [number | null, number | null, number | null];
      speedTrap: number | null;
    }[];
    pits: {
      driver: number;
      lap: number;
      date: string | null;
      laneDuration: number | null;
      stopDuration: number | null;
    }[];
  };
  locations?: {
    version: number;
    intervalMs: number;
    maxInterpolationGapMs: number;
    description: string;
    traces: {
      driver: number;
      samples: [number, number, number][];
      rawCount: number;
      rejected: number;
      coverage: number;
      gaps: [number, number][];
    }[];
  };
  sessionKey?: number;
  kind?: string;
  countryCode?: string;
  title: string;
  circuit: string;
  country: string;
  year: number;
  date: string;
  totalLaps: number;
  duration: number;
  startTime: string;
  distanceKm: number | null;
  source: {
    name: string;
    url: string;
    importedAt: string;
    mode: string;
    mapNote: string;
  };
  drivers: Driver[];
  laps: Lap[];
  positions: { driver: number; time: number; position: number }[];
  stints: Stint[];
  events: RaceEvent[];
  track: [number, number][];
}
export interface DriverState {
  driver: Driver;
  lap: number;
  progress: number;
  position: number;
  stint: Stint | undefined;
  lastLap: Lap | undefined;
  activeLap: Lap | undefined;
  finished: boolean;
  missing: boolean;
}
export interface Bookmark {
  id: string;
  label: string;
  elapsedSeconds: number;
  createdAt: string;
}

type DriverIndex = {
  laps: Lap[];
  finishes: { end: number; best: Lap }[];
  stints: Stint[];
  positions: Race["positions"];
};
type ReplayIndex = {
  drivers: Map<number, DriverIndex>;
  starts: Map<number, number>;
};
const replayIndices = new WeakMap<Race, ReplayIndex>();
// Replay payloads are immutable. Build once per loaded revision, then binary-search
// the clock while playing or seeking instead of filtering every driver's full feed.
function replayIndex(race: Race): ReplayIndex {
  const cached = replayIndices.get(race);
  if (cached) return cached;
  const drivers = new Map<number, DriverIndex>(),
    starts = new Map<number, number>();
  const get = (number: number) => {
    let index = drivers.get(number);
    if (!index) {
      index = { laps: [], finishes: [], stints: [], positions: [] };
      drivers.set(number, index);
    }
    return index;
  };
  for (const lap of race.laps) {
    get(lap.driver).laps.push(lap);
    starts.set(lap.lap, Math.min(starts.get(lap.lap) ?? Infinity, lap.start));
  }
  for (const stint of race.stints) get(stint.driver).stints.push(stint);
  for (const position of race.positions)
    get(position.driver).positions.push(position);
  for (const index of drivers.values()) {
    index.laps.sort((a, b) => a.start - b.start);
    index.stints.sort((a, b) => a.startLap - b.startLap);
    index.positions.sort((a, b) => a.time - b.time);
    let bestSequence = -1,
      best: Lap;
    index.finishes = index.laps
      .map((lap, sequence) => ({
        end: lap.start + lap.duration,
        lap,
        sequence,
      }))
      .sort((a, b) => a.end - b.end)
      .map((item) => {
        if (item.sequence > bestSequence) {
          bestSequence = item.sequence;
          best = item.lap;
        }
        return { end: item.end, best };
      });
  }
  const index = { drivers, starts };
  replayIndices.set(race, index);
  return index;
}
function latest<T>(
  items: T[],
  value: number,
  key: (item: T) => number,
): T | undefined {
  let low = 0,
    high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (key(items[middle]) <= value) low = middle + 1;
    else high = middle;
  }
  return items[low - 1];
}
export function driverState(
  race: Race,
  driver: Driver,
  elapsed: number,
): DriverState {
  const index = replayIndex(race).drivers.get(driver.number);
  const current = index
    ? latest(index.laps, elapsed, (l) => l.start)
    : undefined;
  const completed = index
    ? latest(index.finishes, elapsed + 0.001, (f) => f.end)?.best
    : undefined;
  const finished = completed?.lap === race.totalLaps;
  const missing =
    !!current && elapsed > current.start + current.duration + 15 && !finished;
  const fraction = current
    ? Math.max(0, Math.min(1, (elapsed - current.start) / current.duration))
    : 0;
  const lap = current?.lap ?? 1;
  const stint = index
    ? latest(index.stints, lap, (s) => s.startLap)
    : undefined;
  const position =
    (index
      ? latest(index.positions, elapsed, (p) => p.time)?.position
      : undefined) ?? 99;
  return {
    driver,
    lap,
    progress: finished ? 0 : fraction,
    position,
    stint,
    lastLap: completed,
    activeLap: current,
    finished,
    missing,
  };
}
export function standingsAt(race: Race, elapsed: number) {
  return race.drivers
    .map((d) => driverState(race, d, elapsed))
    .sort(
      (a, b) =>
        a.position - b.position ||
        b.lap - a.lap ||
        b.progress - a.progress ||
        a.driver.number - b.driver.number,
    );
}
export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((s % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export function formatLap(seconds: number | undefined) {
  if (seconds === undefined) return "—";
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}
export function seekToLap(race: Race, lap: number) {
  return replayIndex(race).starts.get(lap) ?? 0;
}
const trackIndices = new WeakMap<
  [number, number][],
  { closed: [number, number][]; cumulative: number[]; total: number }
>();
export function pointOnTrack(
  track: [number, number][],
  progress: number,
): [number, number] {
  if (track.length === 0) return [400, 260];
  if (track.length === 1) return track[0];
  if (!Number.isFinite(progress)) return track[0];
  let index = trackIndices.get(track);
  if (!index) {
    const closed = [...track, track[0]],
      cumulative = [0];
    for (let i = 1; i < closed.length; i++)
      cumulative.push(
        cumulative[i - 1] +
          Math.hypot(
            closed[i][0] - closed[i - 1][0],
            closed[i][1] - closed[i - 1][1],
          ),
      );
    index = { closed, cumulative, total: cumulative.at(-1)! };
    trackIndices.set(track, index);
  }
  const { closed, cumulative, total } = index;
  if (!total || !Number.isFinite(total)) return track[0];
  const distance = (((progress % 1) + 1) % 1) * total;
  let low = 1,
    high = cumulative.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (cumulative[middle] < distance) low = middle + 1;
    else high = middle;
  }
  const length = cumulative[low] - cumulative[low - 1],
    f = length ? (distance - cumulative[low - 1]) / length : 0;
  return [
    closed[low - 1][0] + (closed[low][0] - closed[low - 1][0]) * f,
    closed[low - 1][1] + (closed[low][1] - closed[low - 1][1]) * f,
  ];
}
export const compoundColor: Record<string, string> = {
  SOFT: "#ff5c63",
  MEDIUM: "#f4cc52",
  HARD: "#e3e7ed",
  INTERMEDIATE: "#5dd390",
  WET: "#6ba8ff",
  UNKNOWN: "#768093",
};
