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

export function driverState(
  race: Race,
  driver: Driver,
  elapsed: number,
): DriverState {
  const laps = race.laps.filter((l) => l.driver === driver.number);
  const started = laps.filter((l) => l.start <= elapsed);
  const current = started.at(-1);
  const completed = laps
    .filter((l) => l.start + l.duration <= elapsed + 0.001)
    .at(-1);
  const finished = completed?.lap === race.totalLaps;
  const missing =
    !!current && elapsed > current.start + current.duration + 15 && !finished;
  const fraction = current
    ? Math.max(0, Math.min(1, (elapsed - current.start) / current.duration))
    : 0;
  const lap = current?.lap ?? 1;
  const stint = race.stints
    .filter((s) => s.driver === driver.number && s.startLap <= lap)
    .at(-1);
  const position =
    race.positions
      .filter((p) => p.driver === driver.number && p.time <= elapsed)
      .at(-1)?.position ?? 99;
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
  const starts = race.laps.filter((l) => l.lap === lap).map((l) => l.start);
  return starts.length ? Math.min(...starts) : 0;
}
export function pointOnTrack(
  track: [number, number][],
  progress: number,
): [number, number] {
  if (track.length === 0) return [400, 260];
  if (track.length === 1) return track[0];
  const closed = [...track, track[0]];
  const lengths = closed
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - closed[i][0], p[1] - closed[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let remaining = (((progress % 1) + 1) % 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const f = lengths[i] === 0 ? 0 : remaining / lengths[i];
      return [
        closed[i][0] + (closed[i + 1][0] - closed[i][0]) * f,
        closed[i][1] + (closed[i + 1][1] - closed[i][1]) * f,
      ];
    }
    remaining -= lengths[i];
  }
  return track[0];
}
export const compoundColor: Record<string, string> = {
  SOFT: "#ff5c63",
  MEDIUM: "#f4cc52",
  HARD: "#e3e7ed",
  INTERMEDIATE: "#5dd390",
  WET: "#6ba8ff",
  UNKNOWN: "#768093",
};
