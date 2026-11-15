import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalog, sessionId } from "./import-race.mjs";
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
