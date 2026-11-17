import { useEffect, useRef, useState } from "react";
import { request } from "./api";
import type { Race } from "./race";
type Job = { status: string; error: string | null };
export default function EnrichmentImport({
  raceId,
  kind,
  onLoaded,
  refresh = false,
}: {
  raceId: string;
  kind: "locations" | "analysis";
  onLoaded: (race: Race) => void;
  refresh?: boolean;
}) {
  const [stage, setStage] = useState(""),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  const analysis = kind === "analysis",
    name = analysis ? "measured analysis" : "recorded positions";
  async function load() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const timeout = setTimeout(() => c.abort(), 9 * 60 * 1000);
    setError("");
    setStage(`Requesting ${name}…`);
    try {
      const path = `/api/sessions/${raceId}/${kind}`;
      let job = await request<Job>(path + (refresh ? "?refresh=true" : ""), {
        method: "POST",
        signal: c.signal,
      });
      while (job.status === "queued" || job.status === "running") {
        setStage(
          job.status === "queued"
            ? "Queued · import continues in the background"
            : `Loading ${name} · this can take several minutes`,
        );
        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(new Error("Import wait cancelled"));
          };
          const timer = setTimeout(() => {
            c.signal.removeEventListener("abort", abort);
            resolve();
          }, 1500);
          c.signal.addEventListener("abort", abort, { once: true });
          if (c.signal.aborted) abort();
        });
        job = await request<Job>(path, { signal: c.signal });
      }
      if (job.status !== "completed")
        throw new Error(
          job.error ?? `${name} is unavailable. Try again later.`,
        );
      const race = await request<Race>(`/api/sessions/${raceId}`, {
        signal: c.signal,
      });
      const usable = analysis
        ? race.analysis?.laps.some((l) => l.sectors.some((s) => s !== null))
        : race.locations?.traces.some((t) => t.samples.length > 1);
      if (!usable)
        throw new Error(`No usable ${name} was returned. You can retry later.`);
      if (!c.signal.aborted) onLoaded(race);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
      else if (controller.current === c)
        setError(
          "Stopped waiting. The server may still be loading; retry to reconnect.",
        );
    } finally {
      clearTimeout(timeout);
      if (controller.current === c) setStage("");
    }
  }
  return (
    <div className="location-import">
      <button className="secondary-button" disabled={!!stage} onClick={load}>
        {stage
          ? analysis
            ? "Loading analysis…"
            : "Loading positions…"
          : error
            ? `Retry ${name}`
            : `${refresh ? "Refresh" : "Load"} ${name}`}
      </button>
      <span role={error ? "alert" : "status"}>
        {error ||
          stage ||
          (refresh
            ? "Current cached data stays available while refreshing."
            : analysis
              ? "Measured sectors and pit-lane timing, when the provider has coverage."
              : "Approximate recorded positions, when the provider has coverage.")}
      </span>
    </div>
  );
}
