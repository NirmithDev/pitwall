import type { Race } from "./race";
export interface StrategyPlan {
  paceDelta: number;
  degradation: number;
  pitLap: number;
  pitLoss: number;
  freshTyreGain: number;
}
export interface Calibration {
  pace: number;
  samples: number;
  min: number;
  max: number;
  laps: number[];
}
const median = (values: number[]) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length % 2
    ? v[(v.length - 1) / 2]
    : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
};
export function calibratePace(
  race: Race,
  driver: number,
  throughLap: number,
): Calibration | null {
  const all = race.laps.filter((l) => l.driver === driver);
  const pitOutLaps = new Set(
    all.filter((l) => l.pitOut && l.lap <= throughLap).map((l) => l.lap),
  );
  const candidates = all
    .filter(
      (l) =>
        l.lap > 1 &&
        l.lap <= throughLap &&
        !l.pitOut &&
        !pitOutLaps.has(l.lap + 1) &&
        Number.isFinite(l.duration) &&
        l.duration > 20 &&
        l.duration < 300,
    )
    .slice(-20);
  if (candidates.length < 3) return null;
  const center = median(candidates.map((l) => l.duration));
  // A robust recent-pace estimate, not a claim to remove all traffic or flag effects.
  const clean = candidates
    .filter((l) => Math.abs(l.duration - center) <= Math.max(3, center * 0.08))
    .slice(-12);
  if (clean.length < 3) return null;
  const times = clean.map((l) => l.duration);
  return {
    pace: median(times),
    samples: clean.length,
    min: Math.min(...times),
    max: Math.max(...times),
    laps: clean.map((l) => l.lap),
  };
}
export const defaultStay: StrategyPlan = {
  paceDelta: 0,
  degradation: 0.06,
  pitLap: 0,
  pitLoss: 22,
  freshTyreGain: 1.2,
};
export const defaultStop: StrategyPlan = { ...defaultStay, pitLap: 5 };
export function validatePlan(plan: StrategyPlan, horizon: number): boolean {
  return (
    [
      plan.paceDelta,
      plan.degradation,
      plan.pitLap,
      plan.pitLoss,
      plan.freshTyreGain,
    ].every(Number.isFinite) &&
    plan.paceDelta >= -5 &&
    plan.paceDelta <= 5 &&
    plan.degradation >= 0 &&
    plan.degradation <= 0.5 &&
    Number.isInteger(plan.pitLap) &&
    plan.pitLap >= 0 &&
    plan.pitLap <= horizon &&
    plan.pitLoss >= 5 &&
    plan.pitLoss <= 60 &&
    plan.freshTyreGain >= 0 &&
    plan.freshTyreGain <= 5
  );
}
export function projectStrategy(
  pace: number,
  horizon: number,
  plan: StrategyPlan,
) {
  if (
    !Number.isFinite(pace) ||
    pace < 20 ||
    !Number.isInteger(horizon) ||
    horizon < 1 ||
    horizon > 40 ||
    !validatePlan(plan, horizon)
  )
    throw new Error("Invalid strategy assumptions.");
  let total = 0;
  return Array.from({ length: horizon }, (_, i) => {
    const lap = i + 1,
      afterStop = plan.pitLap > 0 && lap > plan.pitLap;
    const age = afterStop ? lap - plan.pitLap - 1 : i;
    const lapTime =
      pace +
      plan.paceDelta +
      age * plan.degradation -
      (afterStop ? plan.freshTyreGain : 0) +
      (lap === plan.pitLap ? plan.pitLoss : 0);
    total += lapTime;
    return { lap, lapTime, total, pit: lap === plan.pitLap };
  });
}
export interface SavedScenario {
  version: 1;
  id: string;
  name: string;
  driver: number;
  throughLap: number;
  horizon: number;
  a: StrategyPlan;
  b: StrategyPlan;
}
export const scenariosKey = (raceId: string) =>
  `pitwall.scenarios.v1.${encodeURIComponent(raceId)}`;
export function readScenarios(race: Race): SavedScenario[] {
  try {
    const raw = JSON.parse(localStorage.getItem(scenariosKey(race.id)) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (s): s is SavedScenario =>
          !!s &&
          s.version === 1 &&
          typeof s.id === "string" &&
          s.id.length < 80 &&
          typeof s.name === "string" &&
          s.name.trim().length > 0 &&
          s.name.length <= 48 &&
          race.drivers.some((d) => d.number === s.driver) &&
          Number.isInteger(s.throughLap) &&
          s.throughLap >= 3 &&
          s.throughLap < race.totalLaps &&
          Number.isInteger(s.horizon) &&
          s.horizon >= 1 &&
          s.horizon <= Math.min(40, race.totalLaps - s.throughLap) &&
          s.a &&
          s.b &&
          validatePlan(s.a, s.horizon) &&
          validatePlan(s.b, s.horizon),
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}
