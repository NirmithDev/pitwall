import { describe, it, expect } from "vitest";
import { momentLink, readMoment } from "./replay-link";
import type { Race } from "./race";
const race = {
  duration: 100,
  drivers: [{ number: 16 }, { number: 4 }],
  locations: {
    traces: [
      {
        samples: [
          [0, 1, 1],
          [1, 2, 2],
        ],
      },
    ],
  },
} as Race;
describe("replay moment links", () => {
  it("round trips a paused replay's controls without unrelated query data", () => {
    const moment = {
      elapsed: 12.345,
      driver: 4,
      comparison: 16,
      speed: 25,
      source: "recorded" as const,
    };
    const url = new URL(
      momentLink("https://pitwall.example/?old=1#old", "monza-2024", moment),
    );
    expect(readMoment(url.searchParams, race)).toEqual(moment);
    expect(url.searchParams.get("race")).toBe("monza-2024");
    expect(url.searchParams.has("old")).toBe(false);
    expect(url.hash).toBe("");
  });
  it("clamps time and rejects unknown drivers, speeds and unavailable recorded data", () => {
    expect(
      readMoment(
        new URLSearchParams(
          "t=900&driver=999&compare=16&speed=900&source=recorded",
        ),
        { ...race, locations: undefined },
      ),
    ).toEqual({
      elapsed: 100,
      driver: 16,
      comparison: null,
      speed: 10,
      source: "lap",
    });
    expect(
      readMoment(new URLSearchParams("t=Infinity&compare=none"), race).elapsed,
    ).toBe(0);
    expect(readMoment(new URLSearchParams("t=-10"), race).elapsed).toBe(0);
  });
});
