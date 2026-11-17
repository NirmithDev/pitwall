import { calibratePace } from "./strategy";
import { median } from "./analysis";
import type { Race } from "./race";
export interface BacktestRow {
  lap: number;
  actual: number;
  flat: number;
  trend: number;
}
export interface BacktestResult {
  reason: string | null;
  training: { lap: number; duration: number }[];
  rows: BacktestRow[];
  pace: number | null;
  slope: number | null;
  flat: { mae: number; bias: number; totalError: number } | null;
  trend: { mae: number; bias: number; totalError: number } | null;
}
export function paceBacktest(
  race: Race,
  driver: number,
  anchor: number,
  horizon: number,
): BacktestResult {
  const result: BacktestResult = {
    reason: null,
    training: [],
    rows: [],
    pace: null,
    slope: null,
    flat: null,
    trend: null,
  };
  if (
    !Number.isInteger(anchor) ||
    !Number.isInteger(horizon) ||
    anchor < 5 ||
    horizon < 1 ||
    horizon > 15 ||
    anchor + horizon > race.totalLaps
  )
    return {
      ...result,
      reason: "Choose a valid branch and a 1–15 lap holdout within the race.",
    };
  const calibration = calibratePace(race, driver, anchor);
  const laps = race.laps.filter((l) => l.driver === driver);
  const stint = race.stints
    .filter(
      (s) => s.driver === driver && s.startLap <= anchor && s.endLap >= anchor,
    )
    .at(-1);
  const lastOut = Math.max(
    1,
    ...laps.filter((l) => l.pitOut && l.lap <= anchor).map((l) => l.lap),
  );
  const start = Math.max(stint?.startLap ?? 1, lastOut);
  const training = laps
    .filter((l) => calibration?.laps.includes(l.lap) && l.lap >= start)
    .map((l) => ({ lap: l.lap, duration: l.duration }));
  result.training = training;
  if (training.length < 5)
    return {
      ...result,
      reason:
        "At least five usable completed training laps in the current stint are required.",
    };
  const heldout = Array.from({ length: horizon }, (_, i) =>
    laps.find((l) => l.lap === anchor + i + 1),
  );
  if (
    heldout.some(
      (l) =>
        !l ||
        !Number.isFinite(l.duration) ||
        l.duration < 20 ||
        l.duration > 300,
    )
  )
    return {
      ...result,
      reason:
        "The holdout window has missing or unusable lap timing. Choose another window.",
    };
  const out = new Set(laps.filter((l) => l.pitOut).map((l) => l.lap));
  if (heldout.some((l) => l!.pitOut || out.has(l!.lap + 1)))
    return {
      ...result,
      reason:
        "The holdout crosses a pit in/out lap. Shorten it or find a pit-free window for this pace-only backtest.",
    };
  const meanX = training.reduce((n, l) => n + l.lap, 0) / training.length,
    meanY = training.reduce((n, l) => n + l.duration, 0) / training.length;
  const xx = training.reduce((n, l) => n + (l.lap - meanX) ** 2, 0);
  const rawSlope = xx
    ? training.reduce((n, l) => n + (l.lap - meanX) * (l.duration - meanY), 0) /
      xx
    : 0;
  const slope = Math.max(-0.5, Math.min(0.5, rawSlope));
  const pace = median(training.map((l) => l.duration))!;
  result.pace = pace;
  result.slope = slope;
  result.rows = heldout.map((l) => ({
    lap: l!.lap,
    actual: l!.duration,
    flat: pace,
    trend: meanY + slope * (l!.lap - meanX),
  }));
  const metrics = (model: "flat" | "trend") => {
    const errors = result.rows.map((r) => r[model] - r.actual),
      total = errors.reduce((n, e) => n + e, 0);
    return {
      mae: errors.reduce((n, e) => n + Math.abs(e), 0) / errors.length,
      bias: total / errors.length,
      totalError: total,
    };
  };
  result.flat = metrics("flat");
  result.trend = metrics("trend");
  return result;
}
export function findBacktestWindow(
  race: Race,
  driver: number,
  horizon: number,
): number | null {
  for (let anchor = 6; anchor + horizon <= race.totalLaps; anchor++)
    if (!paceBacktest(race, driver, anchor, horizon).reason) return anchor;
  return null;
}
