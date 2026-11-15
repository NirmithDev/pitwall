import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import type { Race, Bookmark } from "./race";
export interface Session {
  id: string;
  sessionKey: number;
  title: string;
  circuit: string;
  country: string;
  countryCode: string;
  year: number;
  date: string;
  kind: string;
  cached: boolean;
}
export interface Catalog {
  refreshedAt: string;
  refreshing: boolean;
  lastError: string | null;
  sessions: Session[];
}
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      body.message ?? `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export default function RaceLibrary({
  initial,
  currentId,
  onClose,
  onLoaded,
  onCatalog,
}: {
  initial: Catalog | null;
  currentId: string;
  onClose: () => void;
  onLoaded: (race: Race, bookmarks: Bookmark[]) => void;
  onCatalog: (catalog: Catalog) => void;
}) {
  const [catalog, setCatalog] = useState(initial),
    [year, setYear] = useState("all"),
    [search, setSearch] = useState("");
  const [kind, setKind] = useState("all"),
    [loading, setLoading] = useState<string | null>(null),
    [stage, setStage] = useState(""),
    [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    request<Catalog>("/api/sessions", { signal: c.signal })
      .then((data) => {
        setCatalog(data);
        onCatalog(data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => {
      c.abort();
      controller.current?.abort();
      refreshController.current?.abort();
    };
  }, []);
  async function load(session: Session) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setError("");
    setLoading(session.id);
    try {
      if (!session.cached) {
        setStage("Requesting historical timing from OpenF1…");
        let job = await request<{ status: string; error?: string }>(
          `/api/sessions/${session.id}/import`,
          { method: "POST", signal: c.signal },
        );
        const deadline = Date.now() + 9 * 60 * 1000;
        while (job.status !== "completed") {
          if (job.status === "failed")
            throw new Error(
              job.error ?? "This session has no usable replay yet.",
            );
          if (Date.now() > deadline)
            throw new Error(
              "The import is taking longer than expected. Reopen the library shortly; it may still finish in the background.",
            );
          setStage(
            job.status === "queued"
              ? "Queued behind another import. You can close this window; the import will continue."
              : "Downloading laps, classification, stints, and circuit coordinates. First-time imports can take a minute or longer.",
          );
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              c.signal.removeEventListener("abort", abort);
              resolve();
            }, 1500);
            const abort = () => {
              clearTimeout(timer);
              reject(new DOMException("Cancelled", "AbortError"));
            };
            c.signal.addEventListener("abort", abort, { once: true });
          });
          job = await request(`/api/sessions/${session.id}/import`, {
            signal: c.signal,
          });
        }
      }
      setStage("Opening replay…");
      const [race, saved] = await Promise.all([
        request<Race>(`/api/sessions/${session.id}`, { signal: c.signal }),
        request<Bookmark[]>(`/api/sessions/${session.id}/bookmarks`, {
          signal: c.signal,
        }),
      ]);
      if (c.signal.aborted) return;
      onLoaded(race, saved);
      onClose();
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (controller.current === c) setLoading(null);
    }
  }
  async function refresh() {
    refreshController.current?.abort();
    const c = new AbortController();
    refreshController.current = c;
    setRefreshing(true);
    setError("");
    try {
      await request("/api/sessions/refresh", {
        method: "POST",
        signal: c.signal,
      });
      for (let i = 0; i < 180; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        if (c.signal.aborted) return;
        const next = await request<Catalog>("/api/sessions", {
          signal: c.signal,
        });
        setCatalog(next);
        onCatalog(next);
        if (!next.refreshing) {
          if (next.lastError) setError(next.lastError);
          break;
        }
      }
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
    } finally {
      if (!c.signal.aborted) setRefreshing(false);
    }
  }
  const years = [...new Set(catalog?.sessions.map((s) => s.year) ?? [])].sort(
    (a, b) => b - a,
  );
  const sessions =
    catalog?.sessions.filter(
      (s) =>
        (year === "all" || s.year === Number(year)) &&
        (kind === "all" || s.kind === kind) &&
        `${s.circuit} ${s.country} ${s.title}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const controls = e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input,select",
            );
            const first = controls[0],
              last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="library-header">
          <div>
            <span className="eyebrow">THE HISTORICAL ARCHIVE</span>
            <h2 id="library-title">
              Pick your race<span>.</span>
            </h2>
            <p>
              {catalog?.sessions.length ?? "…"} completed Grand Prix & Sprint
              sessions · 2023 onward
            </p>
          </div>
          <button
            className="icon-button"
            autoFocus
            aria-label="Close race library"
            onClick={onClose}
          >
            <X size={21} />
          </button>
        </div>
        <div className="library-filters">
          <label className="library-search">
            <Search size={16} />
            <input
              aria-label="Search races"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search circuit or country…"
            />
          </label>
          <select
            aria-label="Season"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="all">All seasons</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            aria-label="Session type"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">Race + Sprint</option>
            <option value="Race">Grand Prix</option>
            <option value="Sprint">Sprint</option>
          </select>
          <button
            className="refresh-button"
            disabled={refreshing}
            onClick={refresh}
          >
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing…" : "Check for new races"}
          </button>
        </div>
        {loading && (
          <div className="import-status" role="status">
            <LoaderCircle className="spin" size={19} />
            <div>
              <strong>
                {catalog?.sessions.find((s) => s.id === loading)?.circuit}
              </strong>
              <p>{stage}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="library-error" role="alert">
            {error}
          </div>
        )}
        <div className="race-grid">
          {sessions.map((s) => (
            <button
              className={`race-card ${s.id === currentId ? "current" : ""}`}
              key={s.id}
              disabled={loading !== null}
              onClick={() => load(s)}
              aria-label={`Load ${s.circuit} ${s.year} ${s.kind}`}
            >
              <div className="race-card-top">
                <span className="mono">
                  {s.year} / {s.kind.toUpperCase()}
                </span>
                {s.id === catalog?.sessions[0]?.id ? (
                  <span className="latest-badge">LATEST AVAILABLE</span>
                ) : s.cached ? (
                  <span className="cached-badge">
                    <Check size={11} /> CACHED
                  </span>
                ) : (
                  <Download size={12} />
                )}
              </div>
              <h3>{s.circuit}</h3>
              <p>{s.country}</p>
              <div className="race-card-bottom">
                <time dateTime={s.date}>
                  {new Date(s.date + "T12:00:00Z").toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </time>
                <span>
                  {s.id === currentId
                    ? "Currently open"
                    : s.cached
                      ? "Open replay"
                      : "Load replay"}
                  <ArrowRight size={13} />
                </span>
              </div>
            </button>
          ))}
        </div>
        {!sessions.length && (
          <div className="empty-state">
            <p>No races match those filters.</p>
          </div>
        )}
        <div className="library-footer">
          <span>
            Completed sessions listed by OpenF1; usable timing varies. Replays
            are cached after their first import.
          </span>
          <span>
            {catalog
              ? `Catalog checked ${new Date(catalog.refreshedAt).toLocaleString()}`
              : ""}
          </span>
        </div>
      </section>
    </div>
  );
}
