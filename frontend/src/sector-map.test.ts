import { describe, it, expect } from "vitest";
import { sectorReference } from "./sector-map";
import type { Race } from "./race";
const race = {
  laps: [{ driver: 16, lap: 3, start: 10, duration: 9, pitOut: false }],
  analysis: { laps: [{ driver: 16, lap: 3, sectors: [3, 3, 3] }] },
  locations: {
    maxInterpolationGapMs: 2500,
    traces: [
      {
        driver: 16,
        samples: [
          [12000, 100, 100],
          [14000, 200, 200],
          [16000, 300, 300],
        ],
      },
    ],
  },
} as Race;
describe("measured sector map annotations", () => {
  it("aligns sector-end clocks to recorded coordinates only after the reference lap completes", () => {
    expect(sectorReference(race, 16, 18)).toBeNull();
    const reference = sectorReference(race, 16, 19)!;
    expect(reference.lap).toBe(3);
    expect(reference.markers[0].time).toBe(13);
    expect(reference.markers[0].point).toEqual([150, 150]);
    expect(reference.markers[1].point).toEqual([300, 300]);
  });
  it("does not invent marker positions for missing timing, mismatched sectors or telemetry gaps", () => {
    expect(
      sectorReference({ ...race, analysis: undefined }, 16, 20),
    ).toBeNull();
    expect(
      sectorReference(
        {
          ...race,
          analysis: {
            ...race.analysis!,
            laps: [{ driver: 16, lap: 3, sectors: [1, 1, 1], speedTrap: null }],
          },
        },
        16,
        20,
      ),
    ).toBeNull();
    expect(
      sectorReference(
        {
          ...race,
          locations: {
            ...race.locations!,
            traces: [
              {
                ...race.locations!.traces[0],
                samples: [
                  [12000, 100, 100],
                  [16000, 300, 300],
                ],
              },
            ],
          },
        },
        16,
        20,
      ),
    ).toBeNull();
  });
});
