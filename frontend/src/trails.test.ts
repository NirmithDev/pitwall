import { describe, it, expect } from "vitest";
import { recordedTrail } from "./locations";
import type { Race } from "./race";
const race = {
  locations: {
    maxInterpolationGapMs: 2500,
    traces: [
      {
        driver: 16,
        samples: [
          [0, 1, 1],
          [1000, 2, 2],
          [10000, 3, 3],
          [11000, 4, 4],
        ],
      },
    ],
  },
} as Race;
describe("recorded driver trails", () => {
  it("splits paths across missing data instead of drawing a false connection", () => {
    expect(recordedTrail(race, 16, 11, 15)).toBe("M1,1 L2,2 M3,3 L4,4");
  });
  it("clips to replay time and reconstructs a shorter history after seeking backwards", () => {
    expect(recordedTrail(race, 16, 0.5, 15)).toBe("M1,1 L1.5,1.5");
    expect(recordedTrail(race, 16, 11, 1)).toBe("M3,3 L4,4");
  });
  it("returns no trail for unknown drivers or disabled trails", () => {
    expect(recordedTrail(race, 99, 11, 15)).toBe("");
    expect(recordedTrail(race, 16, 11, 0)).toBe("");
  });
});
