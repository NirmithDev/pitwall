import { pointOnTrack } from "./race";
import type { DriverState, Race } from "./race";
export type PositionSource = "recorded" | "lap";
export interface MarkerPosition {
  point: [number, number] | null;
  status: "recorded" | "smoothed" | "gap" | "unavailable" | "estimated";
}
type Trace = NonNullable<Race["locations"]>["traces"][number];
const indices = new WeakMap<Race, Map<number, Trace>>();
function traceFor(race: Race, driver: number) {
  let index = indices.get(race);
  if (!index) {
    index = new Map(race.locations?.traces.map((t) => [t.driver, t]) ?? []);
    indices.set(race, index);
  }
  return index.get(driver);
}
export function recordedPosition(
  race: Race,
  driver: number,
  seconds: number,
): MarkerPosition {
  const samples = traceFor(race, driver)?.samples;
  if (!samples?.length) return { point: null, status: "unavailable" };
  const time = seconds * 1000;
  let low = 0,
    high = samples.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (samples[middle][0] < time) low = middle + 1;
    else high = middle;
  }
  const next = samples[low],
    previous = samples[low - 1];
  if (next && Math.abs(next[0] - time) < 0.5)
    return { point: [next[1], next[2]], status: "recorded" };
  if (previous && Math.abs(previous[0] - time) < 0.5)
    return { point: [previous[1], previous[2]], status: "recorded" };
  if (!previous || !next) return { point: null, status: "gap" };
  const duration = next[0] - previous[0];
  if (
    duration <= 0 ||
    duration > (race.locations?.maxInterpolationGapMs ?? 2500)
  )
    return { point: null, status: "gap" };
  const fraction = (time - previous[0]) / duration;
  return {
    point: [
      previous[1] + (next[1] - previous[1]) * fraction,
      previous[2] + (next[2] - previous[2]) * fraction,
    ],
    status: "smoothed",
  };
}
export function markerPosition(
  race: Race,
  state: DriverState,
  seconds: number,
  source: PositionSource,
): MarkerPosition {
  if (source === "recorded")
    return recordedPosition(race, state.driver.number, seconds);
  return {
    point: race.track.length ? pointOnTrack(race.track, state.progress) : null,
    status: "estimated",
  };
}
