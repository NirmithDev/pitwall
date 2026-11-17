import type { Race, Lap } from "./race";
export const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  return !v.length
    ? null
    : v.length % 2
      ? v[(v.length - 1) / 2]
      : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
export interface AnalysisRow {
  lap: Lap;
  compound: string;
  stint: number;
  tyreAge: number;
  sectors: [number | null, number | null, number | null];
  speedTrap: number | null;
  sectorMismatch: boolean;
  exclusions: string[];
  rolling: number | null;
}
export function lapAnalysis(
  race: Race,
  driver: number,
  cutoff = Infinity,
): AnalysisRow[] {
  const laps = race.laps
    .filter((l) => l.driver === driver)
    .sort((a, b) => a.lap - b.lap);
  const knownOut = new Set(
    laps.filter((l) => l.pitOut && l.start <= cutoff).map((l) => l.lap),
  );
  const measured = new Map(
    race.analysis?.laps
      .filter((l) => l.driver === driver)
      .map((l) => [l.lap, l]) ?? [],
  );
  const rows = laps
    .filter((l) => l.start + l.duration <= cutoff)
    .map((l) => {
      const stint = race.stints
        .filter(
          (s) =>
            s.driver === driver && s.startLap <= l.lap && s.endLap >= l.lap,
        )
        .at(-1);
      const detail = measured.get(l.lap);
      const sectors =
        detail?.sectors ?? ([null, null, null] as [null, null, null]);
      const full = sectors.every((s) => s !== null);
      const sum = sectors.reduce<number>((n, s) => n + (s ?? 0), 0);
      const exclusions = [];
      if (l.lap === 1) exclusions.push("Opening lap");
      if (l.pitOut) exclusions.push("Pit out lap");
      if (knownOut.has(l.lap + 1)) exclusions.push("Pit in lap");
      if (!Number.isFinite(l.duration) || l.duration < 20 || l.duration > 300)
        exclusions.push("Unusable duration");
      return {
        lap: l,
        compound: stint?.compound ?? "UNKNOWN",
        stint: stint?.number ?? 0,
        tyreAge: (stint?.tyreAge ?? 0) + l.lap - (stint?.startLap ?? l.lap),
        sectors,
        speedTrap: detail?.speedTrap ?? null,
        sectorMismatch:
          full && Math.abs(sum - l.duration) > Math.max(0.5, l.duration * 0.01),
        exclusions,
        rolling: null,
      } as AnalysisRow;
    });
  const center = median(
    rows.filter((r) => !r.exclusions.length).map((r) => r.lap.duration),
  );
  for (const r of rows)
    if (
      !r.exclusions.length &&
      center !== null &&
      Math.abs(r.lap.duration - center) > Math.max(3, center * 0.1)
    )
      r.exclusions.push("Timing outlier");
  const history = new Map<number, number[]>();
  for (const r of rows)
    if (!r.exclusions.length) {
      const values = [...(history.get(r.stint) ?? []), r.lap.duration].slice(
        -5,
      );
      history.set(r.stint, values);
      r.rolling = median(values);
    }
  return rows;
}
export function paceSummary(rows: AnalysisRow[]) {
  const clean = rows.filter((r) => !r.exclusions.length),
    times = clean.map((r) => r.lap.duration);
  return {
    count: clean.length,
    excluded: rows.length - clean.length,
    median: median(times),
    best: times.length ? Math.min(...times) : null,
    fullSectors: rows.filter(
      (r) => r.sectors.every((s) => s !== null) && !r.sectorMismatch,
    ).length,
    total: rows.length,
  };
}
export function bestSectors(
  rows: AnalysisRow[],
): [number | null, number | null, number | null] {
  return [0, 1, 2].map((i) => {
    const values = rows
      .filter((r) => !r.exclusions.length && !r.sectorMismatch)
      .map((r) => r.sectors[i])
      .filter((s): s is number => s !== null && Number.isFinite(s) && s > 0);
    return values.length ? Math.min(...values) : null;
  }) as [number | null, number | null, number | null];
}
export function stintTrend(rows: AnalysisRow[], stint: number) {
  const clean = rows.filter((r) => r.stint === stint && !r.exclusions.length);
  if (clean.length < 3) return null;
  const meanX = clean.reduce((n, r) => n + r.tyreAge, 0) / clean.length,
    meanY = clean.reduce((n, r) => n + r.lap.duration, 0) / clean.length;
  const xx = clean.reduce((n, r) => n + (r.tyreAge - meanX) ** 2, 0);
  if (!xx) return null;
  const slope =
    clean.reduce(
      (n, r) => n + (r.tyreAge - meanX) * (r.lap.duration - meanY),
      0,
    ) / xx;
  return {
    slope,
    count: clean.length,
    compound: clean[0].compound,
    start: clean[0].lap.lap,
    end: clean.at(-1)!.lap.lap,
  };
}
export function analysisCsv(rows: AnalysisRow[], code: string): string {
  const escape = (value: unknown) => {
    let s = String(value ?? "");
    if (typeof value !== "number" && /^[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    "driver,lap,duration_seconds,compound,tyre_age,sector_1,sector_2,sector_3,speed_trap_kmh,exclusions",
    ...rows.map((r) =>
      [
        code,
        r.lap.lap,
        r.lap.duration,
        r.compound,
        r.tyreAge,
        ...r.sectors,
        r.speedTrap,
        r.exclusions.join("; "),
      ]
        .map(escape)
        .join(","),
    ),
  ].join("\r\n");
}
