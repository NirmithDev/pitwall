import type { Race } from "./race";
import type { PositionSource } from "./locations";
export interface ReplayMoment {
  elapsed: number;
  driver: number;
  comparison: number | null;
  speed: number;
  source: PositionSource;
}
const number = (raw: string | null, fallback: number) =>
  raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
    ? Number(raw)
    : fallback;
export function readMoment(params: URLSearchParams, race: Race): ReplayMoment {
  const available = (n: number) => race.drivers.some((d) => d.number === n);
  const defaultDriver = available(16) ? 16 : race.drivers[0].number;
  const driver = number(params.get("driver"), defaultDriver);
  const selected = available(driver) ? driver : defaultDriver;
  const comparison =
    params.get("compare") === "none" ? null : number(params.get("compare"), 4);
  const speed = number(params.get("speed"), 10);
  const recorded = !!race.locations?.traces.some((t) => t.samples.length > 1);
  return {
    elapsed: Math.max(0, Math.min(race.duration, number(params.get("t"), 0))),
    driver: selected,
    comparison:
      comparison !== null && available(comparison) && comparison !== selected
        ? comparison
        : null,
    speed: [1, 5, 10, 25, 50].includes(speed) ? speed : 10,
    source: params.get("source") === "lap" || !recorded ? "lap" : "recorded",
  };
}
export function momentLink(
  base: string,
  raceId: string,
  moment: ReplayMoment,
): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set("race", raceId);
  url.searchParams.set(
    "t",
    (Math.round(moment.elapsed * 1000) / 1000).toString(),
  );
  url.searchParams.set("driver", String(moment.driver));
  url.searchParams.set(
    "compare",
    moment.comparison === null ? "none" : String(moment.comparison),
  );
  url.searchParams.set("speed", String(moment.speed));
  url.searchParams.set("source", moment.source);
  return url.href;
}
