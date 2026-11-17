// Manual microbenchmark, not a CI timing assertion or a browser FPS claim.
import { readFile, mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = fileURLToPath(new URL("../", import.meta.url));
const baseline = spawnSync(
  "git",
  [
    "-c",
    `safe.directory=${root.replace(/[\\/]$/, "")}`,
    "-C",
    root,
    "show",
    "v1.2.0:frontend/src/race.ts",
  ],
  { encoding: "utf8", windowsHide: true },
);
if (baseline.status !== 0)
  throw new Error("The local v1.2.0 tag is required for this comparison.");
const temporary = await mkdtemp(path.join(tmpdir(), "pitwall-benchmark-"));
try {
  const oldFile = path.join(temporary, "baseline.mts");
  await writeFile(oldFile, baseline.stdout);
  const old = await import(pathToFileURL(oldFile).href),
    current = await import(new URL("../frontend/src/race.ts", import.meta.url));
  const race = JSON.parse(
    await readFile(new URL("../data/monza-2024.json", import.meta.url), "utf8"),
  );
  const frames = 1000,
    times = Array.from(
      { length: frames },
      (_, i) => (i * 73.137) % race.duration,
    );
  for (const t of times) {
    assert.deepEqual(current.standingsAt(race, t), old.standingsAt(race, t));
  }
  for (let i = 0; i < 1000; i++) {
    const progress = i / 987 - 0.1,
      a = old.pointOnTrack(race.track, progress),
      b = current.pointOnTrack(race.track, progress);
    assert.ok(
      Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8,
      "Track interpolation changed.",
    );
  }
  const measure = (engine) => {
    const start = performance.now();
    let checksum = 0;
    for (const t of times)
      for (const state of engine.standingsAt(race, t))
        checksum += state.lap + state.position;
    return { milliseconds: performance.now() - start, checksum };
  };
  const runs = Array.from({ length: 3 }, () => ({
    before: measure(old),
    after: measure(current),
  }));
  for (const run of runs) assert.equal(run.before.checksum, run.after.checksum);
  const middle = (values) => values.sort((a, b) => a - b)[1],
    before = middle(runs.map((r) => r.before.milliseconds)),
    after = middle(runs.map((r) => r.after.milliseconds));
  console.log(
    JSON.stringify(
      {
        benchmark: "standings lookups only; not browser FPS",
        baseline: "v1.2.0",
        session: race.id,
        frames,
        drivers: race.drivers.length,
        laps: race.laps.length,
        positionMessages: race.positions.length,
        matchedFrames: frames,
        matchedTrackSamples: 1000,
        medianBeforeMs: Number(before.toFixed(2)),
        medianAfterMs: Number(after.toFixed(2)),
        speedup: Number((before / after).toFixed(2)),
        node: process.version,
      },
      null,
      2,
    ),
  );
} finally {
  const cleanupTarget = await realpath(temporary),
    temporaryRoot = await realpath(tmpdir());
  if (
    path.dirname(cleanupTarget) !== temporaryRoot ||
    !path.basename(cleanupTarget).startsWith("pitwall-benchmark-")
  )
    throw new Error(
      "Refusing cleanup outside the benchmark's temporary directory.",
    );
  await rm(cleanupTarget, { recursive: true, force: true });
}
