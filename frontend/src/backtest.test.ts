import { describe, it, expect } from "vitest";
import { paceBacktest, findBacktestWindow } from "./backtest";
import type { Race } from "./race";
const race = {
  totalLaps: 25,
  stints: [{ driver: 16, startLap: 1, endLap: 25, number: 1 }],
  laps: Array.from({ length: 25 }, (_, i) => ({
    driver: 16,
    lap: i + 1,
    start: i * 90,
    duration: 90 + i * 0.1,
    pitOut: false,
  })),
} as Race;
describe("pace forecast backtesting", () => {
  it("fits the trend on training laps only and measures a known held-out sequence", () => {
    const result = paceBacktest(race, 16, 10, 5);
    expect(result.reason).toBeNull();
    expect(result.training.every((l) => l.lap <= 10)).toBe(true);
    expect(result.trend!.mae).toBeCloseTo(0, 8);
    expect(result.flat!.mae).toBeGreaterThan(0);
  });
  it("cannot learn from changed held-out outcomes", () => {
    const changed = {
      ...race,
      laps: race.laps.map((l) =>
        l.lap > 10 ? { ...l, duration: l.duration + 5 } : l,
      ),
    };
    const a = paceBacktest(race, 16, 10, 5),
      b = paceBacktest(changed, 16, 10, 5);
    expect(b.rows.map((r) => r.trend)).toEqual(a.rows.map((r) => r.trend));
    expect(b.trend!.mae).toBeCloseTo(5);
  });
  it("refuses missing timing and pit-crossing windows, and finds an eligible window", () => {
    expect(
      paceBacktest(
        { ...race, laps: race.laps.filter((l) => l.lap !== 12) },
        16,
        10,
        5,
      ).reason,
    ).toMatch(/missing/);
    const withStop = {
      ...race,
      laps: race.laps.map((l) => (l.lap === 13 ? { ...l, pitOut: true } : l)),
    };
    expect(paceBacktest(withStop, 16, 10, 5).reason).toMatch(/pit/);
    expect(findBacktestWindow(race, 16, 5)).toBe(6);
    expect(paceBacktest(race, 16, 25, 5).reason).toMatch(/valid/);
  });
});
