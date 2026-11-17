import { describe, expect, it } from "vitest";
import {
  normalizeCamera,
  normalizeLayout,
  viewBox,
  zoomCamera,
  layoutKey,
} from "./map-layout";
describe("map camera", () => {
  it("keeps the viewport within the circuit bounds", () => {
    expect(normalizeCamera({ zoom: 2, cx: -100, cy: 900 })).toEqual({
      zoom: 2,
      cx: 200,
      cy: 390,
    });
  });
  it("fits the whole circuit at minimum zoom", () => {
    expect(viewBox(normalizeCamera({ zoom: 0, cx: 1, cy: 2 }))).toBe(
      "0 0 800 520",
    );
  });
  it("handles non-finite saved values safely", () => {
    expect(normalizeCamera({ zoom: NaN, cx: Infinity, cy: NaN })).toEqual({
      zoom: 1,
      cx: 400,
      cy: 260,
    });
  });
  it("keeps a zoom anchor at the same relative viewport position", () => {
    const next = zoomCamera({ zoom: 1, cx: 400, cy: 260 }, 2, [300, 200]);
    expect(next).toEqual({ zoom: 2, cx: 350, cy: 230 });
  });
  it("caps maximum zoom", () => {
    expect(zoomCamera({ zoom: 2, cx: 400, cy: 260 }, 99).zoom).toBe(4);
  });
});
describe("saved map layouts", () => {
  it("filters unknown and duplicate driver numbers without inventing visibility", () => {
    expect(
      normalizeLayout({ visible: [16, 16, 999, "4"] }, [16, 4]).visible,
    ).toEqual([16]);
  });
  it("preserves an intentionally empty view", () => {
    expect(normalizeLayout({ visible: [] }, [16, 4]).visible).toEqual([]);
  });
  it("uses defaults for invalid preferences", () => {
    expect(
      normalizeLayout({ labels: "invalid", grid: "false" }, [16, 4]),
    ).toEqual({
      camera: { cx: 400, cy: 260, zoom: 1 },
      visible: [16, 4],
      labels: "focus",
      grid: true,
      sectors: false,
    });
  });
  it("isolates saved preferences by race", () => {
    expect(layoutKey("monza-2024")).not.toBe(layoutKey("session-11412"));
  });
});
