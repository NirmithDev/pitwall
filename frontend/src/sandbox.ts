import type { CustomTrack, Point } from "./custom-track";
import { roundedTrack } from "./rounded-track";
export interface Route {
  points: Point[];
  cumulative: number[];
  length: number;
}
export function compileRoute(points: Point[], closed = false): Route {
  const route = closed && points.length ? [...points, points[0]] : [...points],
    cumulative = [0];
  for (let i = 1; i < route.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(
          route[i][0] - route[i - 1][0],
          route[i][1] - route[i - 1][1],
        ),
    );
  return { points: route, cumulative, length: cumulative.at(-1) ?? 0 };
}
export function pointOnRoute(route: Route, fraction: number): Point {
  if (!route.points.length) return [400, 260];
  if (!route.length) return route.points[0];
  const distance = Math.max(0, Math.min(1, fraction)) * route.length;
  let lo = 1,
    hi = route.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (route.cumulative[mid] < distance) lo = mid + 1;
    else hi = mid;
  }
  const a = route.points[lo - 1],
    b = route.points[lo],
    span = route.cumulative[lo] - route.cumulative[lo - 1];
  const t = span ? (distance - route.cumulative[lo - 1]) / span : 0;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
export interface SandboxDriver {
  id: string;
  name: string;
  color: string;
  paceOffset: number;
  pitLap: number;
  serviceSeconds: number;
}
export interface SandboxSetup {
  version: 1;
  baseLapSeconds: number;
  entry: number;
  exit: number;
  pitControls: Point[];
  drivers: SandboxDriver[];
}
const colors = [
  "#ff665d",
  "#6d9fff",
  "#f2c75e",
  "#64d2b6",
  "#bd8bff",
  "#f095cf",
];
export function newSandboxDriver(index: number): SandboxDriver {
  return {
    id: crypto.randomUUID(),
    name: `Driver ${index + 1}`,
    color: colors[index % colors.length],
    paceOffset: index === 1 ? 2 : index === 2 ? -1 : 0,
    pitLap: index === 0 ? 1 : 0,
    serviceSeconds: 2.5,
  };
}
export const sandboxKey = (trackId: string) =>
  `pitwall.sandbox.v1.${encodeURIComponent(trackId)}`;
export function sandboxDefaults(track: CustomTrack): SandboxSetup {
  const main = compileRoute(
    roundedTrack(track.points, track.cornerRadius).route,
    true,
  );
  const entry = 0.92,
    exit = 0.08,
    a = pointOnRoute(main, entry),
    b = pointOnRoute(main, exit);
  const center = track.points.reduce(
    (p, v) =>
      [
        p[0] + v[0] / track.points.length,
        p[1] + v[1] / track.points.length,
      ] as Point,
    [0, 0] as Point,
  );
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    length = Math.hypot(mid[0] - center[0], mid[1] - center[1]) || 1;
  const offset = (p: Point): Point => [
    Math.round(
      Math.max(20, Math.min(780, p[0] + ((mid[0] - center[0]) / length) * 70)),
    ),
    Math.round(
      Math.max(20, Math.min(500, p[1] + ((mid[1] - center[1]) / length) * 70)),
    ),
  ];
  return {
    version: 1,
    baseLapSeconds: 90,
    entry,
    exit,
    pitControls: [offset(a), offset(b)],
    drivers: Array.from({ length: 3 }, (_, i) => newSandboxDriver(i)),
  };
}
export function parseSandbox(raw: unknown): SandboxSetup {
  if (!raw || typeof raw !== "object")
    throw new Error("Invalid sandbox settings.");
  const r = raw as SandboxSetup;
  const range = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  if (
    r.version !== 1 ||
    !range(r.baseLapSeconds, 30, 300) ||
    !range(r.entry, 0, 0.99) ||
    !range(r.exit, 0, 0.99) ||
    Math.abs(r.entry - r.exit) < 0.01 ||
    !Array.isArray(r.pitControls) ||
    r.pitControls.length < 1 ||
    r.pitControls.length > 12 ||
    r.pitControls.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        !range(p[0], 20, 780) ||
        !range(p[1], 20, 500),
    )
  )
    throw new Error(
      "Use valid pit entry/exit points, 1–12 pit handles and a 30–300 second base lap.",
    );
  if (!Array.isArray(r.drivers) || r.drivers.length < 1 || r.drivers.length > 6)
    throw new Error("Use between one and six drivers.");
  const ids = new Set<string>();
  for (const d of r.drivers) {
    if (
      !d ||
      typeof d.id !== "string" ||
      !d.id ||
      d.id.length > 80 ||
      ids.has(d.id) ||
      typeof d.name !== "string" ||
      !d.name.trim() ||
      d.name.length > 24 ||
      typeof d.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(d.color) ||
      !range(d.paceOffset, -10, 10) ||
      !Number.isInteger(d.pitLap) ||
      !range(d.pitLap, 0, 10) ||
      !range(d.serviceSeconds, 0, 15)
    )
      throw new Error(
        "Driver settings are invalid. Use unique names/IDs, bounded pace, pit lap and service time.",
      );
    ids.add(d.id);
  }
  return {
    version: 1,
    baseLapSeconds: r.baseLapSeconds,
    entry: r.entry,
    exit: r.exit,
    pitControls: r.pitControls.map((p) => [...p]),
    drivers: r.drivers.map((d) => ({
      id: d.id,
      name: d.name.trim(),
      color: d.color,
      paceOffset: d.paceOffset,
      pitLap: d.pitLap,
      serviceSeconds: d.serviceSeconds,
    })),
  };
}
export function readSandbox(track: CustomTrack): SandboxSetup {
  try {
    return parseSandbox(
      JSON.parse(localStorage.getItem(sandboxKey(track.id)) ?? "null"),
    );
  } catch {
    return sandboxDefaults(track);
  }
}
function smoothOpen(points: Point[], radius = 24): Point[] {
  if (points.length < 3) return points;
  const route: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      v = points[i],
      b = points[i + 1],
      incoming = Math.hypot(a[0] - v[0], a[1] - v[1]),
      outgoing = Math.hypot(b[0] - v[0], b[1] - v[1]);
    const trim = Math.min(radius, incoming * 0.4, outgoing * 0.4),
      entry: Point = [
        v[0] + (a[0] - v[0]) * (incoming ? trim / incoming : 0),
        v[1] + (a[1] - v[1]) * (incoming ? trim / incoming : 0),
      ],
      exit: Point = [
        v[0] + (b[0] - v[0]) * (outgoing ? trim / outgoing : 0),
        v[1] + (b[1] - v[1]) * (outgoing ? trim / outgoing : 0),
      ];
    route.push(entry);
    for (let j = 1; j <= 12; j++) {
      const t = j / 12;
      route.push([
        (1 - t) ** 2 * entry[0] + 2 * (1 - t) * t * v[0] + t * t * exit[0],
        (1 - t) ** 2 * entry[1] + 2 * (1 - t) * t * v[1] + t * t * exit[1],
      ]);
    }
  }
  route.push(points.at(-1)!);
  return route;
}
export function sandboxGeometry(track: CustomTrack, setup: SandboxSetup) {
  const rounded = roundedTrack(track.points, track.cornerRadius),
    main = compileRoute(rounded.route, true);
  const entry = pointOnRoute(main, setup.entry),
    exit = pointOnRoute(main, setup.exit);
  const pit = compileRoute(smoothOpen([entry, ...setup.pitControls, exit]));
  return { main, pit, entry, exit, path: rounded.path };
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const crosses = (a: Point, b: Point, c: Point, d: Point) =>
  cross(a, b, c) * cross(a, b, d) < -1e-6 &&
  cross(c, d, a) * cross(c, d, b) < -1e-6;
export function validateSandbox(
  track: CustomTrack,
  setup: SandboxSetup,
): string[] {
  try {
    parseSandbox(setup);
  } catch (e) {
    return [(e as Error).message];
  }
  const { main, pit } = sandboxGeometry(track, setup),
    errors = [];
  if (pit.length < 20)
    errors.push("The pit-lane route is too short. Separate its handles.");
  let self = false,
    intersection = false;
  for (let i = 1; i < pit.points.length; i++) {
    for (let j = i + 2; j < pit.points.length; j++)
      if (
        crosses(
          pit.points[i - 1],
          pit.points[i],
          pit.points[j - 1],
          pit.points[j],
        )
      )
        self = true;
    for (let j = 1; j < main.points.length; j++)
      if (
        crosses(
          pit.points[i - 1],
          pit.points[i],
          main.points[j - 1],
          main.points[j],
        )
      )
        intersection = true;
  }
  if (self)
    errors.push("The pit lane crosses itself. Move its orange handles.");
  if (intersection)
    errors.push(
      "The pit lane crosses the circuit away from its joins. Move its orange handles or change entry/exit.",
    );
  return errors;
}
export interface PreviewState {
  id: string;
  raceProgress: number;
  phase: "track" | "pit" | "service";
  pitProgress: number;
  stopRemaining: number;
  serviced: boolean;
  visited: boolean;
}
export function initialGrid(drivers: SandboxDriver[]): PreviewState[] {
  return drivers.map((d, i) => ({
    id: d.id,
    raceProgress: -i * 0.006,
    phase: "track",
    pitProgress: 0,
    stopRemaining: 0,
    serviced: false,
    visited: false,
  }));
}
export function advancePreview(
  state: PreviewState,
  driver: SandboxDriver,
  setup: SandboxSetup,
  geometry: ReturnType<typeof sandboxGeometry>,
  seconds: number,
): PreviewState {
  const next = { ...state };
  let remaining = Math.max(0, seconds);
  const lapSeconds = setup.baseLapSeconds + driver.paceOffset;
  for (let guard = 0; remaining > 1e-9 && guard < 12; guard++) {
    if (next.phase === "track") {
      const target =
        !next.visited && driver.pitLap > 0
          ? driver.pitLap - 1 + setup.entry
          : Infinity;
      const until = (target - next.raceProgress) * lapSeconds;
      if (until >= -1e-8 && until <= remaining) {
        next.raceProgress = target;
        remaining -= Math.max(0, until);
        next.phase = "pit";
        next.pitProgress = 0;
      } else {
        next.raceProgress += remaining / lapSeconds;
        remaining = 0;
      }
    } else if (next.phase === "service") {
      const used = Math.min(remaining, next.stopRemaining);
      remaining -= used;
      next.stopRemaining -= used;
      if (next.stopRemaining <= 1e-9) next.phase = "pit";
    } else {
      const speed =
          ((geometry.main.length / lapSeconds) * 0.35) /
          Math.max(1, geometry.pit.length),
        target = next.serviced ? 1 : 0.5;
      const until = (target - next.pitProgress) / speed;
      if (until > remaining + 1e-8) {
        next.pitProgress += remaining * speed;
        remaining = 0;
      } else {
        next.pitProgress = target;
        remaining = Math.max(0, remaining - Math.max(0, until));
        if (!next.serviced) {
          next.serviced = true;
          next.phase = "service";
          next.stopRemaining = driver.serviceSeconds;
        } else {
          next.phase = "track";
          next.visited = true;
          next.raceProgress =
            driver.pitLap -
            1 +
            setup.entry +
            ((setup.exit - setup.entry + 1) % 1);
        }
      }
    }
  }
  return next;
}
export function previewPoint(
  state: PreviewState,
  geometry: ReturnType<typeof sandboxGeometry>,
): Point {
  return state.phase === "track"
    ? pointOnRoute(geometry.main, ((state.raceProgress % 1) + 1) % 1)
    : pointOnRoute(geometry.pit, state.pitProgress);
}
