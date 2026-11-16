import type { Point } from "./custom-track";
const mix = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
const quadratic = (a: Point, b: Point, c: Point, t: number) =>
  mix(mix(a, b, t), mix(b, c, t), t);
function distanceToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}
export function roundedTrack(
  points: Point[],
  radius: number,
): { path: string; route: Point[]; anchors: Point[] } {
  if (points.length < 3) return { path: "", route: points, anchors: points };
  const corners = points.map((vertex, i) => {
    const previous = points[(i + points.length - 1) % points.length],
      next = points[(i + 1) % points.length];
    const incoming = Math.hypot(
      previous[0] - vertex[0],
      previous[1] - vertex[1],
    );
    const outgoing = Math.hypot(next[0] - vertex[0], next[1] - vertex[1]);
    // Keep rounding inside a clear neighborhood so close, nonadjacent edges cannot be crossed.
    let clearance = Infinity;
    for (let j = 0; j < points.length; j++)
      if (j !== i && (j + 1) % points.length !== i)
        clearance = Math.min(
          clearance,
          distanceToSegment(vertex, points[j], points[(j + 1) % points.length]),
        );
    const trim = Math.max(
      0,
      Math.min(
        Number.isFinite(radius) ? radius : 0,
        80,
        incoming * 0.45,
        outgoing * 0.45,
        clearance * 0.45,
      ),
    );
    const entry = mix(vertex, previous, incoming ? trim / incoming : 0),
      exit = mix(vertex, next, outgoing ? trim / outgoing : 0);
    return { vertex, entry, exit, anchor: quadratic(entry, vertex, exit, 0.5) };
  });
  const path =
    `M${corners[0].entry.join(",")} ` +
    corners
      .map(
        (c) =>
          `L${c.entry.join(",")} Q${c.vertex.join(",")} ${c.exit.join(",")}`,
      )
      .join(" ") +
    " Z";
  // Distance-based marker playback uses samples of the same curves, with start/finish at corner zero's midpoint.
  const route: Point[] = [corners[0].anchor];
  for (let j = 9; j <= 16; j++)
    route.push(
      quadratic(corners[0].entry, corners[0].vertex, corners[0].exit, j / 16),
    );
  for (let i = 1; i < corners.length; i++) {
    const c = corners[i];
    route.push(c.entry);
    for (let j = 1; j <= 16; j++)
      route.push(quadratic(c.entry, c.vertex, c.exit, j / 16));
  }
  route.push(corners[0].entry);
  for (let j = 1; j < 8; j++)
    route.push(
      quadratic(corners[0].entry, corners[0].vertex, corners[0].exit, j / 16),
    );
  const clean = route.filter(
    (p, i) =>
      i === 0 ||
      Math.hypot(p[0] - route[i - 1][0], p[1] - route[i - 1][1]) > 0.0001,
  );
  if (
    clean.length > 1 &&
    Math.hypot(clean.at(-1)![0] - clean[0][0], clean.at(-1)![1] - clean[0][1]) <
      0.0001
  )
    clean.pop();
  return {
    path,
    route: clean,
    anchors: corners.map((c) => c.anchor),
  };
}
