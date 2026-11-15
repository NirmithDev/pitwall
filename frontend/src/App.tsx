import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  Flag,
  Gauge,
  GitBranch,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import {
  compoundColor,
  formatClock,
  formatLap,
  pointOnTrack,
  seekToLap,
  standingsAt,
} from "./race";
import type { Bookmark, DriverState, Race } from "./race";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok)
    throw new Error(
      `Request failed (${response.status}). Check that the API is running.`,
    );
  return response.status === 204 ? (undefined as T) : await response.json();
}
function Tyre({ compound }: { compound?: string }) {
  const c = compound ?? "UNKNOWN";
  return (
    <span
      className="tyre"
      style={{ color: compoundColor[c] ?? compoundColor.UNKNOWN }}
      title={c}
    >
      {c[0]}
    </span>
  );
}
function App() {
  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [selected, setSelected] = useState(16);
  const [comparison, setComparison] = useState<number | null>(4);
  const [storage, setStorage] = useState("checking");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [tab, setTab] = useState<"events" | "bookmarks">("events");
  const [expanded, setExpanded] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    Promise.all([
      api<Race>("/api/sessions/monza-2024", { signal: controller.signal }),
      api<{ storage: string }>("/api/status", { signal: controller.signal }),
      api<Bookmark[]>("/api/sessions/monza-2024/bookmarks", {
        signal: controller.signal,
      }),
    ])
      .then(([data, status, saved]) => {
        setRace(data);
        setStorage(status.storage);
        setBookmarks(saved);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [loadKey]);
  const seek = useCallback(
    (time: number) => {
      if (race) setElapsed(Math.max(0, Math.min(race.duration, time)));
    },
    [race],
  );
  useEffect(() => {
    if (!playing || !race) return;
    let frame = 0,
      previous = performance.now();
    function tick(now: number) {
      const delta = Math.min((now - previous) / 1000, 0.25);
      previous = now;
      setElapsed((t) => Math.min(race!.duration, t + delta * speed));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, race]);
  useEffect(() => {
    if (race && elapsed >= race.duration) setPlaying(false);
  }, [elapsed, race]);
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement).closest("input,select,textarea,button") ||
        showInfo
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        setPlaying((p) => !p);
      }
      if (event.code === "ArrowRight") {
        event.preventDefault();
        seek(elapsed + 15);
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seek(elapsed - 15);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [elapsed, seek, showInfo]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  const standings = useMemo(
    () => (race ? standingsAt(race, elapsed) : []),
    [race, elapsed],
  );
  const focused = standings.find((s) => s.driver.number === selected);
  const rival = standings.find((s) => s.driver.number === comparison);
  const currentLap = Math.max(1, ...standings.map((s) => s.lap));
  const completed = standings.length > 0 && standings.some((s) => s.finished);
  const driverLaps = useMemo(
    () => race?.laps.filter((l) => l.driver === selected) ?? [],
    [race, selected],
  );
  const activeEvents =
    race?.events
      .filter((e) => e.time <= elapsed)
      .slice(-6)
      .reverse() ?? [];
  async function saveBookmark() {
    if (saving) return;
    setSaving(true);
    try {
      const bookmark = await api<Bookmark>(
        "/api/sessions/monza-2024/bookmarks",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: `Lap ${currentLap} · ${focused?.driver.code ?? "Replay"}`,
            elapsedSeconds: Math.round(elapsed * 1000) / 1000,
          }),
        },
      );
      setBookmarks((b) =>
        [...b, bookmark].sort((a, c) => a.elapsedSeconds - c.elapsedSeconds),
      );
      setTab("bookmarks");
      setNotice(
        storage === "postgresql"
          ? "Moment saved to PostgreSQL"
          : "Moment saved for this API session",
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function removeBookmark(id: string) {
    try {
      await api(`/api/sessions/monza-2024/bookmarks/${id}`, {
        method: "DELETE",
      });
      setBookmarks((b) => b.filter((x) => x.id !== id));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  if (error)
    return (
      <div className="load-screen">
        <span className="brand">
          pitwall<span>╱</span>
        </span>
        <h1>We couldn’t load the race.</h1>
        <p>{error}</p>
        <p>Start the API on port 5080, or use Docker Compose.</p>
        <button className="primary" onClick={() => setLoadKey((k) => k + 1)}>
          Try again
        </button>
      </div>
    );
  if (!race || !focused)
    return (
      <div className="load-screen">
        <span className="brand">
          pitwall<span>╱</span>
        </span>
        <Activity className="loading-icon" />
        <p>Loading the moments that mattered…</p>
      </div>
    );
  const trackPath = `M ${race.track.map((p) => p.join(",")).join(" L ")} Z`;
  const focusedStints = race.stints.filter((s) => s.driver === selected);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pitwall home">
          pitwall<span>╱</span>
        </a>
        <div className="product-label">
          RACE REPLAY LAB <span className="beta">V0.1</span>
        </div>
        <div className="topbar-right">
          <span className="historical">
            <i /> HISTORICAL REPLAY
          </span>
          <button
            className="icon-button"
            aria-label="About this replay"
            onClick={() => setShowInfo(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <main>
        <section className="race-header">
          <div>
            <div className="eyebrow">
              <span className="italy">
                <i />
                <i />
                <i />
              </span>{" "}
              ROUND 16 <span>/</span> 2024 SEASON
            </div>
            <h1>
              Monza<span className="title-dot">.</span>
            </h1>
            <p>The temple of speed. Every lap, another perspective.</p>
          </div>
          <div className="race-facts">
            <div>
              <span>RACE DISTANCE</span>
              <strong>
                53 <small>LAPS</small>
              </strong>
            </div>
            <div>
              <span>CIRCUIT LENGTH</span>
              <strong>
                5.793 <small>KM</small>
              </strong>
            </div>
            <div className="date-fact">
              <span>RACE DATE</span>
              <strong>
                01 <small>SEP 2024</small>
              </strong>
            </div>
          </div>
        </section>
        <section className="session-bar">
          <div>
            <span className="session-active">
              <Flag size={14} /> RACE SESSION
            </span>
            <span className="session-description">Italian Grand Prix</span>
          </div>
          <div className="storage-status">
            <Database size={13} />
            {storage === "postgresql"
              ? "PostgreSQL connected"
              : "Snapshot mode"}
            <span className="status-dot" />
          </div>
        </section>
        <div className={`workspace ${expanded ? "map-expanded" : ""}`}>
          <aside className="panel leaderboard">
            <div className="panel-heading">
              <h2>Classification</h2>
              <span className="mono">
                LAP <b data-testid="current-lap">{currentLap}</b> / 53
              </span>
            </div>
            <div className="table-heading">
              <span>POS / DRIVER</span>
              <span>LAST LAP</span>
              <span>TYRE</span>
            </div>
            <div className="driver-list">
              {standings.map((state, index) => (
                <button
                  key={state.driver.number}
                  className={`driver-row ${selected === state.driver.number ? "selected" : ""} ${comparison === state.driver.number ? "compared" : ""}`}
                  onClick={() => {
                    setSelected(state.driver.number);
                    if (comparison === state.driver.number) setComparison(null);
                  }}
                  aria-label={`Follow ${state.driver.firstName} ${state.driver.lastName}`}
                  aria-pressed={selected === state.driver.number}
                >
                  <span className="position mono">{index + 1}</span>
                  <span
                    className="team-stripe"
                    style={{ background: state.driver.color }}
                  />
                  <span className="driver-name">
                    <strong>{state.driver.code}</strong>
                    <small>{state.driver.team}</small>
                  </span>
                  <span className="lap-time mono">
                    {state.missing
                      ? "NO DATA"
                      : formatLap(state.lastLap?.duration)}
                  </span>
                  <Tyre compound={state.stint?.compound} />
                </button>
              ))}
            </div>
            <div className="panel-footnote">
              <span className="selected-key" /> Select a driver to inspect their
              race
            </div>
          </aside>
          <section className="panel circuit-panel">
            <div className="panel-heading">
              <h2>
                <span className="red-slash">╱</span> Circuit view
              </h2>
              <div className="circuit-actions">
                <span className="mono">
                  {playing
                    ? "PLAYING"
                    : elapsed >= race.duration
                      ? "FINISHED"
                      : "PAUSED"}
                </span>
                <button
                  className="icon-button"
                  aria-label={
                    expanded ? "Restore layout" : "Expand circuit view"
                  }
                  onClick={() => setExpanded((x) => !x)}
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
            <div className="circuit-topline">
              <span>
                <i className="status-dot" />
                {completed ? "CHEQUERED FLAG" : "RECORDED RACE"}
              </span>
              <span className="mono">{formatClock(elapsed)}</span>
            </div>
            <div className="track-stage">
              <svg
                viewBox="0 0 800 520"
                className="track-svg"
                role="img"
                aria-label="Monza circuit with interpolated driver markers"
              >
                <defs>
                  <pattern
                    id="grid"
                    width="28"
                    height="28"
                    patternUnits="userSpaceOnUse"
                  >
                    <circle cx="1" cy="1" r="0.7" fill="#252b36" />
                  </pattern>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="5" />
                  </filter>
                </defs>
                <rect width="800" height="520" fill="url(#grid)" />
                <path
                  d={trackPath}
                  fill="none"
                  stroke="#000"
                  strokeWidth="22"
                  strokeLinejoin="round"
                  opacity=".28"
                  transform="translate(0 6)"
                />
                <path
                  d={trackPath}
                  fill="none"
                  stroke="#343b49"
                  strokeWidth="15"
                  strokeLinejoin="round"
                />
                <path
                  d={trackPath}
                  fill="none"
                  stroke="#181e28"
                  strokeWidth="9"
                  strokeLinejoin="round"
                />
                <path
                  d={trackPath}
                  fill="none"
                  stroke="#596477"
                  strokeWidth=".7"
                  strokeDasharray="2 8"
                  opacity=".5"
                />
                {race.track[0] && (
                  <g
                    transform={`translate(${race.track[0][0]},${race.track[0][1]})`}
                  >
                    <path
                      d="M-8 -12 L8 12"
                      stroke="#e4e8ef"
                      strokeWidth="3"
                      strokeDasharray="3 2"
                    />
                    <text
                      x="18"
                      y="-13"
                      fill="#758092"
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      START / FINISH
                    </text>
                  </g>
                )}
                <text
                  x="70"
                  y="466"
                  fill="#3e4858"
                  fontSize="12"
                  fontFamily="monospace"
                  letterSpacing="3"
                >
                  AUTODROMO NAZIONALE MONZA
                </text>
                {standings
                  .filter((s) => s.driver.number !== selected)
                  .reverse()
                  .map((s) => (
                    <CarMarker
                      key={s.driver.number}
                      state={s}
                      track={race.track}
                      selected={false}
                      compared={s.driver.number === comparison}
                      onSelect={() => setSelected(s.driver.number)}
                    />
                  ))}
                <CarMarker
                  state={focused}
                  track={race.track}
                  selected
                  compared={false}
                  onSelect={() => {}}
                />
              </svg>
              <div className="track-caption">
                <span className="track-caption-line" />
                <span>
                  Original circuit outline · Interpolated car movement
                </span>
              </div>
            </div>
            <div className="circuit-bottom">
              <div>
                <span
                  className="follow-indicator"
                  style={{ background: focused.driver.color }}
                />{" "}
                FOLLOWING <strong>{focused.driver.code}</strong>
              </div>
              {rival && (
                <div>
                  <span
                    className="follow-indicator outline"
                    style={{ borderColor: rival.driver.color }}
                  />{" "}
                  COMPARING <strong>{rival.driver.code}</strong>
                </div>
              )}
              <button className="text-button" onClick={() => setShowInfo(true)}>
                Data notes <ChevronRight size={13} />
              </button>
            </div>
          </section>
          <aside className="right-column">
            <section className="panel driver-focus">
              <div className="panel-heading">
                <h2>Driver focus</h2>
                <span className="tiny-label">#{focused.driver.number}</span>
              </div>
              <div className="focus-name">
                <span
                  className="focus-number"
                  style={{ color: focused.driver.color }}
                >
                  {focused.driver.number}
                </span>
                <div>
                  <span>{focused.driver.firstName}</span>
                  <h3>{focused.driver.lastName}</h3>
                  <small>
                    <i style={{ background: focused.driver.color }} />
                    {focused.driver.team}
                  </small>
                </div>
              </div>
              <div className="focus-stats">
                <div>
                  <span>POSITION</span>
                  <strong>P{standings.indexOf(focused) + 1}</strong>
                </div>
                <div>
                  <span>LAST LAP</span>
                  <strong className="lap-stat">
                    {formatLap(focused.lastLap?.duration)}
                  </strong>
                </div>
              </div>
              <div className="tyre-detail">
                <Tyre compound={focused.stint?.compound} />
                <div>
                  <strong>{focused.stint?.compound ?? "Unknown"} TYRES</strong>
                  <small>
                    {focused.stint
                      ? `${Math.max(0, focused.lap - focused.stint.startLap + focused.stint.tyreAge)} laps on this set`
                      : "No stint data"}
                  </small>
                </div>
                <Gauge size={24} />
              </div>
              <label className="compare-label" htmlFor="compare">
                COMPARE WITH
              </label>
              <select
                id="compare"
                value={comparison ?? ""}
                onChange={(e) =>
                  setComparison(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">No comparison</option>
                {race.drivers
                  .filter((d) => d.number !== selected)
                  .map((d) => (
                    <option key={d.number} value={d.number}>
                      {d.code} — {d.firstName} {d.lastName}
                    </option>
                  ))}
              </select>
              {rival && (
                <div className="comparison">
                  <span>Last-lap difference</span>
                  <strong className="mono">
                    {focused.lastLap && rival.lastLap
                      ? `${focused.lastLap.duration - rival.lastLap.duration >= 0 ? "+" : ""}${(focused.lastLap.duration - rival.lastLap.duration).toFixed(3)}s`
                      : "—"}
                  </strong>
                </div>
              )}
            </section>
            <section className="panel moments-panel">
              <div className="moments-tabs">
                <button
                  className={tab === "events" ? "active" : ""}
                  onClick={() => setTab("events")}
                >
                  Race control
                </button>
                <button
                  className={tab === "bookmarks" ? "active" : ""}
                  onClick={() => setTab("bookmarks")}
                >
                  Saved <span>{bookmarks.length}</span>
                </button>
              </div>
              <div className="moment-list">
                {tab === "events" ? (
                  activeEvents.length ? (
                    activeEvents.map((event, index) => (
                      <button
                        className="moment"
                        key={`${event.time}-${index}`}
                        onClick={() => seek(event.time)}
                      >
                        <span
                          className={`event-mark ${event.flag?.includes("YELLOW") ? "yellow" : ""}`}
                        >
                          <Flag size={13} />
                        </span>
                        <div>
                          <span className="mono">
                            {formatClock(event.time)}{" "}
                            {event.lap ? `· LAP ${event.lap}` : ""}
                          </span>
                          <p>{event.message}</p>
                        </div>
                        <ChevronRight size={13} />
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">
                      <Flag size={22} />
                      <p>No race-control messages yet.</p>
                      <small>They’ll appear as the replay progresses.</small>
                    </div>
                  )
                ) : bookmarks.length ? (
                  bookmarks.map((bookmark) => (
                    <div className="bookmark-row" key={bookmark.id}>
                      <button onClick={() => seek(bookmark.elapsedSeconds)}>
                        <span className="mono">
                          {formatClock(bookmark.elapsedSeconds)}
                        </span>
                        <strong>{bookmark.label}</strong>
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${bookmark.label}`}
                        onClick={() => removeBookmark(bookmark.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <BookmarkPlus size={22} />
                    <p>Keep the interesting moments.</p>
                    <small>Use “Save moment” during playback.</small>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
        <section className="panel playback-panel">
          <div className="playback-top">
            <div className="playback-buttons">
              <button
                className="icon-button"
                aria-label="Restart replay"
                onClick={() => {
                  seek(0);
                  setPlaying(false);
                }}
              >
                <RotateCcw size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Previous lap"
                onClick={() =>
                  seek(seekToLap(race, Math.max(1, currentLap - 1)))
                }
              >
                <SkipBack size={18} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause replay" : "Play replay"}
                onClick={() => {
                  if (elapsed >= race.duration) seek(0);
                  setPlaying((p) => !p);
                }}
              >
                {playing ? (
                  <Pause size={19} fill="currentColor" />
                ) : (
                  <Play size={19} fill="currentColor" />
                )}
              </button>
              <button
                className="icon-button"
                aria-label="Next lap"
                onClick={() =>
                  seek(
                    seekToLap(race, Math.min(race.totalLaps, currentLap + 1)),
                  )
                }
              >
                <SkipForward size={18} />
              </button>
              <label className="speed-select">
                <span className="sr-only">Playback speed</span>
                <select
                  aria-label="Playback speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {[1, 5, 10, 25, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
              <span className="time-display mono" data-testid="elapsed-time">
                {formatClock(elapsed)}{" "}
                <small>/ {formatClock(race.duration)}</small>
              </span>
            </div>
            <button
              className="save-button"
              onClick={saveBookmark}
              disabled={saving}
            >
              {saving ? <Timer size={15} /> : <BookmarkPlus size={15} />}{" "}
              {saving ? "Saving…" : "Save moment"}
            </button>
          </div>
          <div className="scrubber-wrap">
            <input
              className="scrubber"
              aria-label="Race timeline"
              type="range"
              min="0"
              max={race.duration}
              step="0.1"
              value={elapsed}
              onChange={(e) => seek(Number(e.target.value))}
              style={
                {
                  "--progress": `${(elapsed / race.duration) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div className="lap-ticks">
              {[1, 10, 20, 30, 40, 53].map((lap) => (
                <button key={lap} onClick={() => seek(seekToLap(race, lap))}>
                  LAP {lap.toString().padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="panel strategy-panel">
          <div className="panel-heading">
            <h2>
              <GitBranch size={15} /> Tyre strategy{" "}
              <span className="strategy-driver">{focused.driver.code}</span>
            </h2>
            <span className="tiny-label">RECORDED STINTS · FULL RACE</span>
          </div>
          <div className="stint-row">
            <span className="mono">{focused.driver.code}</span>
            <div className="stint-bars">
              {focusedStints.map((stint) => (
                <button
                  key={stint.number}
                  style={{
                    left: `${((stint.startLap - 1) / race.totalLaps) * 100}%`,
                    width: `${((Math.min(stint.endLap, race.totalLaps) - stint.startLap + 1) / race.totalLaps) * 100}%`,
                    background: compoundColor[stint.compound] ?? "#768093",
                  }}
                  onClick={() => seek(seekToLap(race, stint.startLap))}
                  aria-label={`${stint.compound} stint, laps ${stint.startLap} to ${stint.endLap}`}
                >
                  <b>{stint.compound[0]}</b>
                  <span>{stint.endLap - stint.startLap + 1} laps</span>
                </button>
              ))}
              <i
                className="stint-playhead"
                style={{
                  left: `${Math.min(100, ((focused.lap - 1 + focused.progress) / race.totalLaps) * 100)}%`,
                }}
              />
            </div>
            <span className="tiny-label">53 LAPS</span>
          </div>
          <div className="strategy-bottom">
            <span>
              <Activity size={12} /> {driverLaps.length} timed laps available
            </span>
            <span>
              Click a stint to jump to its start <ArrowRight size={12} />
            </span>
          </div>
        </section>
        <footer>
          <span>BUILT FOR THE MOMENTS BETWEEN THE LAPS.</span>
          <div>
            <a href={race.source.url} target="_blank" rel="noreferrer">
              Data: OpenF1 ↗
            </a>
            <span>Independent fan project · Not affiliated with Formula 1</span>
          </div>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {showInfo && (
        <div className="modal-backdrop" onClick={() => setShowInfo(false)}>
          <section
            className="info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="data-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowInfo(false);
              if (e.key === "Tab") {
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                if (buttons.length === 1) {
                  e.preventDefault();
                  buttons[0].focus();
                }
              }
            }}
          >
            <div className="panel-heading">
              <h2 id="data-title">A replay, with honest boundaries.</h2>
              <button
                className="icon-button"
                autoFocus
                aria-label="Close data notes"
                onClick={() => setShowInfo(false)}
              >
                <X size={19} />
              </button>
            </div>
            <p>
              Lap durations, position changes, tyre stints, and race-control
              messages come from the historical OpenF1 session{" "}
              <strong>9590</strong> (Monza, 1 September 2024).
            </p>
            <p>
              The circuit outline uses coordinates from one recorded lap.{" "}
              <strong>
                Car markers move uniformly around that outline using each
                driver's lap time.
              </strong>{" "}
              They do not show GPS positions, braking, corner speed, or measured
              on-track separation.
            </p>
            <p>
              Classification follows the latest recorded position messages.
              Messages can arrive at different times; temporary ties are ordered
              by lap progress. Missing timed laps can cause a marker to pause.
              “Last-lap difference” compares each driver’s most recent completed
              lap, which may be different lap numbers.
            </p>
            <p>
              The tyre strategy strip intentionally shows the full race,
              including future pit stops. What-if decisions and car upgrades are
              future features.
            </p>
            <p>
              {storage === "postgresql"
                ? "Bookmarks persist in PostgreSQL."
                : "Snapshot mode: bookmarks are in API memory and disappear when the backend restarts."}{" "}
              Bookmarks are shared by all visitors to this development instance;
              accounts are not implemented.
            </p>
            <p className="info-meta">
              Imported{" "}
              {new Date(race.source.importedAt).toLocaleDateString("en-CA", {
                timeZone: "UTC",
              })}
              . Educational prototype. Commercial data and branding permissions
              must be resolved before monetization.
            </p>
            <div className="keyboard-hints">
              <span>
                <kbd>Space</kbd> Play / pause
              </span>
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> Seek 15 seconds
              </span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function CarMarker({
  state,
  track,
  selected,
  compared,
  onSelect,
}: {
  state: DriverState;
  track: [number, number][];
  selected: boolean;
  compared: boolean;
  onSelect: () => void;
}) {
  const [x, y] = pointOnTrack(track, state.progress);
  return (
    <g
      transform={`translate(${x},${y})`}
      opacity={state.missing ? 0.35 : 1}
      className="car-marker"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-label={`Follow ${state.driver.code} on circuit`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {selected && (
        <circle
          r="16"
          fill={state.driver.color}
          opacity=".3"
          filter="url(#glow)"
        />
      )}
      {(selected || compared) && (
        <circle
          r={selected ? 12 : 10}
          fill="none"
          stroke={state.driver.color}
          strokeWidth="1.5"
          strokeDasharray={compared ? "3 3" : undefined}
        />
      )}
      <circle
        r={selected ? 6 : 4}
        fill={state.driver.color}
        stroke="#10151d"
        strokeWidth="2"
      />
      {(selected || compared) && (
        <g transform="translate(16,-24)">
          <rect
            x="-3"
            y="-12"
            width="43"
            height="21"
            rx="4"
            fill="#111824"
            stroke={state.driver.color}
            strokeOpacity=".5"
          />
          <text
            x="18"
            y="2"
            fill="#f4f5f8"
            textAnchor="middle"
            fontFamily="monospace"
            fontSize="11"
          >
            {state.driver.code}
          </text>
        </g>
      )}
    </g>
  );
}
export default App;
