import { recordedPosition } from "./locations";
import type { Race } from "./race";
export function sectorReference(
  race: Race,
  driver: number,
  completedThrough: number,
) {
  if (!race.analysis || !race.locations) return null;
  const measured = new Map(
    race.analysis.laps
      .filter((l) => l.driver === driver)
      .map((l) => [l.lap, l.sectors]),
  );
  const candidates = race.laps
    .filter(
      (l) =>
        l.driver === driver &&
        l.lap >= 3 &&
        !l.pitOut &&
        l.start + l.duration <= completedThrough,
    )
    .sort((a, b) => a.lap - b.lap);
  for (const lap of candidates) {
    const sectors = measured.get(lap.lap);
    if (
      !sectors ||
      !sectors.every(
        (s): s is number => s !== null && Number.isFinite(s) && s > 0,
      )
    )
      continue;
    if (
      Math.abs(
        sectors.reduce<number>((n, s) => n + (s ?? 0), 0) - lap.duration,
      ) > Math.max(0.5, lap.duration * 0.01)
    )
      continue;
    const time1 = lap.start + sectors[0]!,
      time2 = time1 + sectors[1]!;
    const s1 = recordedPosition(race, driver, time1).point,
      s2 = recordedPosition(race, driver, time2).point;
    if (s1 && s2)
      return {
        lap: lap.lap,
        markers: [
          { sector: 1, point: s1, time: time1 },
          { sector: 2, point: s2, time: time2 },
        ],
      };
  }
  return null;
}
