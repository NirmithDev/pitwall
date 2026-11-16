export type Point = [number, number];
export interface CustomTrack {
  version: 1;
  id: string;
  name: string;
  points: Point[];
  sectorEnds: [number, number];
  cornerRadius: number;
}
export const tracksKey = "pitwall.custom-tracks.v1";
export function newTrack(): CustomTrack {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: "Midnight circuit",
    sectorEnds: [3, 6],
    cornerRadius: 28,
    points: [
      [160, 130],
      [360, 85],
      [610, 100],
      [690, 220],
      [570, 260],
      [650, 390],
      [420, 430],
      [310, 330],
      [130, 390],
      [85, 240],
    ],
  };
}
function cross(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function onSegment(a: Point, b: Point, p: Point) {
  return (
    Math.abs(cross(a, b, p)) < 1e-7 &&
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    onSegment(a, b, c) ||
    onSegment(a, b, d) ||
    onSegment(c, d, a) ||
    onSegment(c, d, b)
  );
}
export function validateTrack(track: CustomTrack): string[] {
  const errors: string[] = [];
  if (
    !Number.isFinite(track.cornerRadius) ||
    track.cornerRadius < 0 ||
    track.cornerRadius > 80
  )
    errors.push("Corner rounding must be between 0 and 80 canvas units.");
  if (!track.name.trim() || track.name.trim().length > 48)
    errors.push("Use a circuit name between 1 and 48 characters.");
  const p = track.points;
  if (p.length < 6 || p.length > 120)
    errors.push("Use between 6 and 120 control points.");
  if (
    p.some(
      (point) =>
        point.some((n) => !Number.isFinite(n)) ||
        point[0] < 20 ||
        point[0] > 780 ||
        point[1] < 20 ||
        point[1] > 500,
    )
  )
    errors.push("Keep every point inside the canvas margin.");
  if (p.length >= 3) {
    let area = 0,
      short = false,
      crossing = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      area += a[0] * b[1] - b[0] * a[1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 8) short = true;
      for (let j = i + 2; j < p.length; j++) {
        if (i === 0 && j === p.length - 1) continue;
        if (intersects(a, b, p[j], p[(j + 1) % p.length])) crossing = true;
      }
    }
    if (Math.abs(area) < 1000)
      errors.push("The circuit needs a larger enclosed area.");
    if (short)
      errors.push("Separate neighboring points by at least 8 canvas units.");
    if (crossing)
      errors.push(
        "The circuit crosses or touches itself. Move or remove a control point.",
      );
  }
  const [s1, s2] = track.sectorEnds;
  if (
    !Number.isInteger(s1) ||
    !Number.isInteger(s2) ||
    s1 <= 0 ||
    s1 >= s2 ||
    s2 >= p.length
  )
    errors.push(
      "Sector ends must follow start/finish in order: S1 before S2, then finish.",
    );
  return errors;
}
// Treat imported JSON as data: whitelist fields and reject invalid geometry before saving.
export function parseTrack(raw: unknown): CustomTrack {
  if (!raw || typeof raw !== "object")
    throw new Error("This file does not contain a custom circuit.");
  const r = raw as Record<string, unknown>;
  if (
    r.version !== 1 ||
    typeof r.id !== "string" ||
    !r.id ||
    r.id.length > 80 ||
    typeof r.name !== "string" ||
    !Array.isArray(r.points) ||
    r.points.length > 120 ||
    !Array.isArray(r.sectorEnds) ||
    r.sectorEnds.length !== 2
  )
    throw new Error(
      "Unsupported circuit format. Use a v1 Pitwall circuit JSON file.",
    );
  if (
    r.points.some(
      (p) =>
        !Array.isArray(p) ||
        p.length !== 2 ||
        p.some((n) => typeof n !== "number" || !Number.isFinite(n)),
    ) ||
    r.sectorEnds.some((n) => typeof n !== "number")
  )
    throw new Error("Circuit coordinates and sector indices must be numbers.");
  const track: CustomTrack = {
    version: 1,
    id: r.id,
    name: r.name.trim(),
    points: r.points as Point[],
    sectorEnds: r.sectorEnds as [number, number],
    cornerRadius:
      r.cornerRadius === undefined
        ? 28
        : typeof r.cornerRadius === "number"
          ? r.cornerRadius
          : NaN,
  };
  const errors = validateTrack(track);
  if (errors.length) throw new Error(errors.join(" "));
  return track;
}
export function readTracks(): CustomTrack[] {
  try {
    const raw = JSON.parse(localStorage.getItem(tracksKey) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const ids = new Set<string>();
    return raw.slice(0, 20).flatMap((item) => {
      try {
        const track = parseTrack(item);
        if (ids.has(track.id)) return [];
        ids.add(track.id);
        return [track];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
export function rebaseStart(track: CustomTrack, index: number): CustomTrack {
  if (index < 0 || index >= track.points.length) return track;
  // Redefine sectors in circuit order after rotating the start point.
  return {
    ...track,
    points: [...track.points.slice(index), ...track.points.slice(0, index)],
    sectorEnds: [
      Math.floor(track.points.length / 3),
      Math.floor((track.points.length * 2) / 3),
    ],
  };
}
export function downloadJson(filename: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
