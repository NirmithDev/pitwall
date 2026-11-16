import { useState } from "react";
import Dialog from "./Dialog";
import NumberField from "./NumberField";
import { downloadJson } from "./custom-track";
import {
  calibratePace,
  defaultStay,
  defaultStop,
  projectStrategy,
  readScenarios,
  scenariosKey,
  type StrategyPlan,
  type SavedScenario,
} from "./strategy";
import type { Race } from "./race";

function PlanControls({
  name,
  plan,
  horizon,
  onChange,
}: {
  name: string;
  plan: StrategyPlan;
  horizon: number;
  onChange: (p: StrategyPlan) => void;
}) {
  const fields: {
    key: keyof StrategyPlan;
    label: string;
    min: number;
    max: number;
    step: number;
  }[] = [
    {
      key: "paceDelta",
      label: "Pace adjustment (s/lap)",
      min: -5,
      max: 5,
      step: 0.1,
    },
    {
      key: "degradation",
      label: "Degradation (s/lap per lap)",
      min: 0,
      max: 0.5,
      step: 0.01,
    },
    {
      key: "pitLap",
      label: "Pit on future lap (0 = no stop)",
      min: 0,
      max: horizon,
      step: 1,
    },
    { key: "pitLoss", label: "Pit loss (seconds)", min: 5, max: 60, step: 0.5 },
    {
      key: "freshTyreGain",
      label: "Fresh tyre gain (s/lap)",
      min: 0,
      max: 5,
      step: 0.1,
    },
  ];
  return (
    <fieldset className="strategy-plan">
      <legend>{name}</legend>
      {fields.map((f) => (
        <label className="lab-field" key={f.key}>
          {f.label}
          <NumberField
            label={`${name} ${f.label}`}
            min={f.min}
            max={f.max}
            step={f.step}
            value={plan[f.key]}
            disabled={
              plan.pitLap === 0 &&
              (f.key === "pitLoss" || f.key === "freshTyreGain")
            }
            onChange={(n) => onChange({ ...plan, [f.key]: n })}
          />
        </label>
      ))}
    </fieldset>
  );
}
export default function StrategyLab({
  race,
  selected,
  elapsed,
  onClose,
}: {
  race: Race;
  selected: number;
  elapsed: number;
  onClose: () => void;
}) {
  const [driver, setDriver] = useState(selected);
  const initialLap =
    race.laps
      .filter((l) => l.driver === selected && l.start + l.duration <= elapsed)
      .at(-1)?.lap ?? 0;
  const maxAnchor = Math.max(3, race.totalLaps - 1);
  const startingAnchor = Math.min(maxAnchor, initialLap >= 5 ? initialLap : 10);
  const [throughLap, setThroughLap] = useState(startingAnchor);
  const [horizon, setHorizon] = useState(
    Math.min(20, race.totalLaps - startingAnchor),
  );
  const [a, setA] = useState<StrategyPlan>(defaultStay),
    [b, setB] = useState<StrategyPlan>(() => ({
      ...defaultStop,
      pitLap: Math.min(5, horizon),
    }));
  const [saved, setSaved] = useState(() => readScenarios(race)),
    [name, setName] = useState(""),
    [savedId, setSavedId] = useState(""),
    [message, setMessage] = useState("");
  const calibration = calibratePace(race, driver, throughLap);
  const projectionA = calibration
    ? projectStrategy(calibration.pace, horizon, a)
    : [];
  const projectionB = calibration
    ? projectStrategy(calibration.pace, horizon, b)
    : [];
  const differences = projectionA.map((l, i) => projectionB[i].total - l.total);
  const difference = differences.at(-1) ?? 0;
  const extent = Math.max(5, ...differences.map(Math.abs)) * 1.15;
  const x = (lap: number) => 55 + ((lap - 1) / Math.max(1, horizon - 1)) * 610;
  const y = (gap: number) => 120 - (gap / extent) * 85;
  function limitHorizon(value: number) {
    const next = Math.max(
      1,
      Math.min(40, race.totalLaps - throughLap, Math.round(value) || 1),
    );
    setHorizon(next);
    setA((p) => ({ ...p, pitLap: Math.min(p.pitLap, next) }));
    setB((p) => ({ ...p, pitLap: Math.min(p.pitLap, next) }));
  }
  function anchor(value: number) {
    const next = Math.max(3, Math.min(maxAnchor, Math.round(value) || 3));
    setThroughLap(next);
    const remaining = Math.min(horizon, race.totalLaps - next);
    setHorizon(remaining);
    setA((p) => ({ ...p, pitLap: Math.min(p.pitLap, remaining) }));
    setB((p) => ({ ...p, pitLap: Math.min(p.pitLap, remaining) }));
  }
  const scenario = (): SavedScenario => ({
    version: 1,
    id: crypto.randomUUID(),
    name: name.trim() || "Strategy comparison",
    driver,
    throughLap,
    horizon,
    a,
    b,
  });
  return (
    <Dialog title="Strategy what-if lab" wide onClose={onClose}>
      <div className="strategy-banner">
        <span>EXPERIMENTAL MODEL</span>
        <p>
          Compare two hypothetical plans from a historical branch point. This
          projects elapsed time for one driver, not finishing position or a race
          outcome.
        </p>
      </div>
      <div className="strategy-anchor">
        <label className="lab-field">
          Driver
          <select
            aria-label="Strategy driver"
            value={driver}
            onChange={(e) => setDriver(Number(e.target.value))}
          >
            {race.drivers.map((d) => (
              <option key={d.number} value={d.number}>
                {d.code} · {d.firstName} {d.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="lab-field">
          Branch after completed lap
          <NumberField
            label="Branch after lap"
            min={3}
            max={maxAnchor}
            value={throughLap}
            onChange={anchor}
          />
        </label>
        <label className="lab-field">
          Project next laps
          <NumberField
            label="Projection laps"
            min={1}
            max={Math.min(40, race.totalLaps - throughLap)}
            value={horizon}
            onChange={limitHorizon}
          />
        </label>
      </div>
      {calibration ? (
        <p className="strategy-calibration" data-testid="pace-calibration">
          Base pace: <strong>{calibration.pace.toFixed(3)} s/lap</strong> ·{" "}
          {calibration.samples} recent usable laps through lap {throughLap} ·
          sample range {calibration.min.toFixed(2)}–{calibration.max.toFixed(2)}{" "}
          s
        </p>
      ) : (
        <p role="alert">
          Not enough usable laps for this branch point. Choose a later lap or
          another driver; at least three clean timed laps are required.
        </p>
      )}
      <div className="strategy-plans">
        <PlanControls
          name="Plan A"
          plan={a}
          horizon={horizon}
          onChange={setA}
        />
        <PlanControls
          name="Plan B"
          plan={b}
          horizon={horizon}
          onChange={setB}
        />
      </div>
      {calibration && (
        <>
          <div className="strategy-outcomes" data-testid="strategy-result">
            <div>
              <span>PLAN A · {horizon} LAPS</span>
              <strong>{projectionA.at(-1)!.total.toFixed(2)} s</strong>
            </div>
            <div>
              <span>PLAN B · {horizon} LAPS</span>
              <strong>{projectionB.at(-1)!.total.toFixed(2)} s</strong>
            </div>
            <div>
              <span>MODEL COMPARISON</span>
              <strong>
                {Math.abs(difference) < 0.005
                  ? "Plans are equal"
                  : `Plan ${difference < 0 ? "B" : "A"} faster by ${Math.abs(difference).toFixed(2)} s`}
              </strong>
            </div>
          </div>
          <figure className="strategy-chart">
            <svg
              viewBox="0 0 720 245"
              role="img"
              aria-label="Projected cumulative time difference: positive means Plan B is slower"
            >
              <line
                x1="55"
                y1="120"
                x2="665"
                y2="120"
                stroke="currentColor"
                opacity=".25"
                strokeDasharray="5 5"
              />
              <text x="55" y="20" fill="currentColor" fontSize="12">
                B slower (+) / B faster (−), seconds
              </text>
              <text x="15" y="38" fill="currentColor" fontSize="11">
                +{extent.toFixed(0)}
              </text>
              <text x="28" y="124" fill="currentColor" fontSize="11">
                0
              </text>
              <text x="15" y="210" fill="currentColor" fontSize="11">
                −{extent.toFixed(0)}
              </text>
              <polyline
                data-testid="strategy-gap-line"
                points={differences
                  .map((gap, i) => `${x(i + 1)},${y(gap)}`)
                  .join(" ")}
                fill="none"
                stroke="#6d9fff"
                strokeWidth="3"
              />
              {differences.map((gap, i) => (
                <circle key={i} cx={x(i + 1)} cy={y(gap)} r="3" fill="#6d9fff">
                  <title>
                    Future lap {i + 1}: B {gap >= 0 ? "+" : ""}
                    {gap.toFixed(2)} s vs A
                  </title>
                </circle>
              ))}
              <text x="55" y="235" fill="currentColor" fontSize="12">
                Future lap 1
              </text>
              <text x="580" y="235" fill="currentColor" fontSize="12">
                Future lap {horizon}
              </text>
            </svg>
            <figcaption>
              Assumed time difference over the next {horizon} laps. A lower
              projected total is faster within this model.
            </figcaption>
          </figure>
          <details className="strategy-details">
            <summary>View per-lap projection and calibration laps</summary>
            <p>
              Calibration laps: {calibration.laps.join(", ")}. Future recorded
              laps are excluded from this calculation.
            </p>
            <div className="strategy-table">
              <table>
                <thead>
                  <tr>
                    <th>Future lap</th>
                    <th>A lap / total (s)</th>
                    <th>B lap / total (s)</th>
                    <th>B − A (s)</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionA.map((lap, i) => (
                    <tr key={lap.lap}>
                      <td>{lap.lap}</td>
                      <td>
                        {lap.lapTime.toFixed(2)} / {lap.total.toFixed(2)}
                        {lap.pit ? " · PIT" : ""}
                      </td>
                      <td>
                        {projectionB[i].lapTime.toFixed(2)} /{" "}
                        {projectionB[i].total.toFixed(2)}
                        {projectionB[i].pit ? " · PIT" : ""}
                      </td>
                      <td>{differences[i].toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <details className="strategy-details" open>
        <summary>Model assumptions</summary>
        <p>
          Base pace is the median of up to 12 recent usable laps, excluding lap
          one, known pit in/out laps, and large timing outliers. Pace adjustment
          applies every future lap. Degradation increases lap time linearly; a
          stop adds pit loss on the chosen future lap, then resets degradation
          and applies the fresh-tyre gain from the following lap. Gain is
          relative to the sampled current pace.
        </p>
        <p>
          No traffic, fuel burn, weather, safety-car behavior, tyre-compound
          rules, overtaking, mechanical failures, or opponent decisions are
          modeled. The sample can still contain traffic or flag effects. Results
          are deterministic assumptions for exploration, not calibrated
          forecasts or measured counterfactuals.
        </p>
      </details>
      <div className="lab-actions">
        <label className="lab-field">
          Scenario name
          <input
            aria-label="Scenario name"
            maxLength={48}
            value={name}
            placeholder="e.g. Early stop vs staying out"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          className="save-button"
          disabled={!calibration || !name.trim()}
          onClick={() => {
            try {
              const item = scenario(),
                existing = saved.find(
                  (s) => s.name.toLowerCase() === item.name.toLowerCase(),
                );
              if (!existing && saved.length >= 10)
                throw new Error("Ten scenarios are saved. Delete one first.");
              if (existing) item.id = existing.id;
              const next = [...saved.filter((s) => s.id !== item.id), item];
              localStorage.setItem(scenariosKey(race.id), JSON.stringify(next));
              setSaved(next);
              setSavedId(item.id);
              setMessage("Scenario saved in this browser for this race.");
            } catch (e) {
              setMessage(`Could not save: ${(e as Error).message}`);
            }
          }}
        >
          Save scenario
        </button>
        <select
          className="lab-input studio-saved"
          aria-label="Saved scenarios"
          value={savedId}
          onChange={(e) => setSavedId(e.target.value)}
        >
          <option value="">Saved scenarios</option>
          {saved.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          className="lab-button"
          disabled={!savedId}
          onClick={() => {
            const item = saved.find((s) => s.id === savedId);
            if (!item) return;
            setDriver(item.driver);
            setThroughLap(item.throughLap);
            setHorizon(item.horizon);
            setA(item.a);
            setB(item.b);
            setName(item.name);
            setMessage(
              "Saved assumptions loaded; pace is recalculated from this replay.",
            );
          }}
        >
          Load scenario
        </button>
        <button
          className="lab-button"
          disabled={!savedId}
          onClick={() => {
            try {
              const next = saved.filter((s) => s.id !== savedId);
              localStorage.setItem(scenariosKey(race.id), JSON.stringify(next));
              setSaved(next);
              setSavedId("");
              setMessage("Scenario deleted.");
            } catch {
              setMessage(
                "Browser storage is unavailable. Scenario was not deleted.",
              );
            }
          }}
        >
          Delete scenario
        </button>
        <button
          className="lab-button"
          disabled={!calibration}
          onClick={() =>
            downloadJson("pitwall-strategy.json", {
              ...scenario(),
              raceId: race.id,
              model: "linear-degradation-v1",
              calibration,
              projectionA,
              projectionB,
              assumptions:
                "Deterministic single-driver projection; traffic, fuel, weather, flags, regulations and opponents are not modeled.",
            })
          }
        >
          Export comparison JSON
        </button>
      </div>
      <p role="status">{message}</p>
    </Dialog>
  );
}
