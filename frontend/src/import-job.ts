import { request } from "./RaceLibrary";
// Used when a shared replay link opens a session not yet cached on this server.
export async function ensureTiming(
  id: string,
  signal: AbortSignal,
): Promise<void> {
  const path = `/api/sessions/${id}/import`;
  let job = await request<{ status: string; error?: string }>(path, {
    method: "POST",
    signal,
  });
  const deadline = Date.now() + 9 * 60 * 1000;
  while (job.status === "queued" || job.status === "running") {
    if (Date.now() > deadline)
      throw new Error(
        "This replay is still importing. Try again shortly to reconnect.",
      );
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, 1500);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    job = await request(path, { signal });
  }
  if (job.status !== "completed")
    throw new Error(
      job.error ?? "This race could not be imported. Please try again later.",
    );
}
