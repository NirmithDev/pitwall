import {newSandboxDriver, type SandboxDriver, type SandboxSetup} from "./sandbox";

export const teamKey = "pitwall.recruitment.v1";
export const teamUpdatedEvent = "pitwall-team-updated";
function announceTeam() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(teamUpdatedEvent));
}
export const startingCredits = 12000;
export const customPoints = 210;
export const refreshFee = 250;
export type DriverStats = { pace: number; consistency: number; pitDiscipline: number };
export type RecruitDriver = {
  id: string; name: string; color: string; origin: "market" | "custom"; stats: DriverStats;
};
export type Team = {
  version: 1; id: string; revision: number; name: string; credits: number;
  seed: number; generation: number; roster: RecruitDriver[]; market: RecruitDriver[];
  lineup: [string | null, string | null];
};
const firstNames = ["Nova", "Arden", "Luca", "Mika", "Alex", "Sora", "Remy", "Kai", "Zara", "Eden", "Rio", "Avery"];
const lastNames = ["Vega", "Marin", "Vale", "Sato", "Reed", "Silva", "Costa", "Quinn", "Mercer", "Blake", "Moreau", "Park"];
const colors = ["#ff665d", "#6d9fff", "#f2c75e", "#64d2b6", "#bd8bff", "#f095cf"];
function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}
export function generateMarket(seed: number, generation: number): RecruitDriver[] {
  const next = random(seed);
  return Array.from({length: 6}, (_, i) => ({
    id: `market-${generation}-${seed.toString(16)}-${i}`,
    name: `${firstNames[(Math.floor(next() * firstNames.length) + i) % firstNames.length]} ${lastNames[(generation + i) % lastNames.length]}`,
    color: colors[i], origin: "market" as const,
    stats: {pace: 45 + Math.floor(next() * 46), consistency: 45 + Math.floor(next() * 46), pitDiscipline: 45 + Math.floor(next() * 46)},
  }));
}
export function newTeam(seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1): Team {
  return {version: 1, id: crypto.randomUUID(), revision: 0, name: "Midnight Racing", credits: startingCredits,
    seed, generation: 0, roster: [], market: generateMarket(seed, 0), lineup: [null, null]};
}
export const overall = (s: DriverStats) => Math.round((s.pace + s.consistency + s.pitDiscipline) / 3);
export const pointsUsed = (s: DriverStats) => s.pace + s.consistency + s.pitDiscipline;
export const signingFee = (s: DriverStats) => 500 + Math.round((s.pace ** 2 * .45 + s.consistency ** 2 * .25 + s.pitDiscipline ** 2 * .15) / 25) * 25;
export const releaseRefund = (d: RecruitDriver) => Math.floor(signingFee(d.stats) * .4);
export function driverEffects(s: DriverStats) {
  return {paceOffset: Math.round((70 - (s.pace * .6 + s.consistency * .4)) * .12 * 100) / 100,
    serviceSeconds: Math.round((5 - s.pitDiscipline * .04) * 100) / 100};
}
function checkDriver(raw: unknown): RecruitDriver {
  if (!raw || typeof raw !== "object") throw new Error("Invalid driver.");
  const d = raw as RecruitDriver;
  if (typeof d.id !== "string" || !d.id || d.id.length > 64 || typeof d.name !== "string" || !d.name.trim() || d.name.trim().length > 24 || /[\x00-\x1f]/.test(d.name) ||
    typeof d.color !== "string" || !/^#[0-9a-f]{6}$/i.test(d.color) || !["market", "custom"].includes(d.origin) || !d.stats ||
    [d.stats.pace, d.stats.consistency, d.stats.pitDiscipline].some(n => !Number.isInteger(n) || n < 10 || n > 100) ||
    (d.origin === "custom" && pointsUsed(d.stats) > customPoints)) throw new Error("Use a name of 1–24 characters, valid colour and integer stats from 10–100. Custom drivers have 210 points.");
  return {id: d.id, name: d.name.trim(), color: d.color, origin: d.origin, stats: {...d.stats}};
}
export function parseTeam(raw: unknown): Team {
  if (!raw || typeof raw !== "object") throw new Error("Invalid saved team.");
  const t = raw as Team;
  if (t.version !== 1 || typeof t.id !== "string" || !t.id || t.id.length > 64 || !Number.isSafeInteger(t.revision) || t.revision < 0 ||
    typeof t.name !== "string" || !t.name.trim() || t.name.trim().length > 32 ||
    !Number.isInteger(t.credits) || t.credits < 0 || t.credits > startingCredits ||
    !Number.isInteger(t.seed) || t.seed < 1 || t.seed > 4294967295 || !Number.isInteger(t.generation) || t.generation < 0 || t.generation > 1000000 ||
    !Array.isArray(t.roster) || t.roster.length > 6 || !Array.isArray(t.market) || t.market.length > 6 || !Array.isArray(t.lineup) || t.lineup.length !== 2)
    throw new Error("Saved team has invalid budget, roster, market or version.");
  const roster = t.roster.map(checkDriver), market = t.market.map(checkDriver);
  const ids = [...roster, ...market].map(d => d.id);
  if (new Set(ids).size !== ids.length || new Set(roster.map(d => d.name.toLowerCase())).size !== roster.length || market.some(d => d.origin !== "market") ||
    t.lineup.some(id => id !== null && !roster.some(d => d.id === id)) || (t.lineup[0] !== null && t.lineup[0] === t.lineup[1]))
    throw new Error("Saved team contains duplicate drivers or an invalid lineup.");
  return {...t, name: t.name.trim(), roster, market, lineup: [...t.lineup]};
}
function hire(t: Team, driver: RecruitDriver): Team {
  if (t.roster.length >= 6) throw new Error("Your roster is full. Release a driver before signing another.");
  const cost = signingFee(driver.stats);
  if (t.credits < cost) throw new Error("Not enough credits to sign this driver.");
  if (t.roster.some(d => d.name.toLowerCase() === driver.name.toLowerCase())) throw new Error("A signed driver already uses this name. Use another name or prospect.");
  if ([...t.roster, ...t.market].some(d => d.id === driver.id && d !== driver)) throw new Error("This driver ID is already in use.");
  const lineup = [...t.lineup] as Team["lineup"];
  const empty = lineup.findIndex(id => id === null);
  if (empty >= 0) lineup[empty] = driver.id;
  return {...t, credits: t.credits - cost, roster: [...t.roster, driver], market: t.market.filter(d => d.id !== driver.id), lineup};
}
export function signDriver(team: Team, id: string): Team {
  const d = team.market.find(d => d.id === id);
  if (!d) throw new Error("This driver is no longer available.");
  return hire(team, d);
}
export function createDriver(team: Team, draft: RecruitDriver): Team {
  return hire(team, checkDriver({...draft, origin: "custom"}));
}
export function releaseDriver(team: Team, id: string): Team {
  const driver = team.roster.find(d => d.id === id);
  if (!driver) throw new Error("This driver is not on your roster.");
  return {...team, credits: team.credits + releaseRefund(driver), roster: team.roster.filter(d => d.id !== id),
    lineup: team.lineup.map(d => d === id ? null : d) as Team["lineup"]};
}
export function assignSeat(team: Team, seat: 0 | 1, id: string | null): Team {
  if (id !== null && !team.roster.some(d => d.id === id)) throw new Error("Sign the driver before assigning a seat.");
  const lineup = [...team.lineup] as Team["lineup"];
  const other = seat === 0 ? 1 : 0;
  if (id !== null && lineup[other] === id) lineup[other] = lineup[seat];
  lineup[seat] = id;
  return {...team, lineup};
}
export function refreshMarket(team: Team): Team {
  if (team.credits < refreshFee) throw new Error("Not enough credits to scout a new market.");
  const seed = Math.floor(random(team.seed)() * 4294967296) || 1;
  const generation = team.generation + 1;
  return {...team, credits: team.credits - refreshFee, seed, generation, market: generateMarket(seed, generation)};
}
export function applyLineup(team: Team, setup: SandboxSetup): SandboxSetup {
  const drivers = team.lineup.map(id => team.roster.find(d => d.id === id));
  if (drivers.some(d => !d)) throw new Error("Choose two signed drivers before applying your lineup.");
  const converted = drivers.map((d, i): SandboxDriver => ({id: `recruit:${d!.id}`, name: d!.name, color: d!.color,
    ...driverEffects(d!.stats), pitLap: setup.drivers[i]?.pitLap ?? 0}));
  return {...setup, drivers: [...converted, ...setup.drivers.slice(2).filter(d => !converted.some(c => c.id === d.id))]};
}
export function assignRecruitToGrid(team: Team, setup: SandboxSetup, slot: number, id: string): SandboxSetup {
  const recruit = team.roster.find(d => d.id === id);
  if (!recruit || !Number.isInteger(slot) || slot < 0 || slot >= setup.drivers.length) throw new Error("Choose a signed driver and an existing grid slot.");
  const drivers = setup.drivers.map(d => ({...d}));
  const profileId = `recruit:${recruit.id}`;
  const other = drivers.findIndex(d => d.id === profileId);
  if (other >= 0 && other !== slot) drivers[other] = {...drivers[slot], pitLap: drivers[other].pitLap};
  drivers[slot] = {id: profileId, name: recruit.name, color: recruit.color, ...driverEffects(recruit.stats), pitLap: drivers[slot].pitLap};
  return {...setup, drivers};
}
export function availableLineup(team: Team, setup: SandboxSetup): SandboxSetup {
  let next = setup;
  team.lineup.forEach((id,i) => {
    if (id !== null && team.roster.some(d => d.id === id)) {
      if(i>=next.drivers.length)next={...next,drivers:[...next.drivers,newSandboxDriver(i)]};
      next = assignRecruitToGrid(team,next,i,id);
    }
  });
  return next;
}

export function readTeam(): {team: Team; warning: string} {
  try {
    const raw = localStorage.getItem(teamKey);
    return {team: raw === null ? newTeam() : parseTeam(JSON.parse(raw)), warning: ""};
  } catch {
    return {team: newTeam(), warning: "Saved team could not be read. Existing data will not be overwritten. Restore browser storage access or back up the saved data before starting a fresh team."};
  }
}
export async function saveTeam(expected: Team, next: Team): Promise<Team> {
  const write = () => {
    const raw = localStorage.getItem(teamKey);
    if (raw !== null) {
      const current = parseTeam(JSON.parse(raw));
      if (current.id !== expected.id || current.revision !== expected.revision) throw new Error("Your team changed in another tab. Load latest team before making more changes.");
    } else if (expected.revision !== 0) throw new Error("Saved team was removed in another tab. Load latest team first.");
    const saved = parseTeam({...next, revision: expected.revision + 1});
    localStorage.setItem(teamKey, JSON.stringify(saved));
    announceTeam();
    return saved;
  };
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(teamKey, write) : write();
}
export async function ensureTeam(candidate: Team): Promise<Team> {
  const write = () => {
    const raw = localStorage.getItem(teamKey);
    if (raw !== null) return parseTeam(JSON.parse(raw));
    const saved = parseTeam({...candidate, revision: 1});
    localStorage.setItem(teamKey, JSON.stringify(saved));
    announceTeam();
    return saved;
  };
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(teamKey, write) : write();
}
export async function resetTeam(): Promise<Team> {
  const write = () => {
    const team = {...newTeam(), revision: 1};
    localStorage.setItem(teamKey, JSON.stringify(team));
    announceTeam();
    return team;
  };
  return typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(teamKey, write) : write();
}
