import { describe, it, expect } from "vitest";
import { calibratePace, defaultStay, projectStrategy } from "./strategy";
import type { Race } from "./race";
describe("strategy model", () => {
  it("uses completed laps up to the branch, excluding first laps, pit in/out and robust outliers", () => {
    const race = {
      laps: Array.from({ length: 12 }, (_, i) => ({
        driver: 16,
        lap: i + 1,
        start: i * 90,
        duration: i === 5 ? 150 : i === 11 ? 30 : 90,
        pitOut: i === 3,
      })),
    } as Race;
    const sample = calibratePace(race, 16, 10)!;
    expect(sample.pace).toBe(90);
    expect(sample.laps).not.toContain(1);
    expect(sample.laps).not.toContain(3);
    expect(sample.laps).not.toContain(4);
    expect(sample.laps).not.toContain(6);
    expect(sample.laps).not.toContain(12);
    expect(calibratePace(race, 16, 3)).toBeNull();
  });
  it("adds pit loss once, resets degradation and applies the assumed fresh-tyre gain after the stop", () => {
    const laps = projectStrategy(90, 4, {
      ...defaultStay,
      degradation: 1 / 2,
      pitLap: 2,
      pitLoss: 20,
      freshTyreGain: 2,
    });
    expect(laps.map((l) => l.lapTime)).toEqual([90, 110.5, 88, 88.5]);
    expect(laps.at(-1)!.total).toBe(377);
    expect(laps.filter((l) => l.pit)).toHaveLength(1);
  });
  it("makes identical assumptions exactly equal and shows when a stop pays back", () => {
    const stay = projectStrategy(90, 20, { ...defaultStay, degradation: 0 });
    const stop = projectStrategy(90, 20, {
      ...defaultStay,
      degradation: 0,
      pitLap: 5,
      pitLoss: 20,
      freshTyreGain: 2,
    });
    expect(stop.at(-1)!.total - stay.at(-1)!.total).toBe(-10);
    expect(projectStrategy(90, 20, defaultStay)).toEqual(
      projectStrategy(90, 20, defaultStay),
    );
  });
  it("rejects out-of-range and non-finite plans rather than inventing results", () => {
    expect(() => projectStrategy(NaN, 20, defaultStay)).toThrow();
    expect(() => projectStrategy(90, 41, defaultStay)).toThrow();
    expect(() =>
      projectStrategy(90, 10, { ...defaultStay, pitLap: 11 }),
    ).toThrow();
    expect(() =>
      projectStrategy(90, 10, { ...defaultStay, paceDelta: Infinity }),
    ).toThrow();
  });
});
