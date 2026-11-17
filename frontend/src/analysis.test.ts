import { describe, it, expect } from "vitest";
import {
  lapAnalysis,
  bestSectors,
  paceSummary,
  stintTrend,
  analysisCsv,
} from "./analysis";
import type { Race } from "./race";
const race = {
  laps: Array.from({ length: 10 }, (_, i) => ({
    driver: 16,
    lap: i + 1,
    start: i * 90,
    duration: i === 7 ? 150 : 90 + i * 0.1,
    pitOut: i === 4,
  })),
  stints: [
    {
      driver: 16,
      number: 1,
      startLap: 1,
      endLap: 4,
      compound: "MEDIUM",
      tyreAge: 0,
    },
    {
      driver: 16,
      number: 2,
      startLap: 5,
      endLap: 10,
      compound: "HARD",
      tyreAge: 1,
    },
  ],
  analysis: {
    laps: [
      { driver: 16, lap: 2, sectors: [25, 30, 35.1], speedTrap: 330 },
      { driver: 16, lap: 3, sectors: [null, 28, 35.2], speedTrap: null },
      { driver: 16, lap: 6, sectors: [1, 2, 3], speedTrap: 320 },
    ],
  },
} as Race;
describe("race analysis", () => {
  it("honors the replay cutoff, excludes pit/opening/outlier laps and never rolls across a stint change", () => {
    const rows = lapAnalysis(race, 16, 550);
    expect(rows.map((r) => r.lap.lap)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.find((r) => r.lap.lap === 4)!.exclusions).toContain(
      "Pit in lap",
    );
    expect(rows.find((r) => r.lap.lap === 6)!.rolling).toBe(90.5);
    expect(
      lapAnalysis(race, 16).find((r) => r.lap.lap === 8)!.exclusions,
    ).toContain("Timing outlier");
  });
  it("keeps missing sectors empty and excludes inconsistent sector sums from best-sector aggregation", () => {
    const rows = lapAnalysis(race, 16);
    expect(rows.find((r) => r.lap.lap === 3)!.sectors[0]).toBeNull();
    expect(rows.find((r) => r.lap.lap === 6)!.sectorMismatch).toBe(true);
    expect(bestSectors(rows)).toEqual([25, 28, 35.1]);
    expect(paceSummary(rows).fullSectors).toBe(1);
  });
  it("reports the observed within-stint slope without mixing stints", () => {
    const trend = stintTrend(lapAnalysis(race, 16), 2)!;
    expect(trend.count).toBe(4);
    expect(trend.slope).toBeCloseTo(0.1);
    expect(stintTrend(lapAnalysis(race, 16), 1)).toBeNull();
  });
  it("exports nulls as empty cells and escapes formula-like provider strings", () => {
    const csv = analysisCsv(lapAnalysis(race, 16), "=BAD()");
    expect(csv).toContain('"\'=BAD()"');
    expect(csv).toContain('""');
  });
});
