import { describe, it, expect } from "vitest";
import { newTrack } from "./custom-track";
import {
  advancePreview,
  advanceRace,
  nextPitEntry,
  pendingPit,
  raceOrder,
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
  it("migrates saved v1 setups and rejects invalid race distances", () => {
    const {raceLaps: _, ...legacy} = sandboxDefaults(newTrack());
    expect(parseSandbox(legacy).raceLaps).toBe(10);
    for (const raceLaps of [0, 51, 1.5, null, "10"]) {
      expect(() => parseSandbox({...legacy, raceLaps})).toThrow();
    }
  });
  it("finishes every driver at an exact time, ranks by finish and freezes the completed clock", () => {
    const track = newTrack(), defaults = sandboxDefaults(track);
    const setup = {...defaults, raceLaps: 2, drivers: defaults.drivers.map(d => ({...d, pitLap: 0}))};
    const geometry = sandboxGeometry(track, setup);
    const initial = {states: initialGrid(setup.drivers), elapsed: 0};
    const once = advanceRace(initial, setup, geometry, 1000);
    expect(once.states.every(s => s.phase === "finished")).toBe(true);
    expect(once.states[0].finishTime).toBeCloseTo(180);
    expect(once.states[1].finishTime).toBeCloseTo(2.006 * 92);
    expect(raceOrder(once.states, setup).map(s => s.id)).toEqual([setup.drivers[2].id, setup.drivers[0].id, setup.drivers[1].id]);
    expect(once.elapsed).toBeCloseTo(2.006 * 92);
    expect(advanceRace(once, setup, geometry, 90)).toEqual(once);
    let stepped = initial;
    for (let i = 0; i < 2000; i++) stepped = advanceRace(stepped, setup, geometry, 0.1);
    stepped.states.forEach((s, i) => expect(s.finishTime).toBeCloseTo(once.states[i].finishTime!, 7));
  });
  it("cancels scheduled stops, queues the next eligible entry and permits another visit", () => {
    const track = newTrack(), setup = sandboxDefaults(track), geometry = sandboxGeometry(track, setup), driver = setup.drivers[0];
    const initial = initialGrid(setup.drivers)[0];
    expect(pendingPit(initial, driver, setup)).toBeCloseTo(0.92);
    const cancelled = {...initial, pitTarget: null};
    const passed = advancePreview(cancelled, driver, setup, geometry, 85);
    expect(passed.phase).toBe("track");
    expect(nextPitEntry(passed, setup)).toBeCloseTo(1.92);
    const queued = {...passed, pitTarget: nextPitEntry(passed, setup)};
    const visited = advancePreview(queued, driver, setup, geometry, 150, 85);
    expect(visited.stops).toBe(1);
    expect(visited.raceProgress).toBeGreaterThan(2.08);
    const repeated = advancePreview({...visited, pitTarget: nextPitEntry(visited, setup)}, driver, setup, geometry, 150, 235);
    expect(repeated.stops).toBe(2);
    expect(nextPitEntry({...passed, raceProgress: 9.95}, setup)).toBeNull();
    expect(nextPitEntry({...passed, phase: "service"}, setup)).toBeNull();
  });
  it("finishes on the mapped pit-lane crossing without teleporting or an extra service", () => {
    const track = newTrack(), setup = {...sandboxDefaults(track), raceLaps: 1};
    const geometry = sandboxGeometry(track, setup), driver = setup.drivers[0], initial = initialGrid(setup.drivers)[0];
    const finished = advancePreview(initial, driver, setup, geometry, 500);
    expect(finished.phase).toBe("finished");
    expect(finished.finishedInPit).toBe(true);
    expect(finished.pitProgress).toBeCloseTo(0.5);
    expect(finished.finishTime).toBeCloseTo(setup.entry * 90 + geometry.pit.length / (geometry.main.length / 90 * 0.35) * 0.5);
    expect(previewPoint(finished, geometry)).toEqual(pointOnRoute(geometry.pit, finished.pitProgress));
    expect(finished.stops).toBe(0);
    expect(advancePreview(finished, driver, setup, geometry, 10, 500)).toEqual(finished);
  });
});
