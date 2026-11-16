import { useEffect, useRef, useState } from "react";
import { request } from "./RaceLibrary";
import type { Race } from "./race";

type Job = { status: string; error: string | null };

export default function LocationImport({ raceId, onLoaded }: {
  raceId: string;
  onLoaded: (race: Race) => void;
}) {
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);

  async function load() {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const timeout = setTimeout(() => c.abort(), 9 * 60 * 1000);
    setError("");
    setStage("Requesting recorded positions…");
    try {
      let job = await request<Job>(`/api/sessions/${raceId}/locations`, { method: "POST", signal: c.signal });
      while (job.status === "queued" || job.status === "running") {
        setStage(job.status === "queued" ? "Queued · you can keep watching" : "Loading recorded positions · this can take several minutes");
        await new Promise<void>((resolve, reject) => {
          const abort = () => { clearTimeout(timer); reject(new Error("Import wait cancelled")); };
          const timer = setTimeout(() => { c.signal.removeEventListener("abort", abort); resolve(); }, 1500);
          c.signal.addEventListener("abort", abort, { once: true });
          if (c.signal.aborted) abort();
        });
        job = await request<Job>(`/api/sessions/${raceId}/locations`, { signal: c.signal });
      }
      if (job.status !== "completed") throw new Error(job.error ?? "Recorded positions are unavailable. Try again later.");
      const race = await request<Race>(`/api/sessions/${raceId}`, { signal: c.signal });
      if (!race.locations?.traces.some(t => t.samples.length > 1)) throw new Error("No usable recorded positions were returned. You can retry later.");
      if (!c.signal.aborted) onLoaded(race);
    } catch (e) {
      if (!c.signal.aborted) setError((e as Error).message);
      else if (controller.current === c) setError("Stopped waiting. The server may still be loading; retry to reconnect.");
    } finally {
      clearTimeout(timeout);
      if (controller.current === c) setStage("");
    }
  }
  return <div className="location-import">
    <button className="secondary-button" disabled={!!stage} onClick={load}>{stage ? "Loading positions…" : error ? "Retry recorded positions" : "Load recorded positions"}</button>
    <span role={error ? "alert" : "status"}>{error || stage || "Approximate recorded positions, when the provider has coverage."}</span>
  </div>;
}
