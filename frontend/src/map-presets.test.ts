import { describe, it, expect } from "vitest";
import { normalizePresets, presetsKey, upsertPreset } from "./map-presets";
import { normalizeLayout } from "./map-layout";
const layout = normalizeLayout(null, [16, 4]);
describe("named map layouts", () => {
  it("replaces a matching name without consuming another slot or losing its id", () => {
    const a = upsertPreset([], "Ferrari", layout);
    const b = upsertPreset(a, " ferrari ", { ...layout, visible: [16] });
    expect(b).toHaveLength(1);
    expect(b[0].id).toBe(a[0].id);
    expect(b[0].layout.visible).toEqual([16]);
  });
  it("limits names and count while still allowing replacement at capacity", () => {
    expect(() => upsertPreset([], "  ", layout)).toThrow();
    const full = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: String(i),
      layout,
    }));
    expect(() => upsertPreset(full, "extra", layout)).toThrow(/Ten/);
    expect(upsertPreset(full, "0", layout)).toHaveLength(10);
  });
  it("filters corrupt entries and drivers, and isolates races", () => {
    const raw = [
      null,
      { id: "a", name: "one", layout: { ...layout, visible: [999, 16] } },
      { id: "a", name: "duplicate", layout },
    ];
    expect(normalizePresets(raw, [16])[0].layout.visible).toEqual([16]);
    expect(normalizePresets(raw, [16])).toHaveLength(1);
    expect(presetsKey("monza-2024")).not.toBe(presetsKey("session-11412"));
  });
});
