import { describe, it, expect } from "vitest";
import { roundedTrack } from "./rounded-track";
import type { Point } from "./custom-track";
const square: Point[] = [
  [100, 100],
  [700, 100],
  [700, 400],
  [100, 400],
];
describe("rounded circuit geometry", () => {
  it("draws quadratic corners and puts the preview start on the same rounded curve", () => {
    const result = roundedTrack(square, 40);
    expect(result.path).toContain("Q100,100 140,100");
    expect(result.route[0]).toEqual([110, 110]);
    expect(result.anchors[0]).toEqual(result.route[0]);
    expect(result.route.length).toBeGreaterThan(square.length);
  });
  it("supports sharp corners, clamps excessive rounding and handles missing geometry", () => {
    expect(roundedTrack(square, 0).route).toEqual(square);
    expect(roundedTrack([], 40)).toEqual({ path: "", route: [], anchors: [] });
    expect(roundedTrack(square, 999)).toEqual(roundedTrack(square, 80));
  });
  it("keeps curves inside the canvas and finite around short or coincident edges", () => {
    const result = roundedTrack(
      [
        [30, 30],
        [30, 30],
        [50, 40],
        [100, 60],
        [80, 100],
        [30, 80],
      ],
      80,
    );
    expect(result.route.every((p) => p.every(Number.isFinite))).toBe(true);
    expect(
      result.route.every(
        (p) => p[0] >= 30 && p[0] <= 100 && p[1] >= 30 && p[1] <= 100,
      ),
    ).toBe(true);
  });
});
