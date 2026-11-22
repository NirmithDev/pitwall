import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {version as appVersion} from "../package.json";
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
  seekToLap,
  standingsAt,
} from "./race";
import type { Bookmark, Race } from "./race";
import CircuitMap from "./CircuitMap";
import ThemeToggle from "./ThemeToggle";
import Dialog from "./Dialog";
import ToolBoundary from "./ToolBoundary";
import { request as api } from "./api";
const RaceLibrary = lazy(() => import("./RaceLibrary"));
const ShareMoment = lazy(() => import("./ShareMoment"));
const TrackEditor = lazy(() => import("./TrackEditor"));
const StrategyLab = lazy(() => import("./StrategyLab"));
const RaceAnalysis = lazy(() => import("./RaceAnalysis"));
const PaceBacktest = lazy(() => import("./PaceBacktest"));
const MultiplayerRooms = lazy(() => import("./MultiplayerRooms"));
const DriverRecruitment = lazy(() => import("./DriverRecruitment"));
import "./lab.css";
import { momentLink, readMoment } from "./replay-link";
import { ensureTiming } from "./import-job";
import type { PositionSource } from "./locations";
import type { Catalog } from "./RaceLibrary";

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
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [positionSource, setPositionSource] = useState<PositionSource>("lap");
  const [showTrackEditor, setShowTrackEditor] = useState(false);
  const [raceOnReplay, setRaceOnReplay] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showRooms, setShowRooms] = useState(() => new URLSearchParams(location.search).has("room"));
  const [showRecruitment, setShowRecruitment] = useState(false);
  const activeTool = showRecruitment ? "recruitment" : showRooms ? "rooms" : showLibrary
    ? "library"
    : shareLink
      ? "share"
      : showTrackEditor
        ? "studio"
        : showStrategy
          ? "strategy"
          : showAnalysis
            ? "analysis"
            : showBacktest
              ? "backtest"
              : "none";
  const closeTools = () => {
    setShowRecruitment(false);
    setShowRooms(false);
    setShowLibrary(false);
    setShareLink(null);
    setShowTrackEditor(false);
    setShowStrategy(false);
    setShowAnalysis(false);
    setShowBacktest(false);
  };
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<Catalog>("/api/sessions", { signal: controller.signal })
      .then(async (library) => {
        setCatalog(library);
        const requested = new URLSearchParams(window.location.search).get(
          "race",
        );
        const id =
          library.sessions.find((s) => s.id === requested)?.id ??
          library.sessions.find((s) => s.cached)?.id ??
          "monza-2024";
        if (library.sessions.some((s) => s.id === id && !s.cached))
          await ensureTiming(id, controller.signal);
        return Promise.all([
          api<Race>(`/api/sessions/${id}`, { signal: controller.signal }),
          api<{ storage: string }>("/api/status", {
            signal: controller.signal,
          }),
          api<Bookmark[]>(`/api/sessions/${id}/bookmarks`, {
            signal: controller.signal,
          }),
        ]);
      })
      .then(([data, status, saved]) => {
        setRace(data);
        setStorage(status.storage);
        setBookmarks(saved);
        const params = new URLSearchParams(window.location.search);
        const moment = readMoment(
          params.get("race") === data.id ? params : new URLSearchParams(),
          data,
        );
        setElapsed(moment.elapsed);
        setSelected(moment.driver);
        setComparison(moment.comparison);
        setSpeed(moment.speed);
        setPositionSource(moment.source);
        setPlaying(false);
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
        showInfo ||
        showLibrary ||
        shareLink ||
        showTrackEditor ||
        showStrategy ||
        showAnalysis ||
        showBacktest ||
        showRooms ||
        showRecruitment ||
        document.querySelector("dialog[open]")
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
  }, [
    elapsed,
    seek,
    showInfo,
    showLibrary,
    shareLink,
    showTrackEditor,
    showStrategy,
    showAnalysis,
    showBacktest,
    showRooms,
    showRecruitment,
  ]);
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
        `/api/sessions/${race!.id}/bookmarks`,
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
      await api(`/api/sessions/${race!.id}/bookmarks/${id}`, {
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
  const focusedStints = race.stints.filter((s) => s.driver === selected);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pitwall home">
          pitwall<span>╱</span>
        </a>
        <div className="product-label">
          RACE REPLAY LAB <span className="beta">V{appVersion}</span>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
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
              <span className="country-chip">
                {race.countryCode ?? race.country.toUpperCase()}
              </span>
              {race.kind === "Sprint" ? "SPRINT" : "GRAND PRIX"} <span>/</span>{" "}
              {race.year} SEASON
            </div>
            <h1>
              {race.circuit}
              <span className="title-dot">.</span>
            </h1>
            <p>{race.country}. Every lap, another perspective.</p>
          </div>
          <div className="race-facts">
            <div>
              <span>RACE DISTANCE</span>
              <strong>
                {race.totalLaps} <small>LAPS</small>
              </strong>
            </div>
            <div>
              <span>{race.distanceKm ? "CIRCUIT LENGTH" : "TIMED LAPS"}</span>
              <strong>
                {race.distanceKm ?? race.laps.length}{" "}
                <small>{race.distanceKm ? "KM" : "RECORDED"}</small>
              </strong>
            </div>
            <div className="date-fact">
              <span>RACE DATE</span>
              <strong>
                {race.date.slice(-2)}{" "}
                <small>
                  {new Date(race.date + "T12:00:00Z")
                    .toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })
                    .toUpperCase()}
                </small>
              </strong>
            </div>
          </div>
        </section>
        <section className="library-bar">
          <div>
            <span className="library-count">
              {catalog?.sessions.length ?? "…"} SESSIONS
            </span>
            <span>2023 → {catalog?.sessions[0]?.year ?? race.year}</span>
            <span className="library-latest">
              Latest: {catalog?.sessions[0]?.circuit ?? race.circuit} ·{" "}
              {catalog?.sessions[0]?.date ?? race.date}
            </span>
          </div>
          <button
            className="save-button"
            onClick={() => {
              setPlaying(false);
              setShowLibrary(true);
            }}
          >
            Browse races <ChevronRight size={14} />
          </button>
        </section>
        <section className="session-bar">
          <div>
            <span className="session-active">
              <Flag size={14} /> {race.kind === "Sprint" ? "SPRINT" : "RACE"}{" "}
              SESSION
            </span>
            <span className="session-description">{race.title}</span>
          </div>
          <div className="storage-status">
            <Database size={13} />
            {storage === "postgresql"
              ? "PostgreSQL connected"
              : "Snapshot mode"}
            <span className="status-dot" />
          </div>
        </section>
        <div className="lab-launcher">
          <span>REPLAY TOOLS</span>
          <button disabled={race.track.length<6} onClick={()=>{setPlaying(false);setRaceOnReplay(true);setShowTrackEditor(true);}}>Race this circuit</button>
          <button onClick={() => {setPlaying(false);setShowRecruitment(true);}}>Driver recruitment</button>
          <button onClick={() => {setPlaying(false);setShowRooms(true);}}>Multiplayer rooms</button>
          <button
            onClick={() => {
              setPlaying(false);
              setShowBacktest(true);
            }}
          >
            Pace forecast backtest
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setShowAnalysis(true);
            }}
          >
            Race analysis desk
          </button>
          <button
            onClick={() =>
              setShareLink(
                momentLink(window.location.href, race.id, {
                  elapsed,
                  driver: selected,
                  comparison,
                  speed,
                  source: positionSource,
                }),
              )
            }
          >
            Share moment
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setRaceOnReplay(false);
              setShowTrackEditor(true);
            }}
          >
            Custom circuit studio
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setShowStrategy(true);
            }}
          >
            Strategy what-if lab
          </button>
        </div>
        <div className={`workspace ${expanded ? "map-expanded" : ""}`}>
          <aside className="panel leaderboard">
            <div className="panel-heading">
              <h2>Classification</h2>
              <span className="mono">
                LAP <b data-testid="current-lap">{currentLap}</b> /{" "}
                {race.totalLaps}
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
            <CircuitMap
              key={race.id}
              race={race}
              standings={standings}
              focused={focused}
              comparison={comparison}
              elapsed={elapsed}
              source={positionSource}
              onSourceChange={setPositionSource}
              onUpgrade={(data) => {
                setRace((current) =>
                  current?.id === data.id ? data : current,
                );
                setNotice(
                  "Recorded positions loaded. Gaps reflect missing provider coverage.",
                );
              }}
              onSelect={(number) => {
                setSelected(number);
                if (comparison === number) setComparison(null);
              }}
            />
            <div className="circuit-bottom">
              <div>
                <span
                  className="follow-indicator"
                  style={{ background: focused.driver.color }}
                />{" "}
                SELECTED <strong>{focused.driver.code}</strong>
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
              step="any"
              value={elapsed}
              onChange={(e) => seek(Number(e.target.value))}
              style={
                {
                  "--progress": `${(elapsed / race.duration) * 100}%`,
                } as React.CSSProperties
              }
            />
            <div className="lap-ticks">
              {[
                ...new Set([
                  1,
                  ...[0.2, 0.4, 0.6, 0.8].map((f) =>
                    Math.max(1, Math.round(race.totalLaps * f)),
                  ),
                  race.totalLaps,
                ]),
              ].map((lap) => (
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
            <span className="tiny-label">{race.totalLaps} LAPS</span>
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
      <ToolBoundary key={activeTool} onClose={closeTools}>
        <Suspense
          fallback={
            <Dialog
              title="Opening replay tool"
              onClose={() => {
                setShowLibrary(false);
                setShareLink(null);
                setShowTrackEditor(false);
                setShowStrategy(false);
                setShowAnalysis(false);
                setShowBacktest(false);
              }}
            >
              <p role="status">Loading replay tool…</p>
            </Dialog>
          }
        >
          {showLibrary && (
            <RaceLibrary
              initial={catalog}
              currentId={race.id}
              onClose={() => setShowLibrary(false)}
              onCatalog={setCatalog}
              onLoaded={(data, saved) => {
                setRace(data);
                setPositionSource(
                  data.locations?.traces.some((t) => t.samples.length > 1)
                    ? "recorded"
                    : "lap",
                );
                setBookmarks(saved);
                setElapsed(0);
                setPlaying(false);
                const driver = data.drivers.some((d) => d.number === 16)
                  ? 16
                  : data.drivers[0].number;
                setSelected(driver);
                setComparison(
                  data.drivers.some((d) => d.number === 4) && driver !== 4
                    ? 4
                    : null,
                );
                setTab("events");
                setExpanded(false);
                setNotice(`${data.circuit} ${data.year} loaded`);
                const url = new URL(window.location.href);
                url.searchParams.set("race", data.id);
                ["t", "driver", "compare", "speed", "source"].forEach((key) =>
                  url.searchParams.delete(key),
                );
                window.history.replaceState({}, "", url);
                setCatalog((c) =>
                  c
                    ? {
                        ...c,
                        sessions: c.sessions.map((s) =>
                          s.id === data.id ? { ...s, cached: true } : s,
                        ),
                      }
                    : c,
                );
              }}
            />
          )}
          {shareLink && (
            <ShareMoment link={shareLink} onClose={() => setShareLink(null)} />
          )}
          {showTrackEditor && (
            <TrackEditor
              outline={race.track}
              replayLabel={`${race.circuit} ${race.year}`}
              startOnReplayCircuit={raceOnReplay}
              onClose={() => setShowTrackEditor(false)}
            />
          )}
          {showRooms && <MultiplayerRooms onClose={() => setShowRooms(false)} />}
          {showRecruitment && <DriverRecruitment onClose={() => setShowRecruitment(false)} />}
          {showAnalysis && (
            <RaceAnalysis
              race={race}
              selected={selected}
              comparison={comparison}
              elapsed={elapsed}
              onClose={() => setShowAnalysis(false)}
              onUpgrade={(data) =>
                setRace((current) => (current?.id === data.id ? data : current))
              }
              onSeek={(number, time) => {
                setSelected(number);
                if (comparison === number) setComparison(null);
                seek(time);
                setPlaying(false);
                setShowAnalysis(false);
              }}
            />
          )}
          {showBacktest && (
            <PaceBacktest
              race={race}
              selected={selected}
              elapsed={elapsed}
              onClose={() => setShowBacktest(false)}
              onSeek={(number, time) => {
                setSelected(number);
                if (comparison === number) setComparison(null);
                seek(time);
                setPlaying(false);
                setShowBacktest(false);
              }}
            />
          )}
          {showStrategy && (
            <StrategyLab
              race={race}
              selected={selected}
              elapsed={elapsed}
              onClose={() => setShowStrategy(false)}
            />
          )}
        </Suspense>
      </ToolBoundary>
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
              <strong>{race.sessionKey ?? 9590}</strong> ({race.circuit},{" "}
              {race.date}).
            </p>
            <p>
              The circuit outline uses coordinates from one recorded lap. Use{" "}
              <strong>Position source</strong> to choose recorded positions when
              available, or the lap estimate. OpenF1 coordinates are
              approximate, not lane-accurate GPS. Recorded mode smooths between
              retained samples only when they are at most 2.5 seconds apart;
              markers disappear where coverage is missing. Lap estimate moves
              uniformly using lap duration and is not measured on-track
              separation.
            </p>
            <p>
              Classification follows the latest recorded position messages.
              Messages can arrive at different times; temporary ties are ordered
              by lap progress. In lap-estimate mode, missing timed laps can
              pause a marker. “Last-lap difference” compares each driver’s most
              recent completed lap, which may be different lap numbers.
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
export default App;
