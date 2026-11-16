import { describe, it, expect } from "vitest";
import {
  newTrack,
  validateTrack,
  parseTrack,
  rebaseStart,
} from "./custom-track";
describe("custom circuit validation", () => {
  it("accepts the starter circuit and whitelists exported fields", () => {
    const track = newTrack();
    expect(validateTrack(track)).toEqual([]);
    expect(parseTrack({ ...track, untrusted: "discard" })).toEqual(track);
  });
  it("rejects crossing, duplicate, out-of-bounds and degenerate geometry", () => {
    const t = newTrack();
    expect(
      validateTrack({
        ...t,
        points: [
          [50, 50],
          [700, 450],
          [700, 50],
          [50, 450],
          [100, 250],
          [70, 200],
        ],
      }).join(),
    ).toMatch(/crosses/);
    expect(
      validateTrack({ ...t, points: [...t.points, t.points[0]] }).join(),
    ).toMatch(/Separate/);
    expect(
      validateTrack({ ...t, points: [[NaN, 0], ...t.points.slice(1)] }).join(),
    ).toMatch(/margin/);
    expect(
      validateTrack({
        ...t,
        points: [
          [30, 30],
          [40, 30],
          [50, 30],
          [60, 30],
          [70, 30],
          [80, 30],
        ],
      }).join(),
    ).toMatch(/area/);
  });
  it("rejects invalid sector order and malformed imports", () => {
    expect(validateTrack({ ...newTrack(), sectorEnds: [6, 3] }).join()).toMatch(
      /order/,
    );
    for (const raw of [
      null,
      {},
      { ...newTrack(), version: 2 },
      { ...newTrack(), points: [[1, "2"]] },
    ])
      expect(() => parseTrack(raw)).toThrow();
  });
  it("rotates start/finish while preserving circuit direction and valid sectors", () => {
    const t = newTrack(),
      rotated = rebaseStart(t, 3);
    expect(rotated.points[0]).toEqual(t.points[3]);
    expect(rotated.points.at(-1)).toEqual(t.points[2]);
    expect(validateTrack(rotated)).toEqual([]);
  });
});
