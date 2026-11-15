import { describe, expect, it } from "vitest";
import type { Race, DriverState } from "./race";
import { markerPosition, recordedPosition } from "./locations";
const race = {
  track: [
    [0, 0],
    [100, 0],
  ],
  locations: {
    version: 1,
    intervalMs: 1000,
    maxInterpolationGapMs: 2500,
    description: "test",
    traces: [
      {
        driver: 16,
        samples: [
          [0, 100, 200],
          [1000, 200, 300],
          [2000, 300, 400],
          [7000, 400, 450],
        ],
        rawCount: 4,
        rejected: 0,
        coverage: 0,
        gaps: [[2000, 7000]],
      },
    ],
  },
} as Race;
describe("recorded location playback", () => {
  it("returns recorded coordinates at exact sample times", () => {
    expect(recordedPosition(race, 16, 1)).toEqual({
      point: [200, 300],
      status: "recorded",
    });
  });
  it("interpolates only between nearby recorded samples", () => {
    expect(recordedPosition(race, 16, 0.5)).toEqual({
      point: [150, 250],
      status: "smoothed",
    });
  });
  it("does not draw a path across a long dropout", () => {
    expect(recordedPosition(race, 16, 4)).toEqual({
      point: null,
      status: "gap",
    });
  });
  it("does not extrapolate before or after coverage", () => {
    expect(recordedPosition(race, 16, -1).point).toBeNull();
    expect(recordedPosition(race, 16, 8).point).toBeNull();
  });
  it("resumes at the next actual sample after a gap", () => {
    expect(recordedPosition(race, 16, 7)).toEqual({
      point: [400, 450],
      status: "recorded",
    });
  });
  it("reports a missing driver without substituting estimated coordinates", () => {
    expect(recordedPosition(race, 99, 1)).toEqual({
      point: null,
      status: "unavailable",
    });
  });
  it("seeking backward uses the correct sample rather than cached forward state", () => {
    recordedPosition(race, 16, 7);
    expect(recordedPosition(race, 16, 0.5).point).toEqual([150, 250]);
  });
  it("keeps lap estimates explicit and independent from recorded data", () => {
    const state = { driver: { number: 16 }, progress: 0.25 } as DriverState;
    expect(markerPosition(race, state, 4, "lap")).toEqual({
      point: [50, 0],
      status: "estimated",
    });
    expect(markerPosition(race, state, 4, "recorded").point).toBeNull();
  });
});
