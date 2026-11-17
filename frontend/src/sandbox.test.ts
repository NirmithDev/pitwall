import { describe, it, expect } from "vitest";
import { newTrack } from "./custom-track";
import {
  advancePreview,
  compileRoute,
  initialGrid,
  parseSandbox,
  pointOnRoute,
  previewPoint,
  sandboxDefaults,
  sandboxGeometry,
  validateSandbox,
} from "./sandbox";
describe("circuit race sandbox", () => {
  it("creates a connected, valid pit lane on the starter circuit and validates setup bounds", () => {
    const track = newTrack(),
      setup = sandboxDefaults(track);
    expect(validateSandbox(track, setup)).toEqual([]);
    expect(parseSandbox(setup)).toEqual(setup);
    expect(() =>
      parseSandbox({ ...setup, drivers: [...setup.drivers, setup.drivers[0]] }),
    ).toThrow();
    expect(() => parseSandbox({ ...setup, entry: setup.exit })).toThrow();
  });
  it("samples open routes without closing the pit lane back to its entrance", () => {
    const route = compileRoute([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(pointOnRoute(route, 0.75)).toEqual([10, 5]);
    expect(pointOnRoute(route, 1)).toEqual([10, 10]);
    expect(
      pointOnRoute(
        compileRoute([
          [2, 2],
          [2, 2],
        ]),
        0.5,
      ),
    ).toEqual([2, 2]);
  });
  it("pauses a car for service, then rejoins the main route at the configured exit", () => {
    const track = newTrack(),
      setup = sandboxDefaults(track),
      geometry = sandboxGeometry(track, setup),
      driver = setup.drivers[0];
    const initial = initialGrid(setup.drivers)[0],
      entryTime = setup.entry * setup.baseLapSeconds;
    const traversal =
      geometry.pit.length /
      ((geometry.main.length / setup.baseLapSeconds) * 0.35);
    const service = advancePreview(
      initial,
      driver,
      setup,
      geometry,
      entryTime + traversal / 2 + 1,
    );
    expect(service.phase).toBe("service");
    expect(service.stopRemaining).toBeCloseTo(1.5);
    const held = advancePreview(service, driver, setup, geometry, 1);
    expect(previewPoint(held, geometry)).toEqual(
      previewPoint(service, geometry),
    );
    const exited = advancePreview(
      initial,
      driver,
      setup,
      geometry,
      entryTime + traversal + driver.serviceSeconds,
    );
    expect(exited.phase).toBe("track");
    expect(exited.visited).toBe(true);
    expect(exited.raceProgress).toBeCloseTo(1 + setup.exit);
    expect(previewPoint(exited, geometry)[0]).toBeCloseTo(geometry.exit[0]);
    expect(previewPoint(exited, geometry)[1]).toBeCloseTo(geometry.exit[1]);
  });
  it("produces the same deterministic state across frame sizes and supports different driver pace", () => {
    const track = newTrack(),
      setup = sandboxDefaults(track),
      geometry = sandboxGeometry(track, setup),
      driver = setup.drivers[0];
    const once = advancePreview(
      initialGrid(setup.drivers)[0],
      driver,
      setup,
      geometry,
      150,
    );
    let stepped = initialGrid(setup.drivers)[0];
    for (let i = 0; i < 1500; i++)
      stepped = advancePreview(stepped, driver, setup, geometry, 0.1);
    expect(stepped.raceProgress).toBeCloseTo(once.raceProgress, 8);
    expect(stepped.phase).toBe(once.phase);
    const other = { ...setup.drivers[1], pitLap: 0, paceOffset: 5 };
    const slow = advancePreview(
      initialGrid([other])[0],
      other,
      setup,
      geometry,
      90,
    );
    expect(slow.raceProgress).toBeCloseTo(90 / 95);
  });
  it("blocks a self-crossing pit lane before simulation", () => {
    const track = newTrack(),
      setup = sandboxDefaults(track);
    expect(
      validateSandbox(track, {
        ...setup,
        pitControls: [
          [100, 100],
          [700, 400],
          [100, 400],
          [700, 100],
        ],
      }).join(),
    ).toMatch(/cross/);
  });
});
