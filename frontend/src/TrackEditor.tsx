import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Dialog from "./Dialog";
import NumberField from "./NumberField";
import CircuitSandbox from "./CircuitSandbox";
import { pointOnTrack } from "./race";
import { roundedTrack } from "./rounded-track";
import {
  downloadJson,
  newTrack,
  parseTrack,
  readTracks,
  rebaseStart,
  tracksKey,
  validateTrack,
  type CustomTrack,
  type Point,
} from "./custom-track";

export default function TrackEditor({
  outline,
  onClose,
}: {
  outline: Point[];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CustomTrack>(newTrack);
  const [workspace, setWorkspace] = useState<"edit" | "race">("edit");
  const [hasSandbox, setHasSandbox] = useState(false);
  const [saved, setSaved] = useState(readTracks);
  const [savedId, setSavedId] = useState("");
  const [selected, setSelected] = useState(0);
  const [past, setPast] = useState<CustomTrack[]>([]),
    [future, setFuture] = useState<CustomTrack[]>([]);
  const [adding, setAdding] = useState(false),
    [running, setRunning] = useState(false);
  const [lapSeconds, setLapSeconds] = useState(90),
    [cars, setCars] = useState(3),
    [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    index: number;
    before: CustomTrack;
    moved: boolean;
  } | null>(null);
  const errors = validateTrack(draft),
    valid = errors.length === 0;
  useEffect(() => {
    if (!running || !valid) return;
    let frame = 0,
      previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      setProgress((p) => (p + delta / lapSeconds) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, valid, lapSeconds]);
  function edit(next: CustomTrack) {
    setPast((p) => [...p.slice(-49), draft]);
    setFuture([]);
    setDraft(next);
    setMessage("");
  }
  function replace(next: CustomTrack) {
    edit(next);
    setSelected(0);
    setRunning(false);
    setProgress(0);
  }
  function undo() {
    if (!past.length) return;
    setFuture((f) => [draft, ...f]);
    setDraft(past.at(-1)!);
    setPast(past.slice(0, -1));
    setSelected(0);
  }
  function redo() {
    if (!future.length) return;
    setPast((p) => [...p, draft]);
    setDraft(future[0]);
    setFuture(future.slice(1));
    setSelected(0);
  }
  function point(event: PointerEvent<SVGSVGElement>): Point {
    const p = event.currentTarget.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const next = p.matrixTransform(
      event.currentTarget.getScreenCTM()!.inverse(),
    );
    return [
      Math.round(Math.max(20, Math.min(780, next.x))),
      Math.round(Math.max(20, Math.min(500, next.y))),
    ];
  }
  function remove() {
    if (!draft.points.length) return;
    const points = draft.points.filter((_, i) => i !== selected);
    edit({
      ...draft,
      points,
      sectorEnds: [
        Math.floor(points.length / 3),
        Math.floor((points.length * 2) / 3),
      ],
    });
    setSelected(Math.max(0, Math.min(selected, points.length - 1)));
  }
  function persist(next: CustomTrack[]) {
    localStorage.setItem(tracksKey, JSON.stringify(next));
    setSaved(next);
  }
  const geometry = useMemo(
    () => roundedTrack(draft.points, draft.cornerRadius),
    [draft.points, draft.cornerRadius],
  );
  const path = geometry.path;
  return (
    <Dialog title="Custom circuit studio" wide onClose={onClose}>
      <p>
        Build a fictional circuit. Drag a point, or select it and use arrow
        keys. Geometry and preview markers belong to this studio; your
        historical replay stays separate.
      </p>
      <div className="analysis-tabs">
        <button
          className="lab-button"
          aria-pressed={workspace === "edit"}
          onClick={() => {
            setWorkspace("edit");
            setRunning(false);
          }}
        >
          Circuit editor
        </button>
        <button
          className="lab-button"
          aria-pressed={workspace === "race"}
          disabled={!valid}
          onClick={() => {
            setHasSandbox(true);
            setWorkspace("race");
            setRunning(false);
          }}
        >
          Circuit race sandbox
        </button>
      </div>
      {hasSandbox && (
        <div hidden={workspace !== "race"}>
          <CircuitSandbox
            key={draft.id}
            active={workspace === "race"}
            track={draft}
            onSaved={() => {
              setSaved(readTracks());
              setSavedId(draft.id);
            }}
          />
        </div>
      )}
      {workspace === "edit" && (
        <>
          <div className="studio-grid">
            <div className="studio-controls">
              <label className="lab-field">
                Circuit name
                <input
                  aria-label="Circuit name"
                  maxLength={48}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="lab-field">
                Corner rounding · {draft.cornerRadius}
                <input
                  aria-label="Corner rounding"
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={draft.cornerRadius}
                  onChange={(e) =>
                    setDraft({ ...draft, cornerRadius: Number(e.target.value) })
                  }
                />
                <small>
                  0 keeps sharp corners. Tight sections limit the curve
                  automatically.
                </small>
              </label>
              <div className="lab-actions">
                <button
                  className="lab-button"
                  aria-pressed={adding}
                  onClick={() => setAdding(!adding)}
                >
                  {adding ? "Finish adding points" : "Add points"}
                </button>
                <button
                  className="lab-button"
                  disabled={!draft.points.length}
                  onClick={remove}
                >
                  Remove selected point
                </button>
                <button
                  className="lab-button"
                  disabled={!past.length}
                  onClick={undo}
                >
                  Undo edit
                </button>
                <button
                  className="lab-button"
                  disabled={!future.length}
                  onClick={redo}
                >
                  Redo edit
                </button>
              </div>
              <label className="lab-field">
                Selected point
                <select
                  aria-label="Selected control point"
                  value={draft.points.length ? selected : ""}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {!draft.points.length && <option value="">No points</option>}
                  {draft.points.map((_, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                      {i === 0 ? " · start / finish" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="lab-button"
                disabled={!draft.points.length}
                onClick={() => {
                  edit(rebaseStart(draft, selected));
                  setSelected(0);
                }}
              >
                Start / finish at selected point
              </button>
              <div className="studio-sectors">
                {[0, 1].map((i) => (
                  <label className="lab-field" key={i}>
                    Sector {i + 1} ends at point
                    <select
                      aria-label={`Sector ${i + 1} end`}
                      value={draft.sectorEnds[i]}
                      onChange={(e) => {
                        const sectorEnds = [...draft.sectorEnds] as [
                          number,
                          number,
                        ];
                        sectorEnds[i] = Number(e.target.value);
                        edit({ ...draft, sectorEnds });
                      }}
                    >
                      {draft.points.map(
                        (_, n) =>
                          n > 0 && (
                            <option key={n} value={n}>
                              {n + 1}
                            </option>
                          ),
                      )}
                    </select>
                  </label>
                ))}
              </div>
              <div className="lab-actions">
                <button
                  className="lab-button"
                  onClick={() => replace(newTrack())}
                >
                  New circuit
                </button>
                <button
                  className="lab-button"
                  disabled={outline.length < 6}
                  onClick={() => {
                    const step = Math.max(1, Math.ceil(outline.length / 40));
                    const points = outline
                      .filter((_, i) => i % step === 0)
                      .map(
                        (p) =>
                          [
                            Math.round(p[0] * 0.9 + 40),
                            Math.round((p[1] * 440) / 520 + 40),
                          ] as Point,
                      );
                    replace({
                      ...newTrack(),
                      name: "My outline remix",
                      points,
                      sectorEnds: [
                        Math.floor(points.length / 3),
                        Math.floor((points.length * 2) / 3),
                      ],
                    });
                  }}
                >
                  Copy replay outline as draft
                </button>
              </div>
            </div>
            <div>
              <svg
                ref={svg}
                viewBox="0 0 800 520"
                className={`studio-canvas ${adding ? "adding" : ""}`}
                role="img"
                tabIndex={0}
                aria-label="Editable custom circuit"
                data-testid="custom-track-canvas"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  const vertex = (e.target as Element).closest("[data-vertex]");
                  if (vertex) {
                    const index = Number(vertex.getAttribute("data-vertex"));
                    setSelected(index);
                    drag.current = { index, before: draft, moved: false };
                    e.currentTarget.setPointerCapture(e.pointerId);
                  } else if (adding && draft.points.length < 120) {
                    const next = point(e);
                    edit({ ...draft, points: [...draft.points, next] });
                    setSelected(draft.points.length);
                  }
                }}
                onPointerMove={(e) => {
                  const d = drag.current;
                  if (!d) return;
                  const next = point(e);
                  d.moved = true;
                  setDraft((current) => ({
                    ...current,
                    points: current.points.map((p, i) =>
                      i === d.index ? next : p,
                    ),
                  }));
                }}
                onPointerUp={(e) => {
                  const d = drag.current;
                  if (d?.moved) {
                    setPast((p) => [...p.slice(-49), d.before]);
                    setFuture([]);
                  }
                  drag.current = null;
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
                onPointerCancel={() => {
                  if (drag.current) setDraft(drag.current.before);
                  drag.current = null;
                }}
                onLostPointerCapture={() => {
                  drag.current = null;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    remove();
                  }
                  if (
                    [
                      "ArrowLeft",
                      "ArrowRight",
                      "ArrowUp",
                      "ArrowDown",
                    ].includes(e.key) &&
                    draft.points[selected]
                  ) {
                    e.preventDefault();
                    e.stopPropagation();
                    const step = e.shiftKey ? 10 : 2,
                      p = draft.points[selected];
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
                    edit({
                      ...draft,
                      points: draft.points.map((p, i) =>
                        i === selected ? next : p,
                      ),
                    });
                  }
                }}
              >
                <defs>
                  <pattern
                    id="studio-grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M40 0H0V40"
                      fill="none"
                      stroke="currentColor"
                      opacity=".08"
                    />
                  </pattern>
                </defs>
                <rect width="800" height="520" fill="url(#studio-grid)" />
                <rect
                  x="20"
                  y="20"
                  width="760"
                  height="480"
                  rx="12"
                  fill="none"
                  stroke="currentColor"
                  opacity=".15"
                  strokeDasharray="5 8"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="currentColor"
                  opacity=".13"
                  strokeWidth="24"
                  strokeLinejoin="round"
                />
                <path
                  d={path}
                  fill="none"
                  stroke={valid ? "#52bda5" : "#ff665d"}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {draft.points.map((p, i) => (
                  <g
                    key={i}
                    data-vertex={i}
                    className="studio-vertex"
                    transform={`translate(${p})`}
                  >
                    <circle
                      r={selected === i ? 12 : 8}
                      fill={
                        selected === i
                          ? "#ff665d"
                          : i === 0
                            ? "#52bda5"
                            : "#7287a5"
                      }
                      stroke="var(--panel)"
                      strokeWidth="3"
                    />
                    <text x="14" y="-12" fontSize="14" fill="currentColor">
                      {i === 0
                        ? "START"
                        : i === draft.sectorEnds[0]
                          ? "S1"
                          : i === draft.sectorEnds[1]
                            ? "S2"
                            : i + 1}
                    </text>
                  </g>
                ))}
                {valid &&
                  Array.from({ length: cars }, (_, i) => {
                    const p = pointOnTrack(
                      geometry.route,
                      (progress + i / cars) % 1,
                    );
                    return (
                      <circle
                        key={i}
                        data-testid="preview-car"
                        cx={p[0]}
                        cy={p[1]}
                        r="6"
                        fill={
                          [
                            "#ff665d",
                            "#f5c759",
                            "#6c9dff",
                            "#c27ffc",
                            "#54d3be",
                            "#edf2f7",
                          ][i]
                        }
                        stroke="var(--panel)"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    );
                  })}
              </svg>
              <div className="studio-preview">
                <button
                  className="lab-button"
                  disabled={!valid}
                  onClick={() => setRunning(!running)}
                >
                  {running ? "Pause preview" : "Run preview"}
                </button>
                <label className="lab-field">
                  Synthetic lap (seconds)
                  <NumberField
                    label="Preview lap seconds"
                    min={30}
                    max={300}
                    value={lapSeconds}
                    onChange={setLapSeconds}
                  />
                </label>
                <label className="lab-field">
                  Markers
                  <select
                    aria-label="Preview markers"
                    value={cars}
                    onChange={(e) => setCars(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="lab-note">
                Constant-speed fictional markers. Sector markers use your
                control-point ordering, not measured sector times. Car models
                and upgrades come later.
              </p>
            </div>
          </div>
          <div className="studio-validation" aria-live="polite">
            {errors.length ? (
              <ul>
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              <p>
                Valid closed circuit · {draft.points.length} points · 3 sectors
              </p>
            )}
          </div>
          <div className="lab-actions">
            <button
              className="save-button"
              disabled={!valid}
              onClick={() => {
                try {
                  if (
                    saved.length >= 20 &&
                    !saved.some((t) => t.id === draft.id)
                  )
                    throw new Error(
                      "Twenty circuits are saved. Delete one first.",
                    );
                  const clean = parseTrack(draft);
                  persist([...saved.filter((t) => t.id !== clean.id), clean]);
                  setSavedId(clean.id);
                  setMessage("Circuit saved in this browser.");
                } catch (e) {
                  setMessage(`Could not save: ${(e as Error).message}`);
                }
              }}
            >
              Save circuit
            </button>
            <select
              className="lab-input studio-saved"
              aria-label="Saved circuits"
              value={savedId}
              onChange={(e) => setSavedId(e.target.value)}
            >
              <option value="">Saved circuits</option>
              {saved.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              className="lab-button"
              disabled={!savedId}
              onClick={() => {
                const track = saved.find((t) => t.id === savedId);
                if (track) replace(track);
              }}
            >
              Load circuit
            </button>
            <button
              className="lab-button"
              disabled={!savedId}
              onClick={() => {
                try {
                  persist(saved.filter((t) => t.id !== savedId));
                  setSavedId("");
                  setMessage(
                    "Saved circuit deleted; the current draft is still open.",
                  );
                } catch {
                  setMessage(
                    "Browser storage is unavailable. Circuit was not deleted.",
                  );
                }
              }}
            >
              Delete circuit
            </button>
            <button
              className="lab-button"
              disabled={!valid}
              onClick={() =>
                downloadJson("pitwall-circuit.json", parseTrack(draft))
              }
            >
              Export circuit JSON
            </button>
            <label className="lab-field studio-import">
              Import circuit JSON
              <input
                aria-label="Import circuit JSON"
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    if (file.size > 100000)
                      throw new Error(
                        "Choose a circuit JSON file under 100 KB.",
                      );
                    replace(parseTrack(JSON.parse(await file.text())));
                    setMessage("Imported as a draft. Save circuit to keep it.");
                  } catch (error) {
                    setMessage(`Import rejected: ${(error as Error).message}`);
                  }
                }}
              />
            </label>
          </div>
          <p role="status">{message}</p>
        </>
      )}
    </Dialog>
  );
}
