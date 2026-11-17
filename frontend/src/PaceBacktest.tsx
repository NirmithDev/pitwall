import { useState } from "react";
import Dialog from "./Dialog";
import NumberField from "./NumberField";
import { findBacktestWindow, paceBacktest } from "./backtest";
import { downloadJson } from "./custom-track";
import type { Race } from "./race";
export default function PaceBacktest({
  race,
  selected,
  elapsed,
  onClose,
  onSeek,
}: {
  race: Race;
  selected: number;
  elapsed: number;
  onClose: () => void;
  onSeek: (driver: number, time: number) => void;
}) {
  const [driver, setDriver] = useState(selected);
  const completed =
    race.laps
      .filter((l) => l.driver === selected && l.start + l.duration <= elapsed)
      .at(-1)?.lap ?? 0;
  const [anchor, setAnchor] = useState(
    Math.min(race.totalLaps - 1, Math.max(6, completed || 10)),
  );
  const [horizon, setHorizon] = useState(Math.min(5, race.totalLaps - anchor));
  const [message, setMessage] = useState("");
  const result = paceBacktest(race, driver, anchor, horizon);
  const code = race.drivers.find((d) => d.number === driver)!.code;
  const values = result.rows.flatMap((r) => [r.actual, r.flat, r.trend]);
  const min = values.length ? Math.min(...values) - 0.5 : 0,
    max = values.length ? Math.max(...values) + 0.5 : 1;
  const x = (lap: number) =>
      60 + ((lap - anchor - 1) / Math.max(1, horizon - 1)) * 620,
    y = (time: number) => 220 - ((time - min) / (max - min)) * 180;
  const end = race.laps.find((l) => l.driver === driver && l.lap === anchor);
  return (
    <Dialog title="Pace forecast backtest" wide onClose={onClose}>
      <div className="strategy-banner">
        <span>TRAIN ON THE PAST · CHECK LATER OUTCOMES</span>
        <p>
          Test two simple pace forecasts against a later recorded window. This
          evaluates lap-time forecasting during a pit-free stint, not the
          accuracy of an unobserved strategy alternative.
        </p>
      </div>
      <div className="strategy-anchor">
        <label className="lab-field">
          Driver
          <select
            aria-label="Backtest driver"
            value={driver}
            onChange={(e) => {
              setDriver(Number(e.target.value));
              setMessage("");
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
          Train through completed lap
          <NumberField
            label="Backtest branch lap"
            min={5}
            max={race.totalLaps - 1}
            value={anchor}
            onChange={(n) => {
              setAnchor(n);
              setHorizon((h) => Math.min(h, race.totalLaps - n));
              setMessage("");
            }}
          />
        </label>
        <label className="lab-field">
          Held-out future laps
          <NumberField
            label="Backtest holdout laps"
            min={1}
            max={Math.min(15, race.totalLaps - anchor)}
            value={horizon}
            onChange={(n) => {
              setHorizon(n);
              setMessage("");
            }}
          />
        </label>
      </div>
      <div className="lab-actions">
        <button
          className="lab-button"
          onClick={() => {
            const found = findBacktestWindow(race, driver, horizon);
            if (found === null)
              setMessage(
                "No eligible pit-free window was found for this driver and holdout size.",
              );
            else {
              setAnchor(found);
              setMessage(
                `Found a pit-free sample after lap ${found}. This is one selected case, not a representative benchmark.`,
              );
            }
          }}
        >
          Find pit-free sample
        </button>
        <button
          className="lab-button"
          disabled={!end}
          onClick={() => end && onSeek(driver, end.start + end.duration)}
        >
          Open branch in replay
        </button>
      </div>
      {result.reason ? (
        <p className="backtest-reason" role="alert">
          {result.reason}
        </p>
      ) : (
        <>
          <div
            className="analysis-cards backtest-cards"
            data-testid="backtest-metrics"
          >
            <div>
              <span>FLAT PACE · MEAN ABSOLUTE ERROR</span>
              <strong>{result.flat!.mae.toFixed(3)} s/lap</strong>
              <small>Median of past usable laps</small>
            </div>
            <div>
              <span>TREND · MEAN ABSOLUTE ERROR</span>
              <strong>{result.trend!.mae.toFixed(3)} s/lap</strong>
              <small>Linear extrapolation from past laps</small>
            </div>
            <div>
              <span>TRAIN / HOLDOUT</span>
              <strong>
                {result.training.length} / {result.rows.length}
              </strong>
              <small>Recorded laps, kept separate</small>
            </div>
            <div>
              <span>OBSERVED TRAINING SLOPE</span>
              <strong>
                {result.slope! >= 0 ? "+" : ""}
                {result.slope!.toFixed(3)} s/lap
              </strong>
              <small>Bounded to ±0.5 s/lap per lap</small>
            </div>
          </div>
          <div className="analysis-legend">
            <span style={{ color: "#f2c75e" }}>● Actual recorded</span>
            <span style={{ color: "#8d9cb5" }}>● Flat median</span>
            <span style={{ color: "#6d9fff" }}>● Past trend</span>
          </div>
          <figure className="analysis-figure">
            <svg
              viewBox="0 0 720 265"
              role="img"
              aria-label="Actual held-out lap times compared with forecasts trained on earlier laps"
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
                  <text
                    x="8"
                    y={224 - f * 180}
                    fill="currentColor"
                    fontSize="11"
                  >
                    {(min + f * (max - min)).toFixed(1)}s
                  </text>
                </g>
              ))}
              {(
                [
                  { key: "flat", color: "#8d9cb5" },
                  { key: "trend", color: "#6d9fff" },
                  { key: "actual", color: "#f2c75e" },
                ] as const
              ).map((s) => (
                <g key={s.key}>
                  <polyline
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2.5"
                    strokeDasharray={s.key === "flat" ? "5 5" : undefined}
                    points={result.rows
                      .map((r) => `${x(r.lap)},${y(r[s.key])}`)
                      .join(" ")}
                  />
                  {result.rows.map((r) => (
                    <circle
                      key={r.lap}
                      cx={x(r.lap)}
                      cy={y(r[s.key])}
                      r="4"
                      fill={s.color}
                    >
                      <title>
                        {code} lap {r.lap} · {s.key}: {r[s.key].toFixed(3)} s
                      </title>
                    </circle>
                  ))}
                </g>
              ))}
              <text x="60" y="250" fill="currentColor" fontSize="12">
                LAP {anchor + 1}
              </text>
              <text x="610" y="250" fill="currentColor" fontSize="12">
                LAP {anchor + horizon}
              </text>
            </svg>
            <figcaption>
              The later recorded laps are evaluation data only. Neither forecast
              is fitted to them.
            </figcaption>
          </figure>
          <div className="analysis-table">
            <table>
              <thead>
                <tr>
                  <th>Lap</th>
                  <th>Actual</th>
                  <th>Flat forecast</th>
                  <th>Flat error</th>
                  <th>Trend forecast</th>
                  <th>Trend error</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.lap}>
                    <td>{r.lap}</td>
                    <td>{r.actual.toFixed(3)} s</td>
                    <td>{r.flat.toFixed(3)} s</td>
                    <td>{(r.flat - r.actual).toFixed(3)} s</td>
                    <td>{r.trend.toFixed(3)} s</td>
                    <td>{(r.trend - r.actual).toFixed(3)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Signed mean error: flat {result.flat!.bias.toFixed(3)} s/lap · trend{" "}
            {result.trend!.bias.toFixed(3)} s/lap. Positive means predicted laps
            were slower than recorded. Cumulative lap-time error: flat{" "}
            {result.flat!.totalError.toFixed(3)} s · trend{" "}
            {result.trend!.totalError.toFixed(3)} s.
          </p>
          <div className="lab-actions">
            <button
              className="lab-button"
              onClick={() =>
                downloadJson(`pitwall-${race.id}-${code}-backtest.json`, {
                  version: 1,
                  model: "pit-free-pace-baselines-v1",
                  raceId: race.id,
                  driver,
                  anchor,
                  horizon,
                  ...result,
                  limitations:
                    "One historical window; traffic, weather, fuel and flags may affect errors. This does not validate counterfactual strategy decisions.",
                })
              }
            >
              Export backtest JSON
            </button>
          </div>
        </>
      )}
      <details className="strategy-details" open>
        <summary>Method and limits</summary>
        <p>
          Training uses up to 12 recent usable laps completed by the branch
          point, restricted to the current stint. At least five training laps
          are needed. The flat model uses their median; the trend model
          extrapolates a bounded least-squares slope. Missing timing and pit
          in/out laps make a holdout ineligible. Later observed lap durations
          never enter training.
        </p>
        <p>
          Traffic, fuel, flags and weather may remain in both windows. A
          selected pit-free sample is not a representative statistical
          benchmark, and success on one case does not validate a different pit
          decision. These metrics describe lap-time prediction error, not
          finishing-position accuracy or net pit-stop loss.
        </p>
      </details>
      <p role="status">{message}</p>
    </Dialog>
  );
}
