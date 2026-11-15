import { describe, expect, it } from "vitest";
import {
  driverState,
  formatClock,
  formatLap,
  pointOnTrack,
  seekToLap,
} from "./race";
import type { Race } from "./race";
const driver = {
  number: 16,
  code: "LEC",
  firstName: "Charles",
  lastName: "Leclerc",
  team: "Ferrari",
  color: "#f00",
};
const race = {
  duration: 200,
  totalLaps: 2,
  drivers: [driver],
  laps: [
    { driver: 16, lap: 1, start: 0, duration: 90, pitOut: false },
    { driver: 16, lap: 2, start: 90, duration: 100, pitOut: false },
  ],
  positions: [
    { driver: 16, time: 0, position: 3 },
    { driver: 16, time: 80, position: 1 },
  ],
  stints: [
    {
      driver: 16,
      number: 1,
      compound: "MEDIUM",
      startLap: 1,
      endLap: 1,
      tyreAge: 2,
    },
    {
      driver: 16,
      number: 2,
      compound: "HARD",
      startLap: 2,
      endLap: 2,
      tyreAge: 0,
    },
  ],
} as Race;
describe("replay timing", () => {
  it("uses recorded position messages rather than sorting uniform map animation", () => {
    const state = driverState(race, driver, 85);
    expect(state.position).toBe(1);
    expect(state.progress).toBeCloseTo(85 / 90);
  });
  it("changes lap and tyre at the recorded lap boundary", () => {
    const state = driverState(race, driver, 90);
    expect(state.lap).toBe(2);
    expect(state.progress).toBe(0);
    expect(state.stint?.compound).toBe("HARD");
    expect(state.lastLap?.duration).toBe(90);
  });
  it("stops a finished driver at the finish line", () => {
    const state = driverState(race, driver, 195);
    expect(state.finished).toBe(true);
    expect(state.progress).toBe(0);
  });
  it("holds missing timing without inventing subsequent laps", () => {
    const incomplete = { ...race, totalLaps: 53 };
    expect(driverState(incomplete, driver, 220).missing).toBe(true);
    expect(driverState(incomplete, driver, 220).lap).toBe(2);
  });
  it("seeks to the earliest recorded start of a lap", () => {
    expect(seekToLap(race, 2)).toBe(90);
  });
});
describe("track interpolation", () => {
  it("interpolates by distance instead of number of GPS samples", () => {
    const p = pointOnTrack(
      [
        [0, 0],
        [90, 0],
        [100, 0],
      ],
      0.25,
    );
    expect(p[0]).toBeCloseTo(50);
    expect(p[1]).toBe(0);
  });
  it("closes the lap and wraps safely", () => {
    expect(
      pointOnTrack(
        [
          [0, 0],
          [100, 0],
        ],
        1,
      ),
    ).toEqual([0, 0]);
  });
  it("formats times without losing leading zeroes", () => {
    expect(formatClock(3661)).toBe("01:01:01");
    expect(formatLap(85.3)).toBe("1:25.300");
    expect(formatLap(undefined)).toBe("—");
  });
});
