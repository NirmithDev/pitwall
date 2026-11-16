import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCatalog,
  sessionId,
  sampleLocations,
} from "./import-race.mjs";
const base = {
  year: 2024,
  session_name: "Race",
  session_key: 100,
  country_name: "Test",
  country_code: "TST",
  circuit_short_name: "Circuit",
  date_start: "2024-01-01T12:00:00Z",
  date_end: "2024-01-01T14:00:00Z",
};
test("location sampling aligns clocks and applies the circuit projection", () => {
  const start = Date.parse("2024-09-01T13:00:00Z");
  const point = (ms, x, y) => ({
    date: new Date(start + ms).toISOString(),
    x,
    y,
  });
  const result = sampleLocations(
    [point(1200, 30, 40), point(100, 10, 20), point(800, 20, 30)],
    { minX: 0, maxY: 100, scale: 2, offsetX: 10, offsetY: 20 },
    start,
    2000,
  );
  assert.deepEqual(result.samples, [
    [100, 30, 180],
    [1200, 70, 140],
  ]);
});
test("invalid and off-frame coordinates are rejected rather than clamped onto the track", () => {
  const start = Date.parse("2024-09-01T13:00:00Z");
  const result = sampleLocations(
    [
      { date: new Date(start).toISOString(), x: 0, y: 0 },
      { date: new Date(start + 1000).toISOString(), x: 9999, y: 20 },
      { date: new Date(start + 2000).toISOString(), x: NaN, y: 20 },
    ],
    { minX: 0, maxY: 100, scale: 1, offsetX: 0, offsetY: 0 },
    start,
    4000,
  );
  assert.equal(result.samples.length, 0);
  assert.equal(result.rejected, 3);
});
test("location coverage excludes long gaps", () => {
  const start = Date.parse("2024-09-01T13:00:00Z");
  const raw = [0, 1000, 6000, 7000].map((ms) => ({
    date: new Date(start + ms).toISOString(),
    x: 10,
    y: 20,
  }));
  const result = sampleLocations(
    raw,
    { minX: 0, maxY: 100, scale: 1, offsetX: 0, offsetY: 0 },
    start,
    10000,
  );
  assert.deepEqual(result.gaps, [[1000, 6000]]);
  assert.equal(result.coverage, 20);
});
test("catalog includes completed races and sprints, excluding cancelled, practice, upcoming, and unsupported years", () => {
  const catalog = normalizeCatalog(
    [
      base,
      { ...base, session_key: 101, session_name: "Sprint" },
      { ...base, session_key: 102, is_cancelled: true },
      { ...base, session_key: 103, session_name: "Practice 1" },
      { ...base, session_key: 104, date_end: "2027-01-01T14:00:00Z" },
      { ...base, session_key: 105, year: 2022 },
    ],
    Date.parse("2026-11-15T12:00:00Z"),
  );
  assert.deepEqual(
    catalog.map((x) => x.sessionKey),
    [100, 101],
  );
});
test("catalog is newest first and preserves the original replay link", () => {
  const catalog = normalizeCatalog(
    [
      base,
      {
        ...base,
        session_key: 9590,
        date_start: "2024-09-01T13:00:00Z",
        date_end: "2024-09-01T15:00:00Z",
      },
    ],
    Date.parse("2026-11-15T12:00:00Z"),
  );
  assert.equal(catalog[0].id, "monza-2024");
  assert.equal(sessionId(11412), "session-11412");
});
