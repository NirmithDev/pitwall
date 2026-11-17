import { useMemo, useState } from "react";
import Dialog from "./Dialog";
import EnrichmentImport from "./EnrichmentImport";
import {
  analysisCsv,
  bestSectors,
  lapAnalysis,
  median,
  paceSummary,
  stintTrend,
  type AnalysisRow,
} from "./analysis";
import { downloadJson } from "./custom-track";
import type { Driver, Race } from "./race";
const seconds = (n: number | null, digits = 3) =>
  n === null ? "—" : `${n.toFixed(digits)} s`;
function PaceChart({
  series,
  totalLaps,
}: {
  series: { driver: Driver; rows: AnalysisRow[] }[];
  totalLaps: number;
}) {
  const values = series.flatMap((s) => s.rows.map((r) => r.lap.duration));
  if (!values.length)
    return (
      <p>No completed laps in this scope. Try the full race or seek later.</p>
    );
  const min = Math.min(...values) - 1,
    max = Math.max(...values) + 1;
  const maxLap = Math.max(
    2,
    ...series.flatMap((s) => s.rows.map((r) => r.lap.lap)),
  );
  const x = (lap: number) => 60 + ((lap - 1) / Math.max(1, maxLap - 1)) * 620,
    y = (time: number) => 220 - ((time - min) / (max - min)) * 180;
  return (
    <figure className="analysis-figure">
      <svg
        viewBox="0 0 720 265"
        role="img"
        aria-label="Recorded lap times and trailing five-lap medians for the selected drivers"
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line
              x1="60"
              y1={220 - f * 180}
              x2="680"
              y2={220 - f * 180}
              stroke="currentColor"
              opacity=".12"
            />
            <text x="8" y={224 - f * 180} fill="currentColor" fontSize="11">
              {(min + f * (max - min)).toFixed(1)}s
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.driver.number}>
            {[...new Set(s.rows.map((r) => r.stint))].map((stint) => (
              <polyline
                key={stint}
                fill="none"
                stroke={s.driver.color}
                strokeWidth="2.4"
                points={s.rows
                  .filter((r) => r.stint === stint && r.rolling !== null)
                  .map((r) => `${x(r.lap.lap)},${y(r.rolling!)}`)
                  .join(" ")}
              />
            ))}
            {s.rows.map((r) => (
              <circle
                key={r.lap.lap}
                cx={x(r.lap.lap)}
                cy={y(r.lap.duration)}
                r="3.5"
                fill={r.exclusions.length ? "#8692a5" : s.driver.color}
                opacity={r.exclusions.length ? 0.45 : 0.8}
              >
                <title>
                  {s.driver.code} lap {r.lap.lap}: {r.lap.duration.toFixed(3)} s
                  {r.exclusions.length ? ` · ${r.exclusions.join(", ")}` : ""}
                </title>
              </circle>
            ))}
          </g>
        ))}
        <text x="60" y="250" fill="currentColor" fontSize="12">
          LAP 1
        </text>
        <text x="565" y="250" fill="currentColor" fontSize="12">
          LAP {maxLap} / {totalLaps}
        </text>
      </svg>
      <figcaption>
        Dots are recorded lap times; lines are trailing five-usable-lap medians
        within each stint. Grey dots are excluded laps when shown.
      </figcaption>
    </figure>
  );
}
export default function RaceAnalysis({
  race,
  selected,
  comparison,
  elapsed,
  onClose,
  onUpgrade,
  onSeek,
}: {
  race: Race;
  selected: number;
  comparison: number | null;
  elapsed: number;
  onClose: () => void;
  onUpgrade: (race: Race) => void;
  onSeek: (driver: number, seconds: number) => void;
}) {
  const [driver, setDriver] = useState(selected),
    [rival, setRival] = useState(comparison);
  const [scope, setScope] = useState<"full" | "replay">("full"),
    [tab, setTab] = useState<"pace" | "sectors" | "pits">("pace");
  const [includeExcluded, setIncludeExcluded] = useState(false),
    [sectorLap, setSectorLap] = useState(0);
  const focused = race.drivers.find((d) => d.number === driver)!;
  const compared = race.drivers.find((d) => d.number === rival);
  const cutoff = scope === "full" ? Infinity : elapsed;
  const rows = useMemo(
    () => lapAnalysis(race, driver, cutoff),
    [race, driver, cutoff],
  );
  const other = useMemo(
    () => (rival === null ? [] : lapAnalysis(race, rival, cutoff)),
    [race, rival, cutoff],
  );
  const shown = includeExcluded
      ? rows
      : rows.filter((r) => !r.exclusions.length),
    otherShown = includeExcluded
      ? other
      : other.filter((r) => !r.exclusions.length);
  const summary = paceSummary(rows),
    otherSummary = paceSummary(other);
  const selectedLap = shown.some((r) => r.lap.lap === sectorLap)
    ? sectorLap
    : 0;
  const a = selectedLap
    ? rows.find((r) => r.lap.lap === selectedLap)!.sectors
    : bestSectors(rows);
  const b = selectedLap
    ? (other.find((r) => r.lap.lap === selectedLap)?.sectors ?? [
        null,
        null,
        null,
      ])
    : bestSectors(other);
  const sum = (parts: (number | null)[]) =>
    parts.every((s) => s !== null)
      ? parts.reduce<number>((n, s) => n + (s ?? 0), 0)
      : null;
  const pits = (race.analysis?.pits ?? []).filter(
    (p) =>
      [driver, rival].includes(p.driver) &&
      (scope === "full" ||
        ((p.driver === driver ? rows : other).some((r) => r.lap.lap >= p.lap) &&
          (!p.date ||
            Date.parse(p.date) <=
              Date.parse(race.startTime) + elapsed * 1000))),
  );
  function exportCsv() {
    const url = URL.createObjectURL(
      new Blob([analysisCsv(rows, focused.code)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `pitwall-${race.id}-${focused.code}-laps.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Dialog title="Race analysis desk" wide onClose={onClose}>
      <p>
        Compare recorded lap pace and sectors, inspect observed stint trends,
        and separate pit-lane traversal from stationary service time.
      </p>
      <div className="analysis-toolbar">
        <label className="lab-field">
          Driver
          <select
            aria-label="Analysis driver"
            value={driver}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDriver(n);
              if (rival === n) setRival(null);
            }}
          >
            {race.drivers.map((d) => (
              <option key={d.number} value={d.number}>
                {d.code} · {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="lab-field">
          Comparison
          <select
            aria-label="Analysis comparison"
            value={rival ?? ""}
            onChange={(e) =>
              setRival(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">No comparison</option>
            {race.drivers
              .filter((d) => d.number !== driver)
              .map((d) => (
                <option key={d.number} value={d.number}>
                  {d.code}
                </option>
              ))}
          </select>
        </label>
        <label className="lab-field">
          Scope
          <select
            aria-label="Analysis scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option value="full">Full race · retrospective</option>
            <option value="replay">Replay so far · completed laps</option>
          </select>
        </label>
      </div>
      <div className="analysis-source" data-testid="analysis-source">
        {race.analysis ? (
          <>
            <span>
              Measured sectors cached · {race.analysis.laps.length} records ·{" "}
              {race.analysis.source}
              {" · "}
              <time dateTime={race.analysis.importedAt}>
                {new Date(race.analysis.importedAt).toLocaleString()}
              </time>
            </span>
            <EnrichmentImport
              raceId={race.id}
              kind="analysis"
              refresh
              onLoaded={onUpgrade}
            />
          </>
        ) : (
          <EnrichmentImport
            raceId={race.id}
            kind="analysis"
            onLoaded={onUpgrade}
          />
        )}
      </div>
      <div className="analysis-cards">
        <div>
          <span>{focused.code} MEDIAN PACE</span>
          <strong>{seconds(summary.median)}</strong>
          <small>
            {summary.count} usable / {summary.total} completed laps
          </small>
        </div>
        <div>
          <span>{compared?.code ?? "COMPARISON"} MEDIAN PACE</span>
          <strong>{seconds(otherSummary.median)}</strong>
          <small>{otherSummary.count} usable laps</small>
        </div>
        <div>
          <span>{focused.code} BEST USABLE LAP</span>
          <strong>{seconds(summary.best)}</strong>
          <small>
            {summary.excluded} opening / pit / timing outliers excluded
          </small>
        </div>
        <div>
          <span>{focused.code} SECTOR COVERAGE</span>
          <strong>
            {summary.fullSectors} / {summary.total}
          </strong>
          <small>Complete and consistent sector sets</small>
        </div>
      </div>
      <div className="analysis-tabs" aria-label="Analysis views">
        {(
          [
            ["pace", "Lap pace"],
            ["sectors", "Sector comparison"],
            ["pits", "Pit-lane timing"],
          ] as const
        ).map(([key, label]) => (
          <button
            className="lab-button"
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={includeExcluded}
            onChange={(e) => setIncludeExcluded(e.target.checked)}
          />{" "}
          Include opening, pit and outlier laps
        </label>
      </div>
      {tab === "pace" && (
        <section aria-label="Pace analysis">
          <div className="analysis-legend">
            <span style={{ color: focused.color }}>● {focused.code}</span>
            {compared && (
              <span style={{ color: compared.color }}>● {compared.code}</span>
            )}
          </div>
          <PaceChart
            totalLaps={race.totalLaps}
            series={[
              { driver: focused, rows: shown },
              ...(compared ? [{ driver: compared, rows: otherShown }] : []),
            ]}
          />
          <div className="analysis-stints">
            {[...new Set(rows.map((r) => r.stint))].map((stint) => {
              const trend = stintTrend(rows, stint);
              if (!trend) return null;
              return (
                <div key={stint}>
                  <span>
                    STINT {stint} · {trend.compound}
                  </span>
                  <strong>
                    {trend.slope >= 0 ? "+" : ""}
                    {trend.slope.toFixed(3)} s / tyre-age lap
                  </strong>
                  <small>
                    {trend.count} usable laps · laps {trend.start}–{trend.end}
                  </small>
                </div>
              );
            })}
          </div>
          <p className="lab-note">
            Stint slopes describe the observed lap-time trend, not isolated tyre
            degradation. Fuel, traffic, flags and weather can affect it; the
            display makes no causal claim.
          </p>
        </section>
      )}
      {tab === "sectors" && (
        <section aria-label="Measured sector comparison">
          <label className="lab-field analysis-lap-select">
            Compare sectors for
            <select
              aria-label="Sector comparison lap"
              value={selectedLap}
              onChange={(e) => setSectorLap(Number(e.target.value))}
            >
              <option value="0">Best sectors across usable laps</option>
              {shown.map((r) => (
                <option key={r.lap.lap} value={r.lap.lap}>
                  Lap {r.lap.lap}
                </option>
              ))}
            </select>
          </label>
          <div className="sector-grid">
            {[0, 1, 2].map((i) => {
              const max = Math.max(1, a[i] ?? 0, b[i] ?? 0),
                delta = a[i] !== null && b[i] !== null ? b[i]! - a[i]! : null;
              return (
                <div className="sector-card" key={i}>
                  <span>SECTOR {i + 1}</span>
                  {[
                    { d: focused, time: a[i] },
                    { d: compared, time: b[i] },
                  ]
                    .filter((p) => p.d)
                    .map((p) => (
                      <div key={p.d!.number}>
                        <label>
                          {p.d!.code} <strong>{seconds(p.time)}</strong>
                        </label>
                        <i
                          style={{
                            width:
                              p.time === null
                                ? "0"
                                : `${Math.max(5, (p.time / max) * 100)}%`,
                            background: p.d!.color,
                          }}
                        />
                      </div>
                    ))}
                  <small>
                    {delta === null
                      ? "Missing measured data"
                      : `${compared?.code} − ${focused.code}: ${delta >= 0 ? "+" : ""}${delta.toFixed(3)} s`}
                  </small>
                </div>
              );
            })}
          </div>
          <p>
            Sum of selected sectors: {focused.code}{" "}
            <strong>{seconds(sum(a))}</strong>
            {compared && (
              <>
                {" "}
                · {compared.code} <strong>{seconds(sum(b))}</strong>
              </>
            )}
          </p>
          <p className="lab-note">
            {selectedLap
              ? "Sector deltas compare the same lap number; they are not simultaneous on-track gaps."
              : "Best-sector sums can combine different laps and stints. They are theoretical combinations, not a recorded lap."}{" "}
            Missing values remain empty. Inconsistent complete sector sets are
            excluded from best-sector aggregation.
          </p>
        </section>
      )}
      {tab === "pits" && (
        <section aria-label="Measured pit-lane timing">
          <div className="analysis-cards">
            <div>
              <span>MEASURED PIT VISITS</span>
              <strong>{pits.length}</strong>
            </div>
            <div>
              <span>MEDIAN LANE DURATION</span>
              <strong>
                {seconds(
                  median(
                    pits.flatMap((p) =>
                      p.laneDuration === null ? [] : [p.laneDuration],
                    ),
                  ),
                )}
              </strong>
            </div>
            <div>
              <span>MEDIAN STATIONARY STOP</span>
              <strong>
                {seconds(
                  median(
                    pits.flatMap((p) =>
                      p.stopDuration === null ? [] : [p.stopDuration],
                    ),
                  ),
                )}
              </strong>
            </div>
          </div>
          <div className="analysis-table">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Lap</th>
                  <th>Pit-lane traversal</th>
                  <th>Stationary service</th>
                </tr>
              </thead>
              <tbody>
                {pits.map((p, i) => (
                  <tr key={i}>
                    <td>
                      {race.drivers.find((d) => d.number === p.driver)?.code ??
                        p.driver}
                    </td>
                    <td>{p.lap}</td>
                    <td>{seconds(p.laneDuration)}</td>
                    <td>{seconds(p.stopDuration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!pits.length && (
            <p>
              No measured pit visits in this scope. Load measured analysis or
              choose the full race.
            </p>
          )}
          {race.analysis?.pitWarning && (
            <p role="alert">{race.analysis.pitWarning}</p>
          )}
          <p className="lab-note">
            Pit-lane duration includes the lane traversal; stationary service is
            a separate measurement and may be unavailable. Neither equals the
            net race-time loss relative to staying on track.
          </p>
        </section>
      )}
      <details className="strategy-details">
        <summary>Per-lap data and replay jumps</summary>
        <div className="analysis-table">
          <table>
            <thead>
              <tr>
                <th>Lap / replay</th>
                <th>{focused.code} time</th>
                <th>{compared?.code ?? "Rival"} time</th>
                <th>Rival − focus</th>
                <th>S1 / S2 / S3</th>
                <th>Trap (km/h)</th>
                <th>Compound / age</th>
                <th>Data notes</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const o = other.find((l) => l.lap.lap === r.lap.lap);
                return (
                  <tr key={r.lap.lap}>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`Replay lap ${r.lap.lap} for ${focused.code}`}
                        onClick={() => onSeek(driver, r.lap.start)}
                      >
                        {r.lap.lap} ↗
                      </button>
                    </td>
                    <td>{seconds(r.lap.duration)}</td>
                    <td>{seconds(o?.lap.duration ?? null)}</td>
                    <td>
                      {o
                        ? `${o.lap.duration - r.lap.duration >= 0 ? "+" : ""}${(o.lap.duration - r.lap.duration).toFixed(3)} s`
                        : "—"}
                    </td>
                    <td>
                      {r.sectors
                        .map((s) => (s === null ? "—" : s.toFixed(3)))
                        .join(" / ")}
                    </td>
                    <td>
                      {r.speedTrap === null ? "—" : r.speedTrap.toFixed(0)}
                    </td>
                    <td>
                      {r.compound} / {r.tyreAge}
                    </td>
                    <td>
                      {[
                        ...r.exclusions,
                        ...(r.sectorMismatch
                          ? ["Sector sum differs from lap time"]
                          : []),
                      ].join(" · ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
      <div className="lab-actions">
        <button className="lab-button" onClick={exportCsv}>
          Export driver laps CSV
        </button>
        <button
          className="lab-button"
          onClick={() =>
            downloadJson(`pitwall-${race.id}-analysis.json`, {
              version: 1,
              raceId: race.id,
              driver,
              comparison: rival,
              scope,
              cutoff: scope === "full" ? null : elapsed,
              rows,
              other,
              summary,
              source: race.analysis?.source ?? "OpenF1 recorded lap timing",
            })
          }
        >
          Export analysis JSON
        </button>
      </div>
      <p className="lab-note">
        Usable pace excludes the opening lap, known pit in/out laps, invalid
        durations and large timing outliers. This does not identify every
        traffic or flag-affected lap. Full-race scope deliberately reveals later
        results; replay scope uses only completed laps.
      </p>
    </Dialog>
  );
}
