import {readFileSync} from "node:fs";
import {describe,it,expect} from "vitest";
import {circuitFromReplay} from "./replay-circuit";
import {validateTrack} from "./custom-track";
import {sandboxDefaults,validateSandbox} from "./sandbox";
describe("existing replay circuits as fictional race venues",()=>{
  for(const filename of ["monza-2024.json","session-11412.json"]){
    it(`prepares ${filename} without mutating recorded data and finds a valid connected pit lane`,()=>{
      const replay=JSON.parse(readFileSync(new URL(`../../data/${filename}`,import.meta.url),"utf8"));
      const before=JSON.stringify(replay.track);
      const track=circuitFromReplay(replay.track,`${replay.circuit} ${replay.year} · sandbox`);
      expect(validateTrack(track)).toEqual([]);
      expect(track.points.length).toBeGreaterThanOrEqual(6);expect(track.points.length).toBeLessThanOrEqual(120);
      expect(track.name).toContain(replay.circuit);expect(track.id).not.toBe(replay.id);
      expect(JSON.stringify(replay.track)).toBe(before);
      const setup=sandboxDefaults(track);
      expect(validateSandbox(track,setup)).toEqual([]);
    });
  }
  it("rejects unavailable, nonfinite and self-crossing outlines",()=>{
    expect(()=>circuitFromReplay([],"Missing")).toThrow(/outline/);
    expect(()=>circuitFromReplay(Array.from({length:6},()=>[NaN,50]),"Invalid")).toThrow(/finite/);
    expect(()=>circuitFromReplay([[0,0],[100,100],[0,100],[100,0],[120,0],[120,-20]],"Crossed")).toThrow(/valid sandbox/);
  });
});
