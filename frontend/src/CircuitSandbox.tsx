import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  downloadJson,
  parseTrack,
  readTracks,
  tracksKey,
  type CustomTrack,
  type Point,
} from "./custom-track";
import NumberField from "./NumberField";
import {
  advancePreview,
  initialGrid,
  newSandboxDriver,
  parseSandbox,
  pointOnRoute,
  previewPoint,
  readSandbox,
  sandboxDefaults,
  sandboxGeometry,
  sandboxKey,
  validateSandbox,
  type SandboxSetup,
} from "./sandbox";
import { formatClock } from "./race";
export default function CircuitSandbox({
  track,
  onSaved,
  active,
}: {
  track: CustomTrack;
  onSaved: () => void;
  active: boolean;
}) {
  const [setup, setSetup] = useState(() => readSandbox(track));
  const [states, setStates] = useState(() => initialGrid(setup.drivers));
  const [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(10),
    [elapsed, setElapsed] = useState(0);
  const [editing, setEditing] = useState(false),
    [selected, setSelected] = useState(0),
    [message, setMessage] = useState("");
  const [history, setHistory] = useState<SandboxSetup[]>([]);
  const drag = useRef<{ index: number; before: SandboxSetup } | null>(null);
  const geometry = useMemo(() => sandboxGeometry(track, setup), [track, setup]);
  const errors = useMemo(() => validateSandbox(track, setup), [track, setup]),
    valid = !errors.length;
  useEffect(() => {
    if (!active || !running || !valid) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const seconds = Math.min((now - previous) / 1000, 0.1) * speed;
      previous = now;
      setStates((old) =>
        old.map((s, i) =>
          advancePreview(s, setup.drivers[i], setup, geometry, seconds),
        ),
      );
      setElapsed((t) => t + seconds);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, running, speed, setup, geometry, valid]);
  useEffect(() => {
    if (!active) setRunning(false);
  }, [active]);
  useEffect(() => {
    reset();
  }, [track.points, track.cornerRadius]);
  function reset(next = setup) {
    setRunning(false);
    setElapsed(0);
    setStates(initialGrid(next.drivers));
  }
  function change(next: SandboxSetup, remember = true) {
    if (remember) setHistory((h) => [...h.slice(-29), setup]);
    setSetup(next);
    setMessage("");
    reset(next);
  }
  function point(e: PointerEvent<SVGSVGElement>): Point {
    const p = e.currentTarget.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const transformed = p.matrixTransform(
      e.currentTarget.getScreenCTM()!.inverse(),
    );
    return [
      Math.round(Math.max(20, Math.min(780, transformed.x))),
      Math.round(Math.max(20, Math.min(500, transformed.y))),
    ];
  }
  function advance(seconds: number) {
    setRunning(false);
    setStates((old) =>
      old.map((s, i) =>
        advancePreview(s, setup.drivers[i], setup, geometry, seconds),
      ),
    );
    setElapsed((t) => t + seconds);
  }
  const order = [...states].sort((a, b) => {
    const progress = (s: typeof a) =>
      s.phase === "track"
        ? s.raceProgress
        : s.raceProgress + s.pitProgress * ((setup.exit - setup.entry + 1) % 1);
    return progress(b) - progress(a);
  });
  const box = pointOnRoute(geometry.pit, 0.5);
  return (
    <section aria-label="Circuit race sandbox">
      <div className="strategy-banner">
        <span>FICTIONAL RACE SANDBOX</span>
        <p>
          Configure drivers and a connected pit lane. This is a deterministic
          animation of pace and service stops; it does not model grip,
          collisions, fuel, overtaking or vehicle upgrades.
        </p>
      </div>
      <div className="sandbox-controls">
        <label className="lab-field">
          Base lap (seconds)
          <NumberField
            label="Sandbox base lap seconds"
            min={30}
            max={300}
            value={setup.baseLapSeconds}
            onChange={(n) => change({ ...setup, baseLapSeconds: n })}
          />
        </label>
        <label className="lab-field">
          Pit entry (% of lap)
          <NumberField
            label="Pit entry percent"
            min={0}
            max={99}
            value={Math.round(setup.entry * 100)}
            onChange={(n) => change({ ...setup, entry: n / 100 })}
          />
        </label>
        <label className="lab-field">
          Pit exit (% of lap)
          <NumberField
            label="Pit exit percent"
            min={0}
            max={99}
            value={Math.round(setup.exit * 100)}
            onChange={(n) => change({ ...setup, exit: n / 100 })}
          />
        </label>
        <label className="lab-field">
          Drivers
          <select
            aria-label="Sandbox driver count"
            value={setup.drivers.length}
            onChange={(e) =>
              change({
                ...setup,
                drivers: Array.from(
                  { length: Number(e.target.value) },
                  (_, i) => setup.drivers[i] ?? newSandboxDriver(i),
                ),
              })
            }
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="lab-actions">
        <button
          className="lab-button"
          aria-pressed={editing}
          onClick={() => {
            setEditing(!editing);
            setRunning(false);
          }}
        >
          {editing ? "Finish pit-lane editing" : "Edit pit-lane handles"}
        </button>
        <button
          className="lab-button"
          disabled={!editing || setup.pitControls.length <= 1}
          onClick={() => {
            change({
              ...setup,
              pitControls: setup.pitControls.filter((_, i) => i !== selected),
            });
            setSelected(0);
          }}
        >
          Remove pit handle
        </button>
        <button
          className="lab-button"
          disabled={!history.length}
          onClick={() => {
            const previous = history.at(-1)!;
            setHistory(history.slice(0, -1));
            setSetup(previous);
            setSelected(0);
            reset(previous);
          }}
        >
          Undo sandbox edit
        </button>
        <button
          className="lab-button"
          onClick={() => {
            const defaults = sandboxDefaults(track);
            change({
              ...setup,
              entry: defaults.entry,
              exit: defaults.exit,
              pitControls: defaults.pitControls,
            });
            setSelected(0);
          }}
        >
          Reset pit lane
        </button>
      </div>
      <div className="sandbox-stage">
        <svg
          viewBox="0 0 800 520"
          className={`studio-canvas ${editing ? "adding" : ""}`}
          role="img"
          tabIndex={0}
          aria-label="Fictional circuit and connected pit-lane simulation"
          data-testid="sandbox-map"
          onPointerDown={(e) => {
            if (!editing || e.button !== 0) return;
            const handle = (e.target as Element).closest("[data-pit-control]");
            if (handle) {
              const index = Number(handle.getAttribute("data-pit-control"));
              setSelected(index);
              drag.current = { index, before: setup };
              e.currentTarget.setPointerCapture(e.pointerId);
            } else if (setup.pitControls.length < 12) {
              change({
                ...setup,
                pitControls: [...setup.pitControls, point(e)],
              });
              setSelected(setup.pitControls.length);
            }
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = point(e);
            change(
              {
                ...setup,
                pitControls: setup.pitControls.map((v, i) =>
                  i === d.index ? p : v,
                ),
              },
              false,
            );
          }}
          onPointerUp={(e) => {
            const before = drag.current?.before;
            if (before) setHistory((h) => [...h.slice(-29), before]);
            drag.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            if (drag.current) {
              setSetup(drag.current.before);
              reset(drag.current.before);
            }
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
          onKeyDown={(e) => {
            if (
              !editing ||
              !setup.pitControls[selected] ||
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            )
              return;
            e.preventDefault();
            e.stopPropagation();
            const p = setup.pitControls[selected],
              step = e.shiftKey ? 10 : 2;
            const next: Point = [
              Math.max(
                20,
                Math.min(
                  780,
                  p[0] +
                    (e.key === "ArrowRight"
                      ? step
                      : e.key === "ArrowLeft"
                        ? -step
                        : 0),
                ),
              ),
              Math.max(
                20,
                Math.min(
                  500,
                  p[1] +
                    (e.key === "ArrowDown"
                      ? step
                      : e.key === "ArrowUp"
                        ? -step
                        : 0),
                ),
              ),
            ];
            change({
              ...setup,
              pitControls: setup.pitControls.map((v, i) =>
                i === selected ? next : v,
              ),
            });
          }}
        >
          <path
            d={geometry.path}
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
            opacity=".12"
            strokeLinejoin="round"
          />
          <path
            d={geometry.path}
            fill="none"
            stroke="#52bda5"
            strokeWidth="3"
          />
          <polyline
            points={geometry.pit.points.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={valid ? "#f5b257" : "#ff665d"}
            strokeWidth="3"
            strokeDasharray="5 4"
          />
          <g transform={`translate(${geometry.entry})`}>
            <circle r="5" fill="#f5b257" />
            <text x="12" y="18" fill="currentColor" fontSize="12">
              PIT IN
            </text>
          </g>
          <g transform={`translate(${geometry.exit})`}>
            <circle r="5" fill="#f5b257" />
            <text x="12" y="-10" fill="currentColor" fontSize="12">
              PIT OUT
            </text>
          </g>
          <g transform={`translate(${box})`}>
            <rect
              x="-10"
              y="-8"
              width="20"
              height="16"
              rx="3"
              fill="#f5b257"
              opacity=".3"
            />
            <text x="14" y="5" fill="currentColor" fontSize="12">
              SERVICE
            </text>
          </g>
          {editing &&
            setup.pitControls.map((p, i) => (
              <g
                key={i}
                data-pit-control={i}
                className="studio-vertex"
                transform={`translate(${p})`}
              >
                <circle
                  r={selected === i ? 11 : 8}
                  fill="#f5b257"
                  stroke="var(--panel)"
                  strokeWidth="3"
                />
                <text x="12" y="-12" fill="currentColor" fontSize="12">
                  P{i + 1}
                </text>
              </g>
            ))}
          {valid &&
            states.map((s, i) => {
              const p = previewPoint(s, geometry),
                driver = setup.drivers[i];
              return (
                <g
                  key={s.id}
                  data-testid={`sandbox-driver-${i}`}
                  data-phase={s.phase}
                  transform={`translate(${p})`}
                >
                  <circle
                    r="7"
                    fill={driver.color}
                    stroke="var(--panel)"
                    strokeWidth="2"
                  />
                  <text x="11" y="-11" fill={driver.color} fontSize="12">
                    {driver.name}
                  </text>
                  <title>
                    {driver.name} · {s.phase}
                  </title>
                </g>
              );
            })}
        </svg>
        <div className="sandbox-order">
          <div>
            <span>SIMULATED ORDER</span>
            <strong data-testid="sandbox-clock">{formatClock(elapsed)}</strong>
          </div>
          {order.map((state, i) => {
            const d = setup.drivers.find((d) => d.id === state.id)!;
            const effective =
              state.phase === "track"
                ? state.raceProgress
                : state.raceProgress +
                  state.pitProgress * ((setup.exit - setup.entry + 1) % 1);
            return (
              <div className="sandbox-order-row" key={state.id}>
                <b>{i + 1}</b>
                <i style={{ background: d.color }} />
                <span>
                  {d.name}
                  <small>
                    {effective < 0
                      ? "GRID"
                      : `LAP ${Math.floor(effective) + 1}`}{" "}
                    · {state.phase.toUpperCase()}
                  </small>
                </span>
                <small>{state.visited ? "1 STOP" : "0 STOPS"}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="lab-actions">
        <button
          className="save-button"
          disabled={!valid}
          onClick={() => {
            setEditing(false);
            setRunning(!running);
          }}
        >
          {running ? "Pause sandbox" : "Run sandbox"}
        </button>
        <button className="lab-button" onClick={() => reset()}>
          Reset sandbox
        </button>
        <button
          className="lab-button"
          disabled={!valid}
          onClick={() => advance(setup.baseLapSeconds)}
        >
          Advance one lap
        </button>
        <label className="lab-field">
          Preview speed
          <select
            aria-label="Sandbox speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[1, 5, 10, 25].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
          </select>
        </label>
      </div>
      {editing && (
        <p className="lab-note">
          Drag orange handles or select one and use arrow keys. Click an empty
          area to append a pit handle; entry and exit stay attached to the
          circuit. Changes reset the simulation.
        </p>
      )}
      {errors.length > 0 && (
        <div className="studio-validation" role="alert">
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="sandbox-drivers">
        <h3>Driver setup</h3>
        {setup.drivers.map((d, i) => (
          <fieldset key={d.id}>
            <legend>Grid slot {i + 1}</legend>
            <label className="lab-field">
              Name
              <input
                aria-label={`Grid ${i + 1} driver name`}
                maxLength={24}
                value={d.name}
                onChange={(e) =>
                  change({
                    ...setup,
                    drivers: setup.drivers.map((v, n) =>
                      n === i ? { ...v, name: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label className="lab-field">
              Colour
              <input
                aria-label={`Grid ${i + 1} driver colour`}
                type="color"
                value={d.color}
                onChange={(e) =>
                  change({
                    ...setup,
                    drivers: setup.drivers.map((v, n) =>
                      n === i ? { ...v, color: e.target.value } : v,
                    ),
                  })
                }
              />
            </label>
            <label className="lab-field">
              Pace offset (s/lap)
              <NumberField
                label={`Grid ${i + 1} pace offset`}
                min={-10}
                max={10}
                step={0.1}
                value={d.paceOffset}
                onChange={(value) =>
                  change({
                    ...setup,
                    drivers: setup.drivers.map((v, n) =>
                      n === i ? { ...v, paceOffset: value } : v,
                    ),
                  })
                }
              />
            </label>
            <label className="lab-field">
              Pit on lap (0 = none)
              <NumberField
                label={`Grid ${i + 1} pit lap`}
                min={0}
                max={10}
                value={d.pitLap}
                onChange={(value) =>
                  change({
                    ...setup,
                    drivers: setup.drivers.map((v, n) =>
                      n === i ? { ...v, pitLap: value } : v,
                    ),
                  })
                }
              />
            </label>
            <label className="lab-field">
              Service seconds
              <NumberField
                label={`Grid ${i + 1} service seconds`}
                min={0}
                max={15}
                step={0.1}
                value={d.serviceSeconds}
                onChange={(value) =>
                  change({
                    ...setup,
                    drivers: setup.drivers.map((v, n) =>
                      n === i ? { ...v, serviceSeconds: value } : v,
                    ),
                  })
                }
              />
            </label>
          </fieldset>
        ))}
      </div>
      <div className="lab-actions">
        <button
          className="save-button"
          disabled={!valid}
          onClick={() => {
            try {
              const current = readTracks();
              if (
                current.length >= 20 &&
                !current.some((t) => t.id === track.id)
              )
                throw new Error(
                  "Twenty circuits are saved. Delete one in the editor first.",
                );
              localStorage.setItem(
                tracksKey,
                JSON.stringify([
                  ...current.filter((t) => t.id !== track.id),
                  parseTrack(track),
                ]),
              );
              localStorage.setItem(
                sandboxKey(track.id),
                JSON.stringify(parseSandbox(setup)),
              );
              onSaved();
              setMessage("Circuit and race setup saved in this browser.");
            } catch (e) {
              setMessage(`Could not save race setup: ${(e as Error).message}`);
            }
          }}
        >
          Save circuit and race setup
        </button>
        <button
          className="lab-button"
          disabled={!valid}
          onClick={() =>
            downloadJson("pitwall-circuit-race.json", {
              kind: "pitwall-circuit-sandbox",
              version: 1,
              track,
              setup,
              elapsed,
              states,
            })
          }
        >
          Export sandbox session JSON
        </button>
      </div>
      <p role="status">{message}</p>
      <p className="lab-note">
        Pace offset adds seconds to the base lap. Pit-lane speed is fixed at 35%
        of each driver's synthetic track speed, with one optional service stop
        at the lane midpoint. The running order uses simulated circuit progress;
        it is not a physical race model. Car designs and upgrade models remain
        separate future work.
      </p>
    </section>
  );
}
