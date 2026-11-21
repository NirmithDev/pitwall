import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { advanceRace, initialGrid, parseSandbox, pendingPit, raceOrder, sandboxGeometry } from "./sandbox";
import { parseTrack } from "./custom-track";

describe("shared authoritative/browser model contract", () => {
  it("agrees on rounded-route pit movement, service, rejoin and exact finite results", () => {
    const fixture = JSON.parse(readFileSync(new URL("../../data/testing/room-model.json", import.meta.url), "utf8"));
    const track = parseTrack(fixture.track), setup = parseSandbox(fixture.setup);
    const geometry = sandboxGeometry(track, setup);
    let session = {states: initialGrid(setup.drivers), elapsed: 0};
    for (const sample of fixture.samples) {
      session = advanceRace(session, setup, geometry, sample.seconds);
      expect(session.elapsed).toBeCloseTo(sample.elapsed, 7);
      session.states.forEach((s, i) => {
        const expected = sample.states[i];
        expect(s.raceProgress).toBeCloseTo(expected.raceProgress, 7);
        expect(s.pitProgress).toBeCloseTo(expected.pitProgress, 7);
        expect(s.stopRemaining).toBeCloseTo(expected.stopRemaining, 7);
        expect(s.phase).toBe(expected.phase);
        expect(s.stops).toBe(expected.stops);
        expect(s.finishedInPit).toBe(expected.finishedInPit);
        if (expected.finishTime === null) expect(s.finishTime).toBeNull();
        else expect(s.finishTime).toBeCloseTo(expected.finishTime, 7);
        expect(pendingPit(s, setup.drivers[i], setup)).toEqual(expected.pitTarget);
      });
      expect(raceOrder(session.states, setup).map(s => s.id)).toEqual(sample.order);
    }
  });
});
